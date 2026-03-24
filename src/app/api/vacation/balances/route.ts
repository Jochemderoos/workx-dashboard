import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all vacation balances (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()

    // Get all users with their vacation balances
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        vacationBalance: {
          select: {
            id: true,
            overgedragenVorigJaar: true,
            opbouwLopendJaar: true,
            bijgekocht: true,
            opgenomenLopendJaar: true,
            year: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Herbereken opgenomenLopendJaar uit daadwerkelijke APPROVED requests
    // Dit voorkomt drift door dubbele incrementen of race conditions
    const approvedRequests = await prisma.vacationRequest.findMany({
      where: { status: 'APPROVED' },
      select: { userId: true, days: true, startDate: true, reason: true },
    })

    // Som per gebruiker voor het huidige jaar (op basis van startDate)
    // Exclude zwangerschaps/ouderschaps/bevallings/geboorteverlof — die tellen NIET als vakantiedagen
    const verlofTypes = ['zwangerschapsverlof', 'ouderschapsverlof', 'bevallingsverlof', 'geboorteverlof']
    const approvedDaysMap = new Map<string, number>()
    for (const r of approvedRequests) {
      const reqYear = new Date(r.startDate).getFullYear()
      if (reqYear === currentYear) {
        const reason = (r.reason || '').toLowerCase()
        const isVerlof = verlofTypes.some(t => reason.includes(t))
        if (!isVerlof) {
          approvedDaysMap.set(r.userId, (approvedDaysMap.get(r.userId) || 0) + r.days)
        }
      }
    }

    // Format response - show existing balance regardless of year (prevents data loss at year boundaries)
    const balances = users.map(user => {
      const balance = user.vacationBalance
      const isPartner = user.role === 'PARTNER'
      const actualOpgenomen = approvedDaysMap.get(user.id) || 0

      return {
        userId: user.id,
        personName: user.name,
        isPartner,
        year: balance?.year || currentYear,
        overgedragenVorigJaar: balance?.overgedragenVorigJaar || 0,
        opbouwLopendJaar: balance?.opbouwLopendJaar ?? (isPartner ? 0 : 25),
        bijgekocht: balance?.bijgekocht || 0,
        opgenomenLopendJaar: actualOpgenomen,
        note: isPartner ? 'Partner' : '',
        needsYearUpdate: balance ? balance.year !== currentYear : false,
      }
    })

    // Auto-heal: sync opgeslagen tellers met werkelijkheid
    for (const user of users) {
      const balance = user.vacationBalance
      const actualOpgenomen = approvedDaysMap.get(user.id) || 0
      if (balance && balance.opgenomenLopendJaar !== actualOpgenomen) {
        prisma.vacationBalance.update({
          where: { id: balance.id },
          data: { opgenomenLopendJaar: actualOpgenomen },
        }).catch(() => {}) // fire-and-forget, niet blokkeren
      }
    }

    return NextResponse.json(balances)
  } catch (error) {
    console.error('Error fetching vacation balances:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen balances' },
      { status: 500 }
    )
  }
}

// PATCH - Update a user's vacation balance
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { userId, overgedragenVorigJaar, opbouwLopendJaar, bijgekocht, opgenomenLopendJaar } = await req.json()
    const currentYear = new Date().getFullYear()

    // Upsert the vacation balance using userId (unique per user)
    const balance = await prisma.vacationBalance.upsert({
      where: { userId },
      update: {
        year: currentYear,
        overgedragenVorigJaar,
        opbouwLopendJaar,
        bijgekocht,
        opgenomenLopendJaar,
        updatedById: session.user.id,
      },
      create: {
        userId,
        year: currentYear,
        overgedragenVorigJaar,
        opbouwLopendJaar,
        bijgekocht: bijgekocht || 0,
        opgenomenLopendJaar,
        updatedById: session.user.id,
      }
    })

    return NextResponse.json(balance)
  } catch (error) {
    console.error('Error updating vacation balance:', error)
    return NextResponse.json(
      { error: 'Kon niet bijwerken balance' },
      { status: 500 }
    )
  }
}
