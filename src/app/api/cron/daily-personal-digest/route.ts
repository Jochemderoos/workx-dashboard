// Cron: dagstart-DM per persoon, alleen als ≥2 substantiële items vandaag.
// Substantieel = items die om actie vragen (geen "informatief").
//
// Items:
//  - JAR-beurt vandaag
//  - Persoonlijke taak met deadline vandaag
//  - Vakantieaanvraag PENDING ouder dan 3 dagen (eigen)
//  - Openstaande debiteuren ≥15 dgn niet aangeschreven
//  - Bonus DRAFT openstaand
//
// Schedule: dinsdag-vrijdag 08:00 NL (06:00 UTC zomertijd).
// Maandag skip — weekly-digest dekt dat al.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
const SUBSTANTIAL_THRESHOLD = 2

interface DigestItem {
  text: string
  href?: string
  linkLabel?: string
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDateNL(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    const dow = now.getDay()
    if (dow === 0 || dow === 1 || dow === 6) {
      return NextResponse.json({ skipped: `dow=${dow}` })
    }

    const today = startOfDay(now)
    const tomorrow = new Date(today.getTime() + 86400000)
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000)

    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] } },
      select: { id: true, email: true, name: true },
    })

    let sent = 0
    let skipped = 0

    for (const u of users) {
      const items: DigestItem[] = []

      // 1. JAR vandaag (match op voornaam)
      try {
        const first = u.name.split(' ')[0].toLowerCase()
        const jars = await prisma.jarSession.findMany({
          where: { date: { gte: today, lt: tomorrow } },
        })
        for (const s of jars) {
          if (s.name.split(' ')[0].toLowerCase() !== first) continue
          items.push({
            text: `*JAR vandaag* — jij bereidt voor.`,
            href: '/dashboard/opleidingen',
            linkLabel: 'JAR-rooster',
          })
        }
      } catch {}

      // 2. Persoonlijke taak met deadline vandaag
      try {
        const tasks = await prisma.personalTask.findMany({
          where: { userId: u.id, dueDate: { gte: today, lt: tomorrow } },
          take: 5,
        })
        if (tasks.length === 1) {
          items.push({ text: `Taak vandaag: *${tasks[0].title}*.`, href: '/dashboard/eigen-taken', linkLabel: 'Eigen taken' })
        } else if (tasks.length > 1) {
          items.push({ text: `*${tasks.length}* taken met deadline vandaag.`, href: '/dashboard/eigen-taken', linkLabel: 'Eigen taken' })
        }
      } catch {}

      // 3. Vakantieaanvraag PENDING > 3 dagen
      try {
        const pending = await prisma.vacationRequest.findMany({
          where: { userId: u.id, status: 'PENDING', createdAt: { lte: threeDaysAgo } },
        })
        for (const v of pending) {
          items.push({
            text: `Vakantieaanvraag *${fmtDateNL(v.startDate)}–${fmtDateNL(v.endDate)}* wacht nog op goedkeuring.`,
            href: '/dashboard/vakanties',
            linkLabel: 'Vakanties',
          })
        }
      } catch {}

      // 4. Debiteuren ≥15 dgn niet aangeschreven
      try {
        const invs = await prisma.openInvoice.findMany({
          where: { primaryUserId: u.id, reminderSentAt: null },
          select: { dueDate: true, totalIncl: true, bookYear: true, bookPeriod: true },
        })
        const overdue = invs.filter(i => {
          const due = i.dueDate ? new Date(i.dueDate) : new Date(i.bookYear, i.bookPeriod, 0)
          return Math.floor((today.getTime() - due.getTime()) / 86400000) >= 15
        })
        if (overdue.length > 0) {
          const total = overdue.reduce((s, i) => s + i.totalIncl, 0)
          items.push({
            text: `*${overdue.length} debiteur${overdue.length === 1 ? '' : 'en'}* te aanschrijven — *${fmtEUR(total)}*.`,
            href: '/dashboard/debiteuren',
            linkLabel: 'Debiteuren',
          })
        }
      } catch {}

      // 5. Bonus DRAFT
      try {
        const drafts = await prisma.bonusCalculation.count({ where: { userId: u.id, status: 'DRAFT' } })
        if (drafts > 0) {
          items.push({
            text: `*${drafts}* bonus${drafts === 1 ? '' : 'sen'} in concept — vergeet niet in te dienen.`,
            href: '/dashboard/bonus',
            linkLabel: 'Bonus',
          })
        }
      } catch {}

      // Threshold check
      if (items.length < SUBSTANTIAL_THRESHOLD) {
        skipped++
        continue
      }

      const firstName = u.name.split(' ')[0]
      const lines = items.map(i =>
        i.href ? `•  ${i.text}  <${DASHBOARD_BASE}${i.href}|${i.linkLabel || 'Openen'}>` : `•  ${i.text}`
      ).join('\n')

      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `Goedemorgen ${firstName}, dit speelt vandaag voor jou:` } },
        { type: 'section', text: { type: 'mrkdwn', text: lines } },
        { type: 'divider' },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `Dagstart · alleen verstuurd als er meerdere dingen tegelijk spelen.` }] },
      ]
      const fallback = `Dagstart ${firstName} — ${items.length} items`
      try {
        const ok = await sendDirectMessage(u.email, fallback, blocks)
        if (ok) sent++
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      processed: users.length,
      sent,
      skipped,
    })
  } catch (error) {
    console.error('Error in daily-personal-digest cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
