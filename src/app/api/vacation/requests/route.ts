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

    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'

    // Check if user is admin or partner (can see all vacations)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (all || isAdmin) {
      // Get all approved requests (for calendar view) - or all for admins
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
      { error: 'Kon niet ophalen requests' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { startDate, endDate, days, reason, userId: requestedUserId } = await req.json()

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Check if current user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    // Determine target user
    // Admin/Partner can create for anyone, employees only for themselves
    let targetUserId = session.user.id
    if (requestedUserId && requestedUserId !== session.user.id) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Je mag alleen vakantie voor jezelf aanvragen' },
          { status: 403 }
        )
      }
      targetUserId = requestedUserId
    }

    // Calculate days if not provided
    const start = new Date(startDate)
    const end = new Date(endDate)
    const calculatedDays = days || Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check available days (skip for admin when creating for others)
    if (!isAdmin || targetUserId === session.user.id) {
      const currentYear = new Date().getFullYear()
      const vacationBalance = await prisma.vacationBalance.findFirst({
        where: {
          userId: targetUserId,
          year: currentYear,
        }
      })

      if (vacationBalance) {
        const available = vacationBalance.overgedragenVorigJaar + vacationBalance.opbouwLopendJaar + (vacationBalance.bijgekocht || 0) - vacationBalance.opgenomenLopendJaar
        if (calculatedDays > available) {
          return NextResponse.json(
            { error: 'Niet genoeg vakantiedagen beschikbaar' },
            { status: 400 }
          )
        }
      }
    }

    // Auto-approve when created by admin/partner
    const status = isAdmin ? 'APPROVED' : 'PENDING'
    const approvedBy = isAdmin ? session.user.id : null

    const request = await prisma.vacationRequest.create({
      data: {
        userId: targetUserId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days: calculatedDays,
        reason,
        status,
        approvedBy,
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

    // If auto-approved, update vacation balance
    if (status === 'APPROVED') {
      const currentYear = new Date().getFullYear()
      await prisma.vacationBalance.updateMany({
        where: {
          userId: targetUserId,
          year: currentYear,
        },
        data: {
          opgenomenLopendJaar: {
            increment: calculatedDays
          }
        }
      })
    }

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('Error creating vacation request:', error)
    return NextResponse.json(
      { error: 'Kon niet aanmaken request' },
      { status: 500 }
    )
  }
}
