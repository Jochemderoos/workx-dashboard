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

    // Check if current user is admin or partner (can see vacation data)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const canSeeVacationData = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phoneNumber: true,
        createdAt: true,
        _count: {
          select: {
            assignedWork: {
              where: {
                status: {
                  in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW']
                }
              }
            }
          }
        },
        // Always include vacation data in query
        vacationBalance: {
          select: {
            opbouwLopendJaar: true,
            overgedragenVorigJaar: true,
            bijgekocht: true,
            opgenomenLopendJaar: true,
            note: true,
          }
        },
        parentalLeave: {
          select: {
            betaaldTotaalWeken: true,
            betaaldOpgenomenWeken: true,
            onbetaaldTotaalWeken: true,
            onbetaaldOpgenomenWeken: true,
            eindDatum: true,
            note: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Filter out vacation data if user is not admin/partner
    const filteredUsers = canSeeVacationData
      ? users
      : users.map(u => ({ ...u, vacationBalance: null, parentalLeave: null }))

    return NextResponse.json(filteredUsers)
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    )
  }
}
