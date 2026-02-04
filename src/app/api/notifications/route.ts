import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch notifications for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // Build notifications from various sources
    const notifications: any[] = []

    // 1. Pending zaak assignments (for the current user)
    const pendingZaken = await prisma.zaakAssignment.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      include: {
        zaak: {
          select: {
            id: true,
            shortDescription: true,
            createdBy: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    pendingZaken.forEach((assignment) => {
      notifications.push({
        id: `zaak-${assignment.id}`,
        type: 'zaak',
        title: 'Nieuwe zaak beschikbaar',
        message: `${assignment.zaak?.shortDescription || 'Nieuwe zaak'} - van ${assignment.zaak?.createdBy?.name || 'onbekend'}`,
        createdAt: assignment.createdAt,
        read: false,
        href: '/dashboard/werk',
      })
    })

    // 2. Recent vacation request approvals/rejections (for the current user)
    const recentVacationUpdates = await prisma.vacationRequest.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'REJECTED'] },
        updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    })

    recentVacationUpdates.forEach((request) => {
      const isApproved = request.status === 'APPROVED'
      notifications.push({
        id: `vacation-${request.id}`,
        type: 'vacation',
        title: isApproved ? 'Vakantie goedgekeurd' : 'Vakantie afgewezen',
        message: `Je verlofaanvraag voor ${new Date(request.startDate).toLocaleDateString('nl-NL')} is ${isApproved ? 'goedgekeurd' : 'afgewezen'}`,
        createdAt: request.updatedAt,
        read: true, // These are informational
        href: '/dashboard/vakanties',
      })
    })

    // 3. Upcoming calendar events (reminders) - today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const todayEvents = await prisma.calendarEvent.findMany({
      where: {
        startTime: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      orderBy: { startTime: 'asc' },
      take: 3,
    })

    todayEvents.forEach((event) => {
      notifications.push({
        id: `event-${event.id}`,
        type: 'calendar',
        title: 'Vandaag',
        message: `${event.title} om ${new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
        createdAt: now,
        read: true,
        href: '/dashboard/agenda',
      })
    })

    // 4. New feedback (for admins/partners only)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER') {
      const unprocessedFeedback = await prisma.feedback.count({
        where: { processed: false },
      })

      if (unprocessedFeedback > 0) {
        notifications.push({
          id: 'feedback-unprocessed',
          type: 'feedback',
          title: 'Nieuwe feedback',
          message: `Er ${unprocessedFeedback === 1 ? 'is' : 'zijn'} ${unprocessedFeedback} nieuwe feedback item${unprocessedFeedback === 1 ? '' : 's'}`,
          createdAt: now,
          read: false,
          href: '/dashboard/feedback',
        })
      }
    }

    // Sort by createdAt (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Count unread
    const unreadCount = notifications.filter((n) => !n.read).length

    return NextResponse.json({
      notifications: notifications.slice(0, 10), // Max 10 notifications
      unreadCount,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
