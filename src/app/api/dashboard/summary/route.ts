import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OFFICE_CONFIG, getDefaultVacationDays } from '@/lib/config'

// Skip weekends: advance to next Monday if date falls on Saturday or Sunday
function nextWorkday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  if (day === 6) d.setDate(d.getDate() + 2) // Saturday → Monday
  else if (day === 0) d.setDate(d.getDate() + 1) // Sunday → Monday
  return d
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Transform DB parental leave (uren/dagen) to frontend format (weken)
function transformParentalLeaveForFrontend(leave: any) {
  return {
    id: leave.id,
    userId: leave.userId,
    betaaldTotaalWeken: Math.round((leave.betaaldTotaalUren / 36) * 10) / 10,
    betaaldOpgenomenWeken: Math.round((leave.betaaldOpgenomenUren / 36) * 10) / 10,
    onbetaaldTotaalWeken: Math.round((leave.onbetaaldTotaalDagen / 5) * 10) / 10,
    onbetaaldOpgenomenWeken: Math.round((leave.onbetaaldOpgenomenDagen / 5) * 10) / 10,
    kindNaam: leave.kindNaam,
    kindGeboorteDatum: leave.kindGeboorteDatum,
    startDatum: leave.betaaldVerlofEinddatum,
    eindDatum: leave.onbetaaldVerlofEinddatum,
    note: leave.note,
  }
}

// GET - Fetch all dashboard data in one bundled API call
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const currentYear = now.getFullYear()

    // Format today's date as YYYY-MM-DD for office attendance queries
    // Skip weekends: on Saturday/Sunday, show Monday's data instead
    const todayWork = nextWorkday(now)
    const today = formatDateStr(todayWork)

    // Calculate tomorrow's working day
    const tomorrowDate = new Date(todayWork)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowWork = nextWorkday(tomorrowDate)
    const tomorrow = formatDateStr(tomorrowWork)

    // Fetch all data in parallel using Promise.all
    const [
      calendarEvents,
      workItems,
      upcomingVacations,
      upcomingVacationPeriods,
      feedback,
      officeAttendance,
      tomorrowAttendance,
      vacationBalance,
      parentalLeave,
      currentUser,
      birthdays,
      newsletterReminders,
      allNewsletterAssignments,
      isNewsletterResponsible,
      nextTraining,
      openMeetingActions,
      currentWeekDistribution,
      pendingVacationRequests,
      myVacationRequests,
      allApprovedVacations,
    ] = await Promise.all([
      // 1. Calendar Events - upcoming events (fetch more to allow social event prioritization)
      prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: now },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 10, // Fetch more to prioritize social events
      }),

      // 2. Work Items - user's active work items (assigneeId = current user, limit 10)
      prisma.workItem.findMany({
        where: {
          assigneeId: userId,
          status: { notIn: ['DONE', 'COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          clientName: true,
          caseNumber: true,
          createdAt: true,
          createdBy: {
            select: { name: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 10,
      }),

      // 3. Upcoming Vacations - approved vacations ending >= today (status: APPROVED, include user, limit 10)
      prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
          endDate: { gte: now },
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
        take: 10,
      }),

      // 3b. Upcoming Vacation Periods - periods ending >= today
      prisma.vacationPeriod.findMany({
        where: {
          endDate: { gte: now },
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
        take: 10,
      }),

      // 4. Feedback - unprocessed feedback (processed: false, include submittedBy, limit 5)
      prisma.feedback.findMany({
        where: {
          processed: false,
        },
        include: {
          submittedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // 5. Office Attendance - today's attendance (date = today, include user)
      prisma.officeAttendance.findMany({
        where: {
          date: today,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // 6. Tomorrow's Attendance - tomorrow's attendance (date = tomorrow, include user)
      prisma.officeAttendance.findMany({
        where: {
          date: tomorrow,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // 7. Vacation Balance - current user's balance (fetch regardless of year)
      prisma.vacationBalance.findUnique({
        where: {
          userId: userId,
        },
      }),

      // 8. Parental Leave - current user's parental leave
      prisma.parentalLeave.findMany({
        where: {
          userId: userId,
        },
        orderBy: { childNumber: 'asc' },
      }),

      // 9. Current User - current user info (name, role, email, birthDate, whatsNewDismissed)
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          birthDate: true,
          whatsNewDismissed: true,
        },
      }),

      // 10. Birthdays - all users with birthDate (select name, birthDate where birthDate not null)
      prisma.user.findMany({
        where: {
          isActive: true,
          birthDate: { not: null },
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 11. Newsletter Reminders - articles assigned to current user
      // Show if: deadline within 2 weeks, or reminder was manually pushed (and not dismissed)
      prisma.newsletterAssignment.findMany({
        where: {
          assigneeId: userId,
          status: 'PENDING',
          OR: [
            { deadline: { lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) } },
            { reminderPushedAt: { not: null }, reminderDismissed: false },
          ],
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { deadline: 'asc' },
      }),

      // 12. Newsletter Overview - ALL assignments for newsletter manager / partners / admins
      prisma.newsletterAssignment.findMany({
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { deadline: 'asc' },
      }),

      // 13. Check if current user is newsletter responsible
      prisma.responsibility.findFirst({
        where: {
          responsibleId: userId,
          task: { contains: 'nieuwsbrief', mode: 'insensitive' },
        },
      }),

      // 14. Next Training Session - first upcoming training
      prisma.trainingSession.findFirst({
        where: {
          date: { gte: now },
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          title: true,
          speaker: true,
          date: true,
          startTime: true,
          location: true,
          points: true,
        },
      }),

      // 15. Open Meeting Actions - for partners/admin dashboard widget
      prisma.meetingAction.findMany({
        where: { isCompleted: false },
        include: {
          week: {
            select: { id: true, dateLabel: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).catch(() => []),

      // 16. Work Distribution for current week - for employee widget
      prisma.meetingWeek.findFirst({
        where: {
          meetingDate: {
            gte: new Date(todayWork.getTime() - 3 * 24 * 60 * 60 * 1000), // within 3 days before
            lte: new Date(todayWork.getTime() + 3 * 24 * 60 * 60 * 1000), // within 3 days after
          },
        },
        include: {
          distributions: true,
        },
        orderBy: { meetingDate: 'desc' },
      }).catch(() => null),

      // 17. Pending Vacation Requests - for admin widget
      prisma.vacationRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              werkdagen: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),

      // 18. My Vacation Requests - for employee widget (last 90 days)
      prisma.vacationRequest.findMany({
        where: {
          userId: userId,
          createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).catch(() => []),

      // 19. All Approved Vacations - for overlap indicator in pending requests (admins only)
      prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
          endDate: { gte: now },
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { startDate: 'asc' },
      }).catch(() => []),
    ])

    // Calculate vacation balance totals for easier frontend use
    const defaultOpbouw = getDefaultVacationDays(currentUser?.role || 'EMPLOYEE')

    // If balance exists but is from a different year, still show it (with year indicator)
    // This prevents data from "disappearing" at year boundaries
    const vacationBalanceFormatted = vacationBalance
      ? {
          year: vacationBalance.year,
          overgedragenVorigJaar: vacationBalance.overgedragenVorigJaar,
          opbouwLopendJaar: vacationBalance.opbouwLopendJaar,
          bijgekocht: vacationBalance.bijgekocht,
          opgenomenLopendJaar: vacationBalance.opgenomenLopendJaar,
          totaalDagen:
            vacationBalance.overgedragenVorigJaar +
            vacationBalance.opbouwLopendJaar +
            vacationBalance.bijgekocht,
          resterend:
            vacationBalance.overgedragenVorigJaar +
            vacationBalance.opbouwLopendJaar +
            vacationBalance.bijgekocht -
            vacationBalance.opgenomenLopendJaar,
          hasBalance: true,
          needsYearUpdate: vacationBalance.year !== currentYear,
        }
      : {
          year: currentYear,
          overgedragenVorigJaar: 0,
          opbouwLopendJaar: defaultOpbouw,
          bijgekocht: 0,
          opgenomenLopendJaar: 0,
          totaalDagen: defaultOpbouw,
          resterend: defaultOpbouw,
          hasBalance: false,
          needsYearUpdate: false,
        }

    // Format office attendance for easier frontend use
    const { TOTAL_WORKPLACES } = OFFICE_CONFIG
    const officeAttendanceFormatted = {
      date: today,
      attendees: officeAttendance.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: a.user.name,
        avatarUrl: a.user.avatarUrl,
      })),
      totalWorkplaces: TOTAL_WORKPLACES,
      occupiedWorkplaces: officeAttendance.length,
      availableWorkplaces: TOTAL_WORKPLACES - officeAttendance.length,
      isCurrentUserAttending: officeAttendance.some((a) => a.userId === userId),
    }

    const tomorrowAttendanceFormatted = {
      date: tomorrow,
      attendees: tomorrowAttendance.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: a.user.name,
        avatarUrl: a.user.avatarUrl,
      })),
      totalWorkplaces: TOTAL_WORKPLACES,
      occupiedWorkplaces: tomorrowAttendance.length,
      availableWorkplaces: TOTAL_WORKPLACES - tomorrowAttendance.length,
      isCurrentUserAttending: tomorrowAttendance.some((a) => a.userId === userId),
    }

    // Format feedback with submittedBy name
    const feedbackFormatted = feedback.map((f) => ({
      ...f,
      submittedByName: f.submittedBy.name,
    }))

    // Combine vacation requests and periods for "who's away" widget
    const combinedUpcomingVacations = [
      ...upcomingVacations.map((v: any) => ({
        id: v.id,
        personName: v.user.name,
        startDate: v.startDate,
        endDate: v.endDate,
        note: v.reason,
        days: v.days,
        type: 'request' as const,
      })),
      ...upcomingVacationPeriods.map((p: any) => ({
        id: p.id,
        personName: p.user.name,
        startDate: p.startDate,
        endDate: p.endDate,
        note: p.note,
        days: p.days,
        type: 'period' as const,
      })),
    ].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10)

    // Prioritize SOCIAL events in calendar - ensure social event is shown first if available
    const socialEvents = calendarEvents.filter((e: any) => e.category === 'SOCIAL')
    const otherEvents = calendarEvents.filter((e: any) => e.category !== 'SOCIAL')
    const prioritizedEvents = socialEvents.length > 0
      ? [socialEvents[0], ...otherEvents.filter((e: any) => e.id !== socialEvents[0]?.id)].slice(0, 3)
      : calendarEvents.slice(0, 3)

    // Return all dashboard data in one response
    // Add cache headers: browser can cache for 30s, must revalidate after
    return NextResponse.json({
      calendarEvents: prioritizedEvents,
      workItems,
      upcomingVacations: combinedUpcomingVacations,
      feedback: feedbackFormatted,
      officeAttendance: officeAttendanceFormatted,
      tomorrowAttendance: tomorrowAttendanceFormatted,
      vacationBalance: vacationBalanceFormatted,
      parentalLeave: (parentalLeave as any[]).map(transformParentalLeaveForFrontend),
      currentUser,
      birthdays,
      newsletterReminders,
      // Newsletter overview for managers (Erika, partners, admins)
      newsletterOverview: (
        isNewsletterResponsible ||
        currentUser?.role === 'PARTNER' ||
        currentUser?.role === 'ADMIN'
      ) ? allNewsletterAssignments : null,
      isNewsletterManager: !!(
        isNewsletterResponsible ||
        currentUser?.role === 'PARTNER' ||
        currentUser?.role === 'ADMIN'
      ),
      nextTraining,
      // Notulen data
      openMeetingActions: (
        currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
      ) ? openMeetingActions : [],
      werkverdelingGesprek: currentWeekDistribution?.distributions?.find(
        (d: any) => d.employeeId === userId || d.employeeName === currentUser?.name
      ) ? {
        partnerName: currentWeekDistribution?.distributions?.find(
          (d: any) => d.employeeId === userId || d.employeeName === currentUser?.name
        )?.partnerName,
        weekDate: currentWeekDistribution?.meetingDate,
      } : null,
      // Vacation request data
      pendingVacationRequests: (
        currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER' || currentUser?.role === 'OFFICE_MANAGER'
      ) ? pendingVacationRequests : [],
      allApprovedVacations: (
        currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER' || currentUser?.role === 'OFFICE_MANAGER'
      ) ? allApprovedVacations : [],
      myVacationRequests: myVacationRequests,
      // Meta information
      fetchedAt: now.toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen dashboard summary' },
      { status: 500 }
    )
  }
}
