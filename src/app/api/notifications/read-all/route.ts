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

    // Haal huidige notificaties op via dezelfde logica als GET
    const now = new Date()
    const notificationKeys: string[] = []

    // 1. Pending zaak assignments
    const pendingZaken = await prisma.zaakAssignment.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      select: { id: true },
    })
    pendingZaken.forEach((a) => notificationKeys.push(`zaak-${a.id}`))

    // 2. Recent vacation updates
    const recentVacationUpdates = await prisma.vacationRequest.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'REJECTED'] },
        updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    })
    recentVacationUpdates.forEach((r) => notificationKeys.push(`vacation-${r.id}`))

    // 3. Today's calendar events
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const todayEvents = await prisma.calendarEvent.findMany({
      where: {
        startTime: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true },
    })
    todayEvents.forEach((e) => notificationKeys.push(`event-${e.id}`))

    // 4. Feedback (for admins/partners)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER') {
      const unprocessedCount = await prisma.feedback.count({
        where: { processed: false },
      })
      if (unprocessedCount > 0) {
        notificationKeys.push('feedback-unprocessed')
      }
    }

    // Upsert alle keys als dismissed
    if (notificationKeys.length > 0) {
      await Promise.all(
        notificationKeys.map((key) =>
          prisma.notificationDismissal.upsert({
            where: {
              userId_notificationKey: {
                userId,
                notificationKey: key,
              },
            },
            update: { dismissedAt: new Date() },
            create: { userId, notificationKey: key },
          })
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
