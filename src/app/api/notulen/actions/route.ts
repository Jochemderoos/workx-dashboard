import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const actions = await prisma.meetingAction.findMany({
      where: {
        isCompleted: false,
      },
      include: {
        week: {
          select: {
            id: true,
            dateLabel: true,
            month: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(actions)
  } catch (error) {
    console.error('Error fetching open actions:', error)
    return NextResponse.json(
      { error: 'Kon openstaande actiepunten niet ophalen' },
      { status: 500 }
    )
  }
}
