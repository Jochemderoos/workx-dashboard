import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all transitie calculations
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const calculations = await prisma.transitieCalculation.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(calculations)
  } catch (error) {
    console.error('Error fetching transitie calculations:', error)
    return NextResponse.json({ error: 'Failed to fetch calculations' }, { status: 500 })
  }
}

// POST create new calculation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    const calculation = await prisma.transitieCalculation.create({
      data: {
        employerName: body.employerName || null,
        employeeName: body.employeeName,
        startDate: body.startDate,
        endDate: body.endDate,
        salary: body.salary,
        vacationMoney: body.vacationMoney,
        vacationPercent: body.vacationPercent,
        thirteenthMonth: body.thirteenthMonth,
        bonusType: body.bonusType,
        bonusFixed: body.bonusFixed || 0,
        bonusYear1: body.bonusYears?.year1 || 0,
        bonusYear2: body.bonusYears?.year2 || 0,
        bonusYear3: body.bonusYears?.year3 || 0,
        bonusOther: body.bonusOther || 0,
        overtime: body.overtime || 0,
        other: body.other || 0,
        isPensionAge: body.isPensionAge,
        totalSalary: body.totalSalary,
        yearlySalary: body.yearlySalary,
        amount: body.amount,
        amountBeforeMax: body.amountBeforeMax || body.amount,
        years: body.years,
        months: body.months
      }
    })

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error creating transitie calculation:', error)
    return NextResponse.json({ error: 'Failed to create calculation' }, { status: 500 })
  }
}
