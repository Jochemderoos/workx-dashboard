import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { normalizeVerlofType } from '@/lib/verlof-types'
import { verlofKey, recurringTakenThisYear } from '@/lib/recurring-leave'

// GET - Voor iedereen, maar niet-managers zien alleen hun eigen data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email! }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isManager = ['PARTNER', 'ADMIN'].includes(currentUser.role)

    // Iedereen ziet alle medewerkers (voor voetbalplaatjes)
    // Maar gevoelige info (salaris, bonus, verlof) alleen voor managers of eigen profiel
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        NOT: {
          OR: [
            { name: { contains: 'Lotte' } },
          ], // Lotte (office) eruit filteren; Bente wordt wel in Team getoond
        }
      },
      include: {
        compensation: true,
        bonusCalculations: {
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), 0, 1) // Vanaf 1 januari dit jaar
            }
          }
        },
        vacationBalance: true,
        parentalLeaves: true
      },
      orderBy: { name: 'asc' }
    })

    // Haal salarisschalen op voor dynamisch salaris
    const salaryScales = await prisma.salaryScale.findMany()

    // Verlof-dagen per persoon per type, afgeleid uit goedgekeurde aanvragen
    // dit jaar (zwangerschap/ouderschap tellen niet van het vakantiesaldo af,
    // maar worden hier apart opgeteld — voedt de Team-tellers automatisch).
    const yr = new Date().getFullYear()
    const verlofRequests = await prisma.vacationRequest.findMany({
      where: { status: 'APPROVED', startDate: { gte: new Date(`${yr}-01-01`), lt: new Date(`${yr + 1}-01-01`) } },
      select: { userId: true, days: true, type: true, childNumber: true },
    })
    const verlofByUser: Record<string, Record<string, number>> = {}
    const addVerlof = (uid: string, key: string, days: number) => {
      const rec = verlofByUser[uid] || (verlofByUser[uid] = {})
      rec[key] = Math.round(((rec[key] || 0) + days) * 10) / 10
    }
    for (const r of verlofRequests) {
      const t = normalizeVerlofType(r.type)
      if (t === 'vakantie') continue
      addVerlof(r.userId, verlofKey(t, r.childNumber), r.days)
    }
    // Terugkerende vaste verlofdagen dit jaar t/m vandaag.
    const recurringRules = await prisma.recurringLeave.findMany()
    const nowD = new Date()
    for (const r of recurringRules) {
      const t = normalizeVerlofType(r.type)
      if (t === 'vakantie') continue
      const taken = recurringTakenThisYear(r as { type: string; weekday: number; dayValue: number; childNumber?: number | null; startDate: Date; endDate: Date | null }, yr, nowD)
      if (taken > 0) addVerlof(r.userId, verlofKey(t, r.childNumber), taken)
    }

    // Opgenomen vakantiedagen — zelfde afleiding als /api/vacation/summary,
    // zodat Team en het vakantieschema gelijk lopen: override ?? som van
    // goedgekeurde 'vakantie'-aanvragen + partner-periodes (ontdubbeld op overlap).
    const [approvedReqs, periodsThisYear] = await Promise.all([
      prisma.vacationRequest.findMany({ where: { status: 'APPROVED' }, select: { userId: true, startDate: true, endDate: true, days: true, type: true } }),
      prisma.vacationPeriod.findMany({ where: { year: yr }, select: { userId: true, startDate: true, endDate: true, days: true } }),
    ])
    const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS <= bE && bS <= aE
    const takenByUser: Record<string, number> = {}
    const addTaken = (uid: string, d: number) => { takenByUser[uid] = Math.round(((takenByUser[uid] || 0) + d) * 10) / 10 }
    for (const r of approvedReqs) if (normalizeVerlofType(r.type) === 'vakantie') addTaken(r.userId, r.days)
    for (const p of periodsThisYear) {
      if (approvedReqs.some(r => r.userId === p.userId && overlaps(p.startDate, p.endDate, r.startDate, r.endDate))) continue
      addTaken(p.userId, p.days)
    }

    // Bereken bonus totalen per medewerker
    const employeeData = users.map(user => {
      const isOwnProfile = user.id === currentUser.id
      const canSeeSensitiveInfo = isManager || isOwnProfile

      const bonusPaid = user.bonusCalculations
        .filter(b => b.bonusPaid)
        .reduce((sum, b) => sum + b.bonusAmount, 0)

      const bonusPending = user.bonusCalculations
        .filter(b => !b.bonusPaid)
        .reduce((sum, b) => sum + b.bonusAmount, 0)

      // Bepaal salaris: ofwel handmatig ingevoerd, ofwel op basis van ervaringsjaar
      let salary = user.compensation?.salary || null
      if (!salary && user.compensation?.experienceYear !== null && user.compensation?.experienceYear !== undefined) {
        const scale = salaryScales.find(s => s.experienceYear === user.compensation?.experienceYear)
        salary = scale?.salary || null
      }

      // Basisinfo voor iedereen (voetbalplaatjes)
      const baseData = {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        startDate: user.startDate,
        department: user.department,
        // Contractvorm alleen voor managers (Hanna + partners)
        contractType: isManager ? user.contractType ?? null : null,
        contractEndDate: isManager ? user.contractEndDate ?? null : null,
        // Woonadres alleen voor eigen profiel of managers (privacy)
        adres: canSeeSensitiveInfo ? (user as { adres?: string | null }).adres ?? null : null,
        compensation: user.compensation ? {
          experienceYear: user.compensation.experienceYear,
          hourlyRate: user.compensation.hourlyRate,
          isHourlyWage: user.compensation.isHourlyWage,
          // Salaris alleen voor eigen profiel of managers
          salary: canSeeSensitiveInfo ? salary : null,
          notes: canSeeSensitiveInfo ? user.compensation.notes : null
        } : null,
        // Gevoelige info alleen voor eigen profiel of managers
        bonusPaid: canSeeSensitiveInfo ? bonusPaid : 0,
        bonusPending: canSeeSensitiveInfo ? bonusPending : 0,
        bonusTotal: canSeeSensitiveInfo ? bonusPaid + bonusPending : 0,
        vacationBalance: canSeeSensitiveInfo && user.vacationBalance
          ? { ...user.vacationBalance, opgenomenLopendJaar: (user.vacationBalance as { opgenomenOverride?: number | null }).opgenomenOverride ?? (takenByUser[user.id] || 0) }
          : null,
        parentalLeaves: canSeeSensitiveInfo ? user.parentalLeaves : [],
        verlof: canSeeSensitiveInfo ? (verlofByUser[user.id] || {}) : {}
      }

      return baseData
    })

    return NextResponse.json(employeeData)
  } catch (error) {
    console.error('Error fetching employee compensation:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST - Alleen PARTNER en ADMIN
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email! }
    })

    if (!currentUser || !['PARTNER', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const data = await request.json()

    // Bepaal salaris op basis van ervaringsjaar als niet handmatig opgegeven
    let salary = data.salary || null
    if (!salary && data.experienceYear !== null && data.experienceYear !== undefined) {
      const scale = await prisma.salaryScale.findUnique({
        where: { experienceYear: data.experienceYear }
      })
      salary = scale?.salary || null
    }

    const compensation = await prisma.employeeCompensation.upsert({
      where: { userId: data.userId },
      update: {
        experienceYear: data.experienceYear ?? null,
        hourlyRate: data.hourlyRate,
        salary: salary,
        isHourlyWage: data.isHourlyWage || false,
        notes: data.notes
      },
      create: {
        userId: data.userId,
        experienceYear: data.experienceYear ?? null,
        hourlyRate: data.hourlyRate,
        salary: salary,
        isHourlyWage: data.isHourlyWage || false,
        notes: data.notes
      }
    })

    return NextResponse.json(compensation)
  } catch (error) {
    console.error('Error saving employee compensation:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
