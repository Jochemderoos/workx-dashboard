import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH update calculation
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const body = await req.json()

    const calculation = await prisma.transitieCalculation.update({
      where: { id: params.id },
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
    console.error('Error updating transitie calculation:', error)
    return NextResponse.json({ error: 'Kon niet bijwerken calculation' }, { status: 500 })
  }
}

// DELETE calculation
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    await prisma.transitieCalculation.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transitie calculation:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen calculation' }, { status: 500 })
  }
}
