import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all transitie calculations
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    // Strict privacy: alleen eigen berekeningen. Legacy-records zonder userId
    // zijn via claim-legacy-transitie seed toegewezen aan eigenaren — alles
    // heeft nu een userId.
    const calculations = await prisma.transitieCalculation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })
    const visible = calculations.filter(c => {
      if (!c.hiddenFor) return true
      try { return !JSON.parse(c.hiddenFor).includes(session.user.id) } catch { return true }
    })
    return NextResponse.json(visible.map(c => ({ ...c, isOwn: true })))
  } catch (error) {
    console.error('Error fetching transitie calculations:', error)
    return NextResponse.json({ error: 'Kon niet ophalen calculations' }, { status: 500 })
  }
}

// POST create new calculation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const body = await req.json()

    const calculation = await prisma.transitieCalculation.create({
      data: {
        userId: session.user.id,
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
        months: body.months,
        multiplier: typeof body.multiplier === 'number' ? body.multiplier : null,
        clientParty: body.clientParty || null,
        notes: body.notes || null,
      }
    })

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error creating transitie calculation:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken calculation' }, { status: 500 })
  }
}
