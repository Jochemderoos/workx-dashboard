import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// GET - Voor iedereen, maar niet-managers zien alleen hun eigen data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        role: { notIn: ['PARTNER', 'ADMIN'] }, // Filter partners en admin eruit
        NOT: {
          name: { contains: 'Lotte' } // Filter Lotte eruit
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
        role: user.role,
        startDate: user.startDate,
        department: user.department,
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
        vacationBalance: canSeeSensitiveInfo ? user.vacationBalance : null,
        parentalLeaves: canSeeSensitiveInfo ? user.parentalLeaves : []
      }

      return baseData
    })

    return NextResponse.json(employeeData)
  } catch (error) {
    console.error('Error fetching employee compensation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Alleen PARTNER en ADMIN
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email! }
    })

    if (!currentUser || !['PARTNER', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
