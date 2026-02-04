import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all employees with availability info for zaak assignment
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is Partner or Admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (currentUser?.role !== 'PARTNER' && currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const today = new Date()

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'EMPLOYEE',
      },
      include: {
        compensation: {
          select: { experienceYear: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Get vacation periods and sick days to check availability
    const [vacationPeriods, sickDays] = await Promise.all([
      prisma.vacationPeriod.findMany({
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
        },
        select: { userId: true },
      }),
      prisma.sickDayEntry.findMany({
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
        },
        select: { userId: true },
      }),
    ])

    const onVacationIds = new Set(vacationPeriods.map(v => v.userId))
    const sickIds = new Set(sickDays.map(s => s.userId))

    // Map employees with availability info
    const result = employees.map((emp) => {
      let isAvailable = true
      let unavailableReason: string | undefined

      if (onVacationIds.has(emp.id)) {
        isAvailable = false
        unavailableReason = 'Op vakantie'
      } else if (sickIds.has(emp.id)) {
        isAvailable = false
        unavailableReason = 'Ziek'
      }

      return {
        id: emp.id,
        name: emp.name,
        experienceYear: emp.compensation?.experienceYear,
        isAvailable,
        unavailableReason,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Kon niet ophalen employees' }, { status: 500 })
  }
}
