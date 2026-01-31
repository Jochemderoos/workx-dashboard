import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all vacation balances (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()

    // Get all users with their vacation balances
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        vacationBalances: {
          where: { year: currentYear },
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

    // Format response
    const balances = users.map(user => {
      const balance = user.vacationBalances[0]
      const isPartner = user.role === 'PARTNER'

      return {
        userId: user.id,
        personName: user.name,
        isPartner,
        overgedragenVorigJaar: balance?.overgedragenVorigJaar || 0,
        opbouwLopendJaar: balance?.opbouwLopendJaar || (isPartner ? 0 : 25),
        bijgekocht: balance?.bijgekocht || 0,
        opgenomenLopendJaar: balance?.opgenomenLopendJaar || 0,
        note: isPartner ? 'Partner' : '',
      }
    })

    return NextResponse.json(balances)
  } catch (error) {
    console.error('Error fetching vacation balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    )
  }
}

// PATCH - Update a user's vacation balance
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, overgedragenVorigJaar, opbouwLopendJaar, bijgekocht, opgenomenLopendJaar } = await req.json()
    const currentYear = new Date().getFullYear()

    // Upsert the vacation balance
    const balance = await prisma.vacationBalance.upsert({
      where: {
        userId_year: {
          userId,
          year: currentYear,
        }
      },
      update: {
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
      { error: 'Failed to update balance' },
      { status: 500 }
    )
  }
}
