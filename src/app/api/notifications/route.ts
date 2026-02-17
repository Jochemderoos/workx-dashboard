import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch notifications for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // Haal alle dismissed notification keys op voor deze user
    const dismissals = await prisma.notificationDismissal.findMany({
      where: { userId },
      select: { notificationKey: true },
    })
    const dismissedKeys = new Set(dismissals.map((d) => d.notificationKey))

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
      const key = `zaak-${assignment.id}`
      notifications.push({
        id: key,
        type: 'zaak',
        title: 'Nieuwe zaak beschikbaar',
        message: `${assignment.zaak?.shortDescription || 'Nieuwe zaak'} - van ${assignment.zaak?.createdBy?.name || 'onbekend'}`,
        createdAt: assignment.createdAt,
        read: dismissedKeys.has(key),
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
      const key = `vacation-${request.id}`
      notifications.push({
        id: key,
        type: 'vacation',
        title: isApproved ? 'Vakantie goedgekeurd' : 'Vakantie afgewezen',
        message: `Je verlofaanvraag voor ${new Date(request.startDate).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })} is ${isApproved ? 'goedgekeurd' : 'afgewezen'}`,
        createdAt: request.updatedAt,
        read: dismissedKeys.has(key),
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
      const key = `event-${event.id}`
      notifications.push({
        id: key,
        type: 'calendar',
        title: 'Vandaag',
        message: `${event.title} om ${new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`,
        createdAt: now,
        read: dismissedKeys.has(key),
        href: '/dashboard/agenda',
      })
    })

    // 4. New feedback (for admins/partners only)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true },
    })

    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER') {
      const unprocessedFeedback = await prisma.feedback.count({
        where: { processed: false },
      })

      if (unprocessedFeedback > 0) {
        const key = 'feedback-unprocessed'
        notifications.push({
          id: key,
          type: 'feedback',
          title: 'Nieuwe feedback',
          message: `Er ${unprocessedFeedback === 1 ? 'is' : 'zijn'} ${unprocessedFeedback} nieuwe feedback item${unprocessedFeedback === 1 ? '' : 's'}`,
          createdAt: now,
          read: dismissedKeys.has(key),
          href: '/dashboard/feedback',
        })
      }
    }

    // 5. Werkverdelingsgesprekken - for current week
    {
      // Skip weekends: advance to next Monday if date falls on Saturday or Sunday
      const todayWork = new Date(now)
      const dayOfWeek = todayWork.getDay()
      if (dayOfWeek === 6) todayWork.setDate(todayWork.getDate() + 2)
      else if (dayOfWeek === 0) todayWork.setDate(todayWork.getDate() + 1)

      const currentWeek = await prisma.meetingWeek.findFirst({
        where: {
          meetingDate: {
            gte: new Date(todayWork.getTime() - 3 * 24 * 60 * 60 * 1000),
            lte: new Date(todayWork.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        },
        include: { distributions: true },
        orderBy: { meetingDate: 'desc' },
      }).catch(() => null)

      if (currentWeek) {
        const completions = await prisma.conversationCompletion.findMany({
          where: { weekId: currentWeek.id },
        })

        if (currentUser?.role === 'PARTNER') {
          // Partner: notification with count of remaining conversations
          const partnerFirstName = currentUser.name?.split(' ')[0] || ''
          const partnerDists = currentWeek.distributions.filter(
            (d) => d.partnerName === partnerFirstName
          )
          // Expand comma-separated names
          let totalEmployees = 0
          let completedCount = 0
          for (const d of partnerDists) {
            if (!d.employeeName) continue
            const names = d.employeeName.split(', ').map((n: string) => n.trim())
            for (const name of names) {
              totalEmployees++
              const isComplete = completions.some(
                (c: any) => c.partnerName === d.partnerName && c.employeeName === name
              )
              if (isComplete) completedCount++
            }
          }
          const remaining = totalEmployees - completedCount
          if (remaining > 0) {
            const key = `werkverdeling-${currentWeek.id}-partner-${partnerFirstName}`
            notifications.push({
              id: key,
              type: 'werkverdeling',
              title: 'Werkverdelingsgesprekken',
              message: `Je hebt nog ${remaining} werkverdelingsgesprek${remaining === 1 ? '' : 'ken'} in te plannen`,
              createdAt: currentWeek.meetingDate,
              read: dismissedKeys.has(key),
              href: '/dashboard',
            })
          }
        } else {
          // Employee: notification per open conversation
          for (const d of currentWeek.distributions) {
            if (!d.employeeName) continue
            const names = d.employeeName.split(', ').map((n: string) => n.trim())
            if (!names.includes(currentUser?.name || '') && d.employeeId !== userId) continue

            const isComplete = completions.some(
              (c: any) => c.partnerName === d.partnerName && c.employeeId === userId
            )
            if (!isComplete) {
              const key = `werkverdeling-${currentWeek.id}-${d.partnerName}-${userId}`
              notifications.push({
                id: key,
                type: 'werkverdeling',
                title: 'Werkverdelingsgesprek',
                message: `Plan je snel een gesprek in met ${d.partnerName}`,
                createdAt: currentWeek.meetingDate,
                read: dismissedKeys.has(key),
                href: '/dashboard',
              })
            }
          }
        }
      }
    }

    // 6. Lustrum verrassing — tijdelijke notificatie voor iedereen
    {
      const key = 'lustrum-2026'
      if (!dismissedKeys.has(key)) {
        notifications.unshift({
          id: key,
          type: 'lustrum',
          title: 'LUSTRUM VERRASSING',
          message: 'Haal je goodie op bij Hanna!',
          createdAt: new Date(),
          read: false,
          href: '/dashboard',
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
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
