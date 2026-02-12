import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Mark all current notifications as read
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id

    // Haal alle notificatie-bronnen parallel op
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const [pendingZaken, recentVacationUpdates, todayEvents, currentUser] = await Promise.all([
      prisma.zaakAssignment.findMany({
        where: { userId, status: 'PENDING', expiresAt: { gt: now } },
        select: { id: true },
      }),
      prisma.vacationRequest.findMany({
        where: {
          userId,
          status: { in: ['APPROVED', 'REJECTED'] },
          updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      }),
      prisma.calendarEvent.findMany({
        where: { startTime: { gte: todayStart, lt: todayEnd } },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
    ])

    const notificationKeys: string[] = [
      ...pendingZaken.map((a) => `zaak-${a.id}`),
      ...recentVacationUpdates.map((r) => `vacation-${r.id}`),
      ...todayEvents.map((e) => `event-${e.id}`),
    ]

    // Feedback (for admins/partners)
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER') {
      const unprocessedCount = await prisma.feedback.count({
        where: { processed: false },
      })
      if (unprocessedCount > 0) {
        notificationKeys.push('feedback-unprocessed')
      }
    }

    // Bulk insert alle keys als dismissed (skipDuplicates voor al-bestaande)
    if (notificationKeys.length > 0) {
      await prisma.notificationDismissal.createMany({
        data: notificationKeys.map((key) => ({
          userId,
          notificationKey: key,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
