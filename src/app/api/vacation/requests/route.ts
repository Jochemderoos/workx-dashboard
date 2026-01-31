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

    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'

    if (all) {
      // Get all approved requests (for calendar view)
      const requests = await prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
          endDate: {
            gte: new Date(new Date().getFullYear(), 0, 1), // From start of current year
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { startDate: 'asc' }
      })
      return NextResponse.json(requests)
    }

    // Get user's own requests
    const requests = await prisma.vacationRequest.findMany({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching vacation requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate, endDate, days, reason } = await req.json()

    if (!startDate || !endDate || !days) {
      return NextResponse.json(
        { error: 'Start date, end date, and days are required' },
        { status: 400 }
      )
    }

    // Check available days
    const currentYear = new Date().getFullYear()
    const vacationBalance = await prisma.vacationBalance.findFirst({
      where: {
        userId: session.user.id,
        year: currentYear,
      }
    })

    if (vacationBalance) {
      const available = vacationBalance.overgedragenVorigJaar + vacationBalance.opbouwLopendJaar - vacationBalance.opgenomenLopendJaar
      if (days > available) {
        return NextResponse.json(
          { error: 'Niet genoeg vakantiedagen beschikbaar' },
          { status: 400 }
        )
      }
    }

    const request = await prisma.vacationRequest.create({
      data: {
        userId: session.user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days,
        reason,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('Error creating vacation request:', error)
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}
