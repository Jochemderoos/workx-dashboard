// Cron: wekelijkse persoonlijke Slack-digest (maandagochtend).
//
// Per actieve user verzamelen we wat er deze week voor diegene relevant is.
// REGEL: zonder concrete inhoud niets versturen.
// Als een persoon 0 items heeft → die persoon krijgt geen DM ("hi, niks!" is afbreuk).
//
// Schedule: maandag 09:00 NL (07:00 UTC zomer; in winter wordt het 08:00 NL)
// Push voor JAR-beurt blijft via /api/notifications werken; deze digest is alleen Slack.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

interface DigestItem {
  text: string
  href?: string // optioneel — celebratoire items (verjaardag/jubileum) hebben geen link
  linkLabel?: string // tekst voor de inline-link, default "Open →"
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function todayMMDD(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function endOfWeek(now: Date): Date {
  // Maandag-tot-zondag week (NL-conventie)
  const d = startOfDay(now)
  const dow = d.getDay() // 0=zo, 1=ma
  const daysToSunday = dow === 0 ? 0 : 7 - dow
  d.setDate(d.getDate() + daysToSunday)
  d.setHours(23, 59, 59, 999)
  return d
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    const today = startOfDay(now)
    const inWeek = endOfWeek(now)
    const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] } },
      select: {
        id: true,
        email: true,
        name: true,
        birthDate: true,
        startDate: true,
      },
    })

    // Eenmalig: alle jarigen deze week (voor "jouw collega is jarig"-items)
    // We rapen alle birthDates die binnen de huidige week vallen.
    const allBirthdaysThisWeek: Array<{ name: string; mmdd: string }> = []
    {
      const usersWithBirth = await prisma.user.findMany({
        where: { isActive: true, birthDate: { not: null } },
        select: { name: true, birthDate: true },
      })
      const start = startOfDay(now)
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        const mmdd = todayMMDD(d)
        for (const u of usersWithBirth) {
          if (u.birthDate === mmdd) {
            allBirthdaysThisWeek.push({ name: u.name, mmdd })
          }
        }
      }
    }

    let sent = 0
    let skipped = 0
    let failed = 0
    const errors: Array<{ user: string; err: string }> = []

    for (const u of users) {
      const items: DigestItem[] = []

      // 1. JAR-beurt in komende 30 dagen — match op voornaam
      try {
        const first = u.name.split(' ')[0].toLowerCase()
        const upcomingJar = await prisma.jarSession.findMany({
          where: { date: { gte: today, lte: in30Days } },
          orderBy: { date: 'asc' },
        })
        for (const s of upcomingJar) {
          if (s.name.split(' ')[0].toLowerCase() !== first) continue
          const daysAway = Math.ceil((s.date.getTime() - today.getTime()) / 86400000)
          items.push({
            text: `Jouw JAR-beurt is over ${daysAway} ${daysAway === 1 ? 'dag' : 'dagen'} (${fmtShort(s.date)}).`,
            href: '/dashboard/opleidingen',
            linkLabel: 'JAR-rooster',
          })
        }
      } catch {}

      // 2. Openstaande debiteuren — alleen die >= 15 dagen verlopen + niet aangeschreven
      try {
        const invs = await prisma.openInvoice.findMany({
          where: { primaryUserId: u.id, reminderSentAt: null },
          select: { id: true, dueDate: true, totalIncl: true, bookYear: true, bookPeriod: true },
        })
        const overdue = invs.filter(i => {
          const due = i.dueDate ? new Date(i.dueDate) : new Date(i.bookYear, i.bookPeriod, 0)
          const days = Math.floor((today.getTime() - due.getTime()) / 86400000)
          return days >= 15
        })
        if (overdue.length > 0) {
          const total = overdue.reduce((s, i) => s + i.totalIncl, 0)
          items.push({
            text: `*${overdue.length} debiteur${overdue.length === 1 ? '' : 'en'}* te aanschrijven — *${fmtEUR(total)}* totaal openstaand.`,
            href: '/dashboard/debiteuren',
            linkLabel: 'Debiteuren',
          })
        }
      } catch {}

      // 3. Nieuwsbrief deadline binnen 14 dagen
      try {
        const newsItems = await prisma.newsletterAssignment.findMany({
          where: {
            assigneeId: u.id,
            status: 'PENDING',
            deadline: { gte: today, lte: in14Days },
          },
          orderBy: { deadline: 'asc' },
        })
        for (const n of newsItems) {
          const daysAway = Math.ceil((new Date(n.deadline).getTime() - today.getTime()) / 86400000)
          const topic = n.topic ? `: "${n.topic}"` : ''
          items.push({
            text: `Nieuwsbrief-artikel${topic} — deadline *${fmtShort(new Date(n.deadline))}* (over ${daysAway} ${daysAway === 1 ? 'dag' : 'dagen'}).`,
            href: '/dashboard/werk',
            linkLabel: 'Wie doet Wat',
          })
        }
      } catch {}

      // 4. Vakantieaanvraag PENDING (eigen, ouder dan 3 dagen)
      try {
        const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
        const pending = await prisma.vacationRequest.findMany({
          where: { userId: u.id, status: 'PENDING', createdAt: { lte: threeDaysAgo } },
          orderBy: { startDate: 'asc' },
        })
        for (const v of pending) {
          items.push({
            text: `Vakantieaanvraag *${fmtShort(v.startDate)} – ${fmtShort(v.endDate)}* wacht nog op goedkeuring.`,
            href: '/dashboard/vakanties',
            linkLabel: 'Vakanties',
          })
        }
      } catch {}

      // 5. Persoonlijke taken met dueDate binnen 7 dagen
      try {
        const inWeekDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        const tasks = await prisma.personalTask.findMany({
          where: { userId: u.id, dueDate: { gte: today, lte: inWeekDate } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        })
        if (tasks.length > 0) {
          if (tasks.length === 1) {
            const t = tasks[0]
            items.push({
              text: `Taak deze week: *${t.title}*${t.dueDate ? ` (${fmtShort(t.dueDate)})` : ''}.`,
              href: '/dashboard/eigen-taken',
              linkLabel: 'Eigen taken',
            })
          } else {
            items.push({
              text: `*${tasks.length}* eigen taken met deadline deze week.`,
              href: '/dashboard/eigen-taken',
              linkLabel: 'Eigen taken',
            })
          }
        }
      } catch {}

      // 6. Coaching-budget periode loopt af binnen 30 dagen
      try {
        const cb = await prisma.coachingBudget.findUnique({ where: { userId: u.id } })
        if (cb) {
          const periodEnd = new Date(cb.periodStart)
          periodEnd.setFullYear(periodEnd.getFullYear() + 3)
          const daysToEnd = Math.floor((periodEnd.getTime() - today.getTime()) / 86400000)
          const remaining = Math.max(0, 1500 - cb.usedAmount)
          if (daysToEnd <= 30 && daysToEnd >= 0 && remaining > 0) {
            items.push({
              text: `Coaching-budget loopt over ${daysToEnd} ${daysToEnd === 1 ? 'dag' : 'dagen'} af — nog *${fmtEUR(remaining)}* te besteden.`,
              href: '/dashboard/arbeidsvoorwaarden',
              linkLabel: 'Mijn coachingbudget',
            })
          }
        }
      } catch {}

      // 7. Bonus DRAFT openstaand (niet ingediend)
      try {
        const drafts = await prisma.bonusCalculation.count({
          where: { userId: u.id, status: 'DRAFT' },
        })
        if (drafts > 0) {
          items.push({
            text: `*${drafts}* bonus${drafts === 1 ? '' : 'sen'} in concept — vergeet niet in te dienen bij Hanna.`,
            href: '/dashboard/bonus',
            linkLabel: 'Bonus',
          })
        }
      } catch {}

      // 8. Jouw verjaardag deze week — celebratory, geen link
      if (u.birthDate) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() + i)
          if (todayMMDD(d) === u.birthDate) {
            const label = i === 0 ? 'vandaag' : i === 1 ? 'morgen' : `op ${fmtDate(d)}`
            items.push({
              text: `Jij bent ${label} jarig — gefeliciteerd alvast namens het hele team!`,
            })
            break
          }
        }
      }

      // 9. Jubileum 5 / 10 / 15 jaar in dienst deze week — celebratory, geen link
      if (u.startDate) {
        const sd = new Date(u.startDate)
        for (let i = 0; i < 7; i++) {
          const check = new Date(today)
          check.setDate(check.getDate() + i)
          if (check.getMonth() === sd.getMonth() && check.getDate() === sd.getDate()) {
            const yearsInService = check.getFullYear() - sd.getFullYear()
            if ([5, 10, 15, 20, 25].includes(yearsInService)) {
              const label = i === 0 ? 'vandaag' : i === 1 ? 'morgen' : `op ${fmtDate(check)}`
              items.push({
                text: `Je bent ${label} *${yearsInService} jaar* in dienst bij Workx — gefeliciteerd!`,
              })
            }
            break
          }
        }
      }

      // 10. Jarige collega's deze week (exclusief jezelf) — celebratory, geen link
      const collegaJarigen = allBirthdaysThisWeek.filter(b => b.name !== u.name)
      if (collegaJarigen.length > 0) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() + i)
          const mmdd = todayMMDD(d)
          const heuteJarig = collegaJarigen.filter(b => b.mmdd === mmdd)
          for (const j of heuteJarig) {
            const label = i === 0 ? 'vandaag' : i === 1 ? 'morgen' : fmtDate(d)
            items.push({
              text: `*${j.name}* is ${label} jarig.`,
            })
          }
        }
      }

      // Geen items → die persoon overslaan
      if (items.length === 0) {
        skipped++
        continue
      }

      // Bouw Slack blocks
      const firstName = u.name.split(' ')[0]
      const itemLines = items.map(i =>
        i.href
          ? `•  ${i.text}  <${DASHBOARD_BASE}${i.href}|${i.linkLabel || 'Openen'}>`
          : `•  ${i.text}`
      ).join('\n')

      const blocks: any[] = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `Goedemorgen ${firstName}, dit speelt deze week voor jou:` },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: itemLines },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Wekelijkse digest · alleen verstuurd als er iets is.` },
          ],
        },
      ]

      const fallback = `Goedemorgen ${firstName}, ${items.length} ${items.length === 1 ? 'item' : 'items'} deze week — ${DASHBOARD_BASE}/dashboard`

      try {
        const ok = await sendDirectMessage(u.email, fallback, blocks)
        if (ok) sent++
        else { failed++; errors.push({ user: u.email, err: 'send returned false' }) }
      } catch (e: any) {
        failed++
        errors.push({ user: u.email, err: e?.message || String(e) })
      }
    }

    return NextResponse.json({
      ok: true,
      processed: users.length,
      sent,
      skipped,
      failed,
      errors: errors.slice(0, 5),
    })
  } catch (error) {
    console.error('Error in weekly-personal-digest cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
