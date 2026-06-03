// Seed: alle maandagen 2026 als partneroverleg-week (MeetingWeek).
// Idempotent — als een week op die datum al bestaat, skippen.
// Maakt MeetingMonth aan waar nodig.

import { readFileSync } from 'fs'
import { resolve } from 'path'
try {
  const txt = readFileSync(resolve('.env'), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
} catch {}

const YEAR = 2026
const MONTH_LABELS = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
const STANDARD_TOPICS = [
  { title: 'Uren afgelopen week', sortOrder: 0, isStandard: true },
  { title: 'Werkverdeling partners', sortOrder: 1, isStandard: true },
]

function allMondays(year: number): Date[] {
  const result: Date[] = []
  const d = new Date(Date.UTC(year, 0, 1, 12, 0, 0))
  // Vooruit tot eerste maandag
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCFullYear() === year) {
    result.push(new Date(d))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return result
}

function dateLabel(d: Date): string {
  return `Maandag ${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth() + 1].toLowerCase()} ${d.getUTCFullYear()}`
}

export async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const p = new PrismaClient()
  try {
    const mondays = allMondays(YEAR)
    console.log(`${mondays.length} maandagen in ${YEAR}`)

    // Cache van bestaande weeks per YYYY-MM-DD
    const existing = await p.meetingWeek.findMany({
      where: { meetingDate: { gte: new Date(`${YEAR}-01-01`), lt: new Date(`${YEAR + 1}-01-01`) } },
      select: { meetingDate: true },
    })
    const existingDates = new Set(existing.map(w => new Date(w.meetingDate).toISOString().slice(0, 10)))

    let created = 0
    let skipped = 0
    let createdMonths = 0
    const monthCache = new Map<string, string>()

    for (const monday of mondays) {
      const ymd = monday.toISOString().slice(0, 10)
      if (existingDates.has(ymd)) { skipped++; continue }

      const year = monday.getUTCFullYear()
      const month = monday.getUTCMonth() + 1
      const monthKey = `${year}-${month}`

      let monthId = monthCache.get(monthKey)
      if (!monthId) {
        const m = await p.meetingMonth.upsert({
          where: { year_month_isLustrum: { year, month, isLustrum: false } },
          update: {},
          create: { year, month, label: `${MONTH_LABELS[month]} ${year}`, isLustrum: false },
        })
        if (m.createdAt.getTime() > Date.now() - 5000) createdMonths++
        monthId = m.id
        monthCache.set(monthKey, monthId)
      }

      await p.meetingWeek.create({
        data: {
          monthId,
          meetingDate: monday,
          dateLabel: dateLabel(monday),
          topics: { create: STANDARD_TOPICS },
        },
      })
      created++
    }

    console.log(`\nKlaar:`)
    console.log(`  ${created} weeks aangemaakt`)
    console.log(`  ${skipped} weeks bestonden al`)
    console.log(`  ${createdMonths} nieuwe maanden`)
  } finally {
    await p.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
