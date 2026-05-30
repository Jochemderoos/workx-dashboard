// Cron: seed alle maandagen (partneroverleg) en dinsdagen (werkoverleg)
// voor het volgende kalenderjaar. Idempotent — bestaande records worden niet aangetast.
//
// Schedule: 1 december 08:00 NL (07:00 UTC) — geeft ~maand buffer
// voor het nieuwe jaar.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MONTH_LABELS = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

const PARTNER_STANDARD_TOPICS = [
  { title: 'Uren afgelopen week', sortOrder: 0, isStandard: true },
  { title: 'Werkverdeling partners', sortOrder: 1, isStandard: true },
]

const WERKOVERLEG_STANDARD_AGENDA = [
  { title: 'Wie kan er voorzitter zijn volgende week?', sortOrder: 1 },
  { title: 'Wie maakt de actielijst?', sortOrder: 2 },
  { title: 'Actielijst vorige week', sortOrder: 3 },
  { title: 'Terugkoppeling partneroverleg', sortOrder: 4 },
  { title: 'Ingebrachte onderwerpen', sortOrder: 5 },
  { title: 'WVTTK', sortOrder: 6 },
]

// Verzamel alle datums in een jaar waarop het de meegegeven weekdag is.
// targetDow: 1 = maandag, 2 = dinsdag, etc.
function allDatesForDow(year: number, targetDow: number): Date[] {
  const result: Date[] = []
  const d = new Date(Date.UTC(year, 0, 1, 12, 0, 0))
  while (d.getUTCDay() !== targetDow) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCFullYear() === year) {
    result.push(new Date(d))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return result
}

function nlDateLabel(d: Date): string {
  const s = d.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function seedPartnerMondays(year: number) {
  const mondays = allDatesForDow(year, 1)
  const existing = await prisma.meetingWeek.findMany({
    where: { meetingDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    select: { meetingDate: true },
  })
  const existingDates = new Set(existing.map(w => new Date(w.meetingDate).toISOString().slice(0, 10)))

  const monthCache = new Map<number, string>()
  let created = 0, skipped = 0

  for (const monday of mondays) {
    const ymd = monday.toISOString().slice(0, 10)
    if (existingDates.has(ymd)) { skipped++; continue }
    const month = monday.getUTCMonth() + 1

    let monthId = monthCache.get(month)
    if (!monthId) {
      const m = await prisma.meetingMonth.upsert({
        where: { year_month_isLustrum: { year, month, isLustrum: false } },
        update: {},
        create: { year, month, label: `${MONTH_LABELS[month]} ${year}`, isLustrum: false },
      })
      monthId = m.id
      monthCache.set(month, monthId)
    }

    await prisma.meetingWeek.create({
      data: {
        monthId,
        meetingDate: monday,
        dateLabel: `Maandag ${monday.getUTCDate()} ${MONTH_LABELS[month].toLowerCase()} ${year}`,
        topics: { create: PARTNER_STANDARD_TOPICS },
      },
    })
    created++
  }
  return { created, skipped }
}

async function seedWerkoverlegTuesdays(year: number) {
  const tuesdays = allDatesForDow(year, 2)
  const existing = await prisma.werkoverlegDay.findMany({
    where: { meetingDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    select: { meetingDate: true },
  })
  const existingDates = new Set(existing.map(d => new Date(d.meetingDate).toISOString().slice(0, 10)))

  let created = 0, skipped = 0
  for (const tuesday of tuesdays) {
    const ymd = tuesday.toISOString().slice(0, 10)
    if (existingDates.has(ymd)) { skipped++; continue }
    await prisma.werkoverlegDay.create({
      data: {
        meetingDate: tuesday,
        dateLabel: nlDateLabel(tuesday),
        agendaItems: { create: WERKOVERLEG_STANDARD_AGENDA },
      },
    })
    created++
  }
  return { created, skipped }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Bepaal welk jaar te seeden:
    // - Als ?year= meegegeven (handmatige trigger), gebruik die
    // - Anders: huidige jaar + 1 (we draaien dit ergens dec)
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const targetYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() + 1

    if (!targetYear || isNaN(targetYear) || targetYear < 2026 || targetYear > 2099) {
      return NextResponse.json({ error: 'Ongeldig jaar' }, { status: 400 })
    }

    const partner = await seedPartnerMondays(targetYear)
    const werk = await seedWerkoverlegTuesdays(targetYear)

    return NextResponse.json({
      ok: true,
      year: targetYear,
      partneroverleg: partner,
      werkoverleg: werk,
    })
  } catch (error) {
    console.error('Error in seed-meetings-next-year cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
