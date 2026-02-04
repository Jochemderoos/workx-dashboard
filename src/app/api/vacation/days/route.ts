import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentYear = new Date().getFullYear()

    // Get or create vacation balance for user
    let vacationBalance = await prisma.vacationBalance.findFirst({
      where: {
        userId: session.user.id,
        year: currentYear,
      }
    })

    if (!vacationBalance) {
      vacationBalance = await prisma.vacationBalance.create({
        data: {
          userId: session.user.id,
          year: currentYear,
          overgedragenVorigJaar: 0,
          opbouwLopendJaar: 25,
          opgenomenLopendJaar: 0,
        }
      })
    }

    // Return in a format compatible with existing code
    return NextResponse.json({
      ...vacationBalance,
      totalDays: vacationBalance.overgedragenVorigJaar + vacationBalance.opbouwLopendJaar,
      usedDays: vacationBalance.opgenomenLopendJaar,
      remainingDays: vacationBalance.overgedragenVorigJaar + vacationBalance.opbouwLopendJaar - vacationBalance.opgenomenLopendJaar,
    })
  } catch (error) {
    console.error('Error fetching vacation balance:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen vacation balance' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Only admins and partners can update vacation balance
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden - alleen Partners en Admin kunnen saldo aanpassen' }, { status: 403 })
    }

    const { userId, overgedragenVorigJaar, opbouwLopendJaar, opgenomenLopendJaar, year } = await req.json()

    const vacationBalance = await prisma.vacationBalance.updateMany({
      where: {
        userId,
        year: year || new Date().getFullYear(),
      },
      data: {
        ...(overgedragenVorigJaar !== undefined && { overgedragenVorigJaar }),
        ...(opbouwLopendJaar !== undefined && { opbouwLopendJaar }),
        ...(opgenomenLopendJaar !== undefined && { opgenomenLopendJaar }),
        updatedById: session.user.id,
      }
    })

    return NextResponse.json(vacationBalance)
  } catch (error) {
    console.error('Error updating vacation balance:', error)
    return NextResponse.json(
      { error: 'Kon niet bijwerken vacation balance' },
      { status: 500 }
    )
  }
}
