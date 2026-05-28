import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnnouncementIcon } from '@/lib/announcement-icon'
import { getTipOfTheDay, tipKeyForDay } from '@/lib/wist-je-dat-tips'

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
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: 'zaak',
          title: 'Nieuwe zaak beschikbaar',
          message: `${assignment.zaak?.shortDescription || 'Nieuwe zaak'} - van ${assignment.zaak?.createdBy?.name || 'onbekend'}`,
          createdAt: assignment.createdAt,
          read: false,
          href: '/dashboard/werk',
        })
      }
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
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: 'vacation',
          title: isApproved ? 'Vakantie goedgekeurd' : 'Vakantie afgewezen',
          message: `Je verlofaanvraag voor ${new Date(request.startDate).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })} is ${isApproved ? 'goedgekeurd' : 'afgewezen'}`,
          createdAt: request.updatedAt,
          read: false,
          href: '/dashboard/vakanties',
        })
      }
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
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: 'calendar',
          title: 'Vandaag',
          message: `${event.title} om ${new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`,
          createdAt: now,
          read: false,
          href: '/dashboard/agenda',
        })
      }
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
        if (!dismissedKeys.has(key)) {
          notifications.push({
            id: key,
            type: 'feedback',
            title: 'Nieuwe feedback',
            message: `Er ${unprocessedFeedback === 1 ? 'is' : 'zijn'} ${unprocessedFeedback} nieuwe feedback item${unprocessedFeedback === 1 ? '' : 's'}`,
            createdAt: now,
            read: false,
            href: '/dashboard/feedback',
          })
        }
      }
    }

    // 5. Ingediende declaraties (for admins only - Hanna & Lotte)
    if (currentUser?.role === 'ADMIN') {
      const submittedDeclarations = await prisma.expenseDeclaration.findMany({
        where: { status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      })

      submittedDeclarations.forEach((decl) => {
        const key = `declaratie-${decl.id}`
        if (!dismissedKeys.has(key)) {
          const amount = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(decl.totalAmount || 0)
          notifications.push({
            id: key,
            type: 'declaratie',
            title: 'Declaratie ingediend',
            message: `${decl.employeeName} — ${amount}`,
            createdAt: decl.submittedAt || decl.createdAt,
            read: false,
            href: '/dashboard/declaraties',
          })
        }
      })
    }

    // 6b. Submitted bonuses (for ADMIN/PARTNER only) — gegroepeerd per medewerker
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER') {
      const submittedBonuses = await prisma.bonusCalculation.findMany({
        where: { status: 'SUBMITTED' },
        include: { user: { select: { name: true } } },
        orderBy: { submittedAt: 'desc' },
      })
      // Groepeer per medewerker, toon één notificatie met totaalbedrag
      const byEmployee = new Map<string, { name: string; total: number; count: number; latestDate: Date }>()
      submittedBonuses.forEach((bonus) => {
        const name = bonus.user.name
        const existing = byEmployee.get(name)
        if (existing) {
          existing.total += bonus.bonusAmount
          existing.count++
          if ((bonus.submittedAt || bonus.createdAt) > existing.latestDate) {
            existing.latestDate = bonus.submittedAt || bonus.createdAt
          }
        } else {
          byEmployee.set(name, { name, total: bonus.bonusAmount, count: 1, latestDate: bonus.submittedAt || bonus.createdAt })
        }
      })
      byEmployee.forEach((data, name) => {
        const key = `bonus-employee-${name}`
        if (!dismissedKeys.has(key)) {
          const amount = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.total)
          notifications.push({
            id: key,
            type: 'bonus',
            title: 'Bonus ingediend',
            message: `${name} — ${amount} (${data.count} facturen)`,
            createdAt: data.latestDate,
            read: false,
            href: '/dashboard/bonus',
          })
        }
      })
    }

    // 7. Werkverdelingsgesprekken - for current week
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
            if (!dismissedKeys.has(key)) {
              notifications.push({
                id: key,
                type: 'werkverdeling',
                title: 'Werkverdelingsgesprekken',
                message: `Je hebt nog ${remaining} werkverdelingsgesprek${remaining === 1 ? '' : 'ken'} in te plannen`,
                createdAt: currentWeek.meetingDate,
                read: false,
                href: '/dashboard',
              })
            }
          }
        } else {
          // Employee: notification per open conversation
          for (const d of currentWeek.distributions) {
            if (!d.employeeName) continue
            const names = d.employeeName.split(',').map((n: string) => n.trim())
            const userFirst = currentUser?.name?.split(' ')[0]?.toLowerCase() || ''
            const nameMatches = names.some((name: string) =>
              name === (currentUser?.name || '') || name.split(' ')[0].toLowerCase() === userFirst
            )
            if (!nameMatches && d.employeeId !== userId) continue

            const isComplete = completions.some(
              (c: any) => c.partnerName === d.partnerName && c.employeeId === userId
            )
            if (!isComplete) {
              const key = `werkverdeling-${currentWeek.id}-${d.partnerName}-${userId}`
              if (!dismissedKeys.has(key)) {
                notifications.push({
                  id: key,
                  type: 'werkverdeling',
                  title: 'Werkverdelingsgesprek',
                  message: `Plan je snel een gesprek in met ${d.partnerName}`,
                  createdAt: currentWeek.meetingDate,
                  read: false,
                  href: '/dashboard',
                })
              }
            }
          }
        }
      }
    }

    // 8. Overdracht notificaties — handovers met notifiedAt in afgelopen 7 dagen
    {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const notifiedHandovers = await prisma.handover.findMany({
        where: {
          notifiedAt: { gte: sevenDaysAgo },
          userId: { not: userId }, // Niet voor de maker zelf
        },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { notifiedAt: 'desc' },
        take: 5,
      })

      notifiedHandovers.forEach((handover) => {
        const key = `overdracht-${handover.id}`
        if (!dismissedKeys.has(key)) {
          const startStr = new Date(handover.periodStart).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
          const endStr = new Date(handover.periodEnd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
          notifications.push({
            id: key,
            type: 'overdracht',
            title: 'Overdrachtsdocument',
            message: `${handover.user.name} heeft een overdrachtsdocument klaargezet (${startStr} - ${endStr})`,
            createdAt: handover.notifiedAt!,
            read: false,
            href: '/dashboard/werk/overdracht',
          })
        }
      })
    }

    // 9. Lustrum verrassing — tijdelijke notificatie voor iedereen
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

    // 10. Werkstudent opdrachten herinnering — eenmalig voor iedereen
    {
      const key = 'werkstudent-opdrachten-2026'
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: 'system',
          title: '📋 Opdrachten voor werkstudent',
          message: 'Heb je taken voor de werkstudent? Voer ze in via de Werkstudent pagina zodat alles overzichtelijk blijft.',
          createdAt: new Date('2026-03-18'),
          read: false,
          href: '/dashboard/werkstudent',
        })
      }
    }

    // 12. Werkoverleg actiepunten reminder (elke maandag)
    if (now.getDay() === 1) {
      const werkoverlegKey = `werkoverleg-acties-${now.toISOString().split('T')[0]}`
      if (!dismissedKeys.has(werkoverlegKey)) {
        const openWerkoverlegActions = await prisma.werkoverlegAction.count({
          where: { isCompleted: false },
        })
        if (openWerkoverlegActions > 0) {
          notifications.push({
            id: werkoverlegKey,
            type: 'system',
            title: '📋 Werkoverleg actiepunten',
            message: `Er ${openWerkoverlegActions === 1 ? 'is' : 'zijn'} ${openWerkoverlegActions} openstaande actiepunt${openWerkoverlegActions === 1 ? '' : 'en'}. Check de actielijst voor morgen.`,
            createdAt: now,
            read: false,
            href: '/dashboard/werkoverleg',
          })
        }
      }
    }

    // 11. Light mode aankondiging — eenmalig voor iedereen
    {
      const key = 'light-mode-2026'
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: 'system',
          title: '☀️ Light Mode beschikbaar!',
          message: 'Het dashboard heeft nu een licht thema. Schakel het in via de toggle onderaan de sidebar.',
          createdAt: new Date('2026-03-17'),
          read: false,
          href: '/dashboard',
        })
      }
    }

    // 11. AI Assistent tips — uitgeschakeld (slaapstand)

    // 13. Team announcements (last 7 days)
    try {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const allAnnouncements = await prisma.teamAnnouncement.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        include: {
          sender: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      allAnnouncements.forEach((announcement) => {
        // Check if this user is a recipient
        let isRecipient = announcement.recipients === 'ALL'
        if (!isRecipient) {
          try {
            const ids = JSON.parse(announcement.recipients)
            isRecipient = Array.isArray(ids) && ids.includes(userId)
          } catch { /* ignore parse errors */ }
        }

        if (isRecipient) {
          const key = `announcement-${announcement.id}`
          if (!dismissedKeys.has(key)) {
            const icon =
              announcement.icon ||
              getAnnouncementIcon(announcement.message, announcement.priority)
            const title = announcement.title?.trim() || announcement.sender.name
            notifications.push({
              id: key,
              type: 'announcement',
              title,
              message: announcement.message,
              createdAt: announcement.createdAt,
              read: false,
              href: '/dashboard',
              icon,
              priority: announcement.priority,
              announcementId: announcement.id,
              senderId: announcement.senderId,
              senderName: announcement.sender.name,
            })
          }
        }
      })
    } catch (e) {
      // TeamAnnouncement table may not exist yet on prod — log and continue.
      console.warn('TeamAnnouncement query skipped:', (e as Error)?.message)
    }

    // 9a. Upload-reminders voor Hanna/Lotte/Jochem — periodieke nieuwe
    // uploads voor debiteuren (14 dgn), kosten (14 dgn) en uren (1 dg).
    // Key bevat de laatste upload-datum zodat:
    //  - na nieuwe upload de notificatie automatisch verdwijnt
    //  - dismissals niet eeuwig blijven hangen (volgende window krijgt
    //    een verse key)
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      const UPLOAD_REMINDER_NAMES = new Set([
        'Hanna Blaauboer',
        'Lotte van Sint Truiden',
        'Jochem de Roos',
      ])
      if (currentUser?.name && UPLOAD_REMINDER_NAMES.has(currentUser.name)) {
        const DAY_MS = 24 * 60 * 60 * 1000

        const pushUploadReminder = (cfg: {
          lastAt: Date | null
          windowDays: number
          keyPrefix: string
          title: string
          urgentTitle?: string
          baseMessage: string
          href: string
        }) => {
          const overdue = !cfg.lastAt || (now.getTime() - cfg.lastAt.getTime()) >= cfg.windowDays * DAY_MS
          if (!overdue) return
          const anchor = cfg.lastAt ? cfg.lastAt.toISOString().slice(0, 10) : 'never'
          const key = `${cfg.keyPrefix}-${anchor}`
          if (dismissedKeys.has(key)) return
          const daysSince = cfg.lastAt
            ? Math.floor((now.getTime() - cfg.lastAt.getTime()) / DAY_MS)
            : null
          const daysLabel = daysSince === null ? 'nooit eerder' : `${daysSince} dgn geleden`
          const useUrgent = daysSince !== null && daysSince >= cfg.windowDays * 2
          notifications.push({
            id: key,
            type: 'debiteuren',
            title: useUrgent && cfg.urgentTitle ? cfg.urgentTitle : cfg.title,
            message: `Laatste upload: ${daysLabel}. ${cfg.baseMessage}`,
            createdAt: now,
            read: false,
            href: cfg.href,
            priority: 'high',
          })
        }

        // Debiteuren — elke 14 dagen
        const lastInvoiceImport = await prisma.openInvoice.aggregate({
          _max: { importedAt: true },
        })
        pushUploadReminder({
          lastAt: lastInvoiceImport._max.importedAt,
          windowDays: 14,
          keyPrefix: 'upload-reminder-debiteuren',
          title: '⏰ Tijd voor nieuwe debiteuren-upload',
          urgentTitle: '🚨 Debiteuren-upload al langer dan 4 weken te laat',
          baseMessage: 'Upload de BaseNet-PDF zodat het team kan blijven aanschrijven.',
          href: '/dashboard/debiteuren',
        })

        // Kosten (MT940) — elke 14 dagen
        try {
          const lastCostUpload = await prisma.monthlyCost.aggregate({
            _max: { createdAt: true },
          })
          pushUploadReminder({
            lastAt: lastCostUpload._max.createdAt,
            windowDays: 14,
            keyPrefix: 'upload-reminder-kosten',
            title: '⏰ Tijd voor nieuwe kosten-upload',
            urgentTitle: '🚨 Kosten-upload al langer dan 4 weken te laat',
            baseMessage: 'Upload het MT940-bankafschrift zodat de kosten compleet blijven.',
            href: '/dashboard/kosten',
          })
        } catch {
          // tabel kan nog niet bestaan op eerste deploy
        }

        // Uren — elke dag
        try {
          const lastHoursUpload = await prisma.monthlyHours.aggregate({
            _max: { updatedAt: true },
          })
          pushUploadReminder({
            lastAt: lastHoursUpload._max.updatedAt,
            windowDays: 1,
            keyPrefix: 'upload-reminder-uren',
            title: '⏰ Uren bijwerken',
            urgentTitle: '🚨 Uren al meerdere dagen niet ge-update',
            baseMessage: 'Werk de maandelijkse uren bij zodat workload en bezetting up-to-date blijven.',
            href: '/dashboard/financien',
          })
        } catch {
          // tabel kan nog niet bestaan op eerste deploy
        }
      }
    } catch {
      // silent: user-lookup of openInvoice-tabel kan nog niet bestaan
    }

    // 9b. JAR-rooster reminder: huidige user heeft binnen 14 dagen
    // zijn/haar JAR-beurt. Match op voornaam.
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      const firstName = (currentUser?.name || '').split(' ')[0].toLowerCase()
      if (firstName) {
        const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        const upcoming = await prisma.jarSession.findMany({
          where: {
            date: { gte: now, lte: in14Days },
          },
          orderBy: { date: 'asc' },
        })
        for (const sess of upcoming) {
          const sessFirstName = sess.name.split(' ')[0].toLowerCase()
          if (sessFirstName !== firstName) continue
          const daysAway = Math.ceil((sess.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          const key = `jar-${sess.id}`
          if (dismissedKeys.has(key)) continue
          const dateLabel = sess.date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
          notifications.push({
            id: key,
            type: 'overdracht',
            title: daysAway <= 7 ? '⚖️ Jouw JAR-beurt komt eraan' : '📅 JAR-beurt over 2 weken',
            message: `Op ${dateLabel} bespreek je de JAR (Jurisprudentie Arbeidsrecht). Nog ${daysAway} ${daysAway === 1 ? 'dag' : 'dagen'}.`,
            createdAt: now,
            read: false,
            href: '/dashboard/opleidingen',
            priority: daysAway <= 7 ? 'high' : 'normal',
          })
        }
      }
    } catch {
      // silent — tabel kan nog niet bestaan
    }

    // 9. Openstaande debiteuren — herinnering om aan te schrijven
    // Verschijnt zolang er facturen open staan waar 14+ dagen niets mee is
    // gedaan (of nog nooit aangeschreven). Sluit zichzelf af zodra alle
    // due-facturen op 'Aangeschreven' zijn gezet.
    try {
      const dueInvoices = await prisma.openInvoice.findMany({
        where: { primaryUserId: userId },
        select: { id: true, reminderSentAt: true, totalIncl: true },
      })
      const reminderWindowMs = 14 * 24 * 60 * 60 * 1000
      const due = dueInvoices.filter(i =>
        !i.reminderSentAt || (now.getTime() - new Date(i.reminderSentAt).getTime()) >= reminderWindowMs
      )
      if (due.length > 0) {
        const totalDue = due.reduce((s, i) => s + i.totalIncl, 0)
        const totalLabel = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(totalDue)
        notifications.push({
          id: 'debiteuren-reminder',
          type: 'debiteuren',
          title: `${due.length} debiteur${due.length === 1 ? '' : 'en'} aanschrijven`,
          message: `Totaal ${totalLabel} · al 14+ dagen geen herinnering verstuurd`,
          createdAt: now,
          read: false,
          href: '/dashboard/debiteuren',
        })
      }
    } catch {
      // silent: tabel kan nog niet bestaan bij allereerste deploy
    }

    // 10. Wist je dat? — dagelijkse tip over een dashboard-pagina.
    // Partners krijgen ook partner-pagina's in de pool.
    try {
      const tipKey = tipKeyForDay(now)
      if (!dismissedKeys.has(tipKey)) {
        const isPartner = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
        const tip = getTipOfTheDay(isPartner, now)
        notifications.push({
          id: tipKey,
          type: 'tip',
          title: tip.title,
          message: tip.message,
          createdAt: now,
          read: false,
          href: tip.href,
          priority: 'low',
        })
      }
    } catch {
      // silent — tip is informatief, mag never fail
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
