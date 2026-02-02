import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET current user's vacation balance
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentYear = new Date().getFullYear()

    // Get user with their vacation balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        role: true,
        vacationBalance: {
          select: {
            id: true,
            year: true,
            overgedragenVorigJaar: true,
            opbouwLopendJaar: true,
            bijgekocht: true,
            opgenomenLopendJaar: true,
            note: true,
            updatedById: true,
            updatedAt: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isPartner = user.role === 'PARTNER'
    const balance = user.vacationBalance

    // Get the name of who last updated it
    let updatedByName = ''
    if (balance?.updatedById) {
      const updater = await prisma.user.findUnique({
        where: { id: balance.updatedById },
        select: { name: true }
      })
      updatedByName = updater?.name || ''
    }

    // Return formatted balance
    return NextResponse.json({
      userName: user.name,
      year: balance?.year || currentYear,
      overgedragenVorigJaar: balance?.overgedragenVorigJaar || 0,
      opbouwLopendJaar: balance?.opbouwLopendJaar || (isPartner ? 0 : 25),
      bijgekocht: balance?.bijgekocht || 0,
      opgenomenLopendJaar: balance?.opgenomenLopendJaar || 0,
      // Calculate totals for easier frontend use
      totaalDagen: (balance?.overgedragenVorigJaar || 0) + (balance?.opbouwLopendJaar || (isPartner ? 0 : 25)) + (balance?.bijgekocht || 0),
      resterend: (balance?.overgedragenVorigJaar || 0) + (balance?.opbouwLopendJaar || (isPartner ? 0 : 25)) + (balance?.bijgekocht || 0) - (balance?.opgenomenLopendJaar || 0),
      lastUpdatedBy: updatedByName,
      lastUpdated: balance?.updatedAt?.toISOString() || '',
      isPartner,
      hasBalance: !!balance,
    })
  } catch (error) {
    console.error('Error fetching vacation balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vacation balance' },
      { status: 500 }
    )
  }
}
