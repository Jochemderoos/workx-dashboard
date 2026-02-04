import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultVacationDays } from '@/lib/config'

// GET - Fetch all vacation page data in one bundled API call
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id
    const currentYear = new Date().getFullYear()

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    // Fetch all data in parallel using Promise.all
    const [
      vacations,
      teamMembers,
      vacationBalances,
      allParentalLeaves,
      myParentalLeave,
      myVacationBalance,
      vacationPeriods,
      myVacationPeriods,
    ] = await Promise.all([
      // 1. All approved vacation requests
      prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),

      // 2. All active team members
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          werkdagen: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 3. Vacation balances (all users, for admins)
      isAdmin
        ? prisma.vacationBalance.findMany({
            where: { year: currentYear },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          })
        : [],

      // 4. All parental leaves (for admins)
      isAdmin
        ? prisma.parentalLeave.findMany({
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ userId: 'asc' }, { childNumber: 'asc' }],
          })
        : [],

      // 5. Current user's parental leave
      prisma.parentalLeave.findMany({
        where: { userId },
        orderBy: { childNumber: 'asc' },
      }),

      // 6. Current user's vacation balance
      prisma.vacationBalance.findFirst({
        where: {
          userId,
          year: currentYear,
        },
      }),

      // 7. All vacation periods (for admins)
      isAdmin
        ? prisma.vacationPeriod.findMany({
            where: { year: currentYear },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { startDate: 'asc' },
          })
        : [],

      // 8. Current user's vacation periods
      prisma.vacationPeriod.findMany({
        where: {
          userId,
          year: currentYear,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
    ])

    // Format vacation balances for easier frontend use
    const formattedBalances = vacationBalances.map((b: any) => ({
      userId: b.userId,
      personName: b.user?.name || 'Onbekend',
      overgedragenVorigJaar: b.overgedragenVorigJaar,
      opbouwLopendJaar: b.opbouwLopendJaar,
      bijgekocht: b.bijgekocht,
      opgenomenLopendJaar: b.opgenomenLopendJaar,
      note: b.note,
      isPartner: b.user?.role === 'PARTNER',
    }))

    // Format my vacation balance
    const isPartner = currentUser?.role === 'PARTNER'
    const defaultOpbouw = getDefaultVacationDays(currentUser?.role || 'EMPLOYEE')

    const myVacationBalanceFormatted = myVacationBalance
      ? {
          year: myVacationBalance.year,
          overgedragenVorigJaar: myVacationBalance.overgedragenVorigJaar,
          opbouwLopendJaar: myVacationBalance.opbouwLopendJaar,
          bijgekocht: myVacationBalance.bijgekocht,
          opgenomenLopendJaar: myVacationBalance.opgenomenLopendJaar,
          totaalDagen:
            myVacationBalance.overgedragenVorigJaar +
            myVacationBalance.opbouwLopendJaar +
            myVacationBalance.bijgekocht,
          resterend:
            myVacationBalance.overgedragenVorigJaar +
            myVacationBalance.opbouwLopendJaar +
            myVacationBalance.bijgekocht -
            myVacationBalance.opgenomenLopendJaar,
          isPartner,
        }
      : {
          year: currentYear,
          overgedragenVorigJaar: 0,
          opbouwLopendJaar: defaultOpbouw,
          bijgekocht: 0,
          opgenomenLopendJaar: 0,
          totaalDagen: defaultOpbouw,
          resterend: defaultOpbouw,
          isPartner,
        }

    return NextResponse.json({
      vacations,
      teamMembers,
      vacationBalances: formattedBalances,
      allParentalLeaves,
      myParentalLeave: myParentalLeave.length > 0 ? myParentalLeave[0] : null,
      myVacationBalance: isPartner ? null : myVacationBalanceFormatted,
      vacationPeriods,
      myVacationPeriods,
      currentUser,
      isAdmin,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching vacation summary:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen vacation summary' },
      { status: 500 }
    )
  }
}
