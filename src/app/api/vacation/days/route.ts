import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentYear = new Date().getFullYear()

    // Get or create vacation days for user
    let vacationDays = await prisma.vacationDays.findFirst({
      where: {
        userId: session.user.id,
        year: currentYear,
      }
    })

    if (!vacationDays) {
      vacationDays = await prisma.vacationDays.create({
        data: {
          userId: session.user.id,
          year: currentYear,
          totalDays: 25,
          usedDays: 0,
        }
      })
    }

    return NextResponse.json(vacationDays)
  } catch (error) {
    console.error('Error fetching vacation days:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vacation days' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can update vacation days
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, totalDays, usedDays, year } = await req.json()

    const vacationDays = await prisma.vacationDays.updateMany({
      where: {
        userId,
        year: year || new Date().getFullYear(),
      },
      data: {
        ...(totalDays !== undefined && { totalDays }),
        ...(usedDays !== undefined && { usedDays }),
      }
    })

    return NextResponse.json(vacationDays)
  } catch (error) {
    console.error('Error updating vacation days:', error)
    return NextResponse.json(
      { error: 'Failed to update vacation days' },
      { status: 500 }
    )
  }
}
