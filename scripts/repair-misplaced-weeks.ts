// Repair: vindt MeetingWeek-records die in een verkeerde MeetingMonth zitten
// (omdat meetingDate door timezone-shift in een andere maand viel) en
// verplaatst ze naar de juiste maand. Maakt MeetingMonth aan als die ontbreekt.
//
// We bepalen de "echte" maand op basis van dateLabel ("Maandag 1 juni 2026"),
// niet op meetingDate (die kan timezone-shifted zijn).

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

const MONTH_NAMES_NL: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
}
const MONTH_LABELS = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

// "Maandag 1 juni 2026" -> { year:2026, month:6, day:1 }
function parseDateLabel(label: string): { year: number; month: number; day: number } | null {
  const m = label.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = MONTH_NAMES_NL[m[2].toLowerCase()]
  const year = parseInt(m[3], 10)
  if (!month) return null
  return { year, month, day }
}

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const p = new PrismaClient()
  try {
    const allMonths = await p.meetingMonth.findMany({
      where: { isLustrum: false },
      include: { weeks: { select: { id: true, monthId: true, meetingDate: true, dateLabel: true } } },
    })

    const cache = new Map<string, string>() // "YYYY-MM" -> monthId
    for (const m of allMonths) cache.set(`${m.year}-${String(m.month).padStart(2, '0')}`, m.id)

    let moved = 0
    let createdMonths = 0
    let fixedDates = 0

    for (const m of allMonths) {
      for (const w of m.weeks) {
        const parsed = parseDateLabel(w.dateLabel)
        if (!parsed) continue

        const expectedKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
        let targetMonthId = cache.get(expectedKey)

        if (!targetMonthId) {
          const newMonth = await p.meetingMonth.upsert({
            where: { year_month_isLustrum: { year: parsed.year, month: parsed.month, isLustrum: false } },
            update: {},
            create: {
              year: parsed.year,
              month: parsed.month,
              label: `${MONTH_LABELS[parsed.month]} ${parsed.year}`,
              isLustrum: false,
            },
          })
          targetMonthId = newMonth.id
          cache.set(expectedKey, targetMonthId)
          createdMonths++
          console.log(`+ MeetingMonth aangemaakt: ${MONTH_LABELS[parsed.month]} ${parsed.year}`)
        }

        const realDateUTC = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0))
        const dateNeedsFix = new Date(w.meetingDate).getUTCDate() !== parsed.day ||
          new Date(w.meetingDate).getUTCMonth() + 1 !== parsed.month ||
          new Date(w.meetingDate).getUTCFullYear() !== parsed.year

        const monthNeedsMove = w.monthId !== targetMonthId

        if (monthNeedsMove || dateNeedsFix) {
          await p.meetingWeek.update({
            where: { id: w.id },
            data: { monthId: targetMonthId, meetingDate: realDateUTC },
          })
          if (monthNeedsMove) {
            moved++
            console.log(`→ "${w.dateLabel}" verplaatst naar ${MONTH_LABELS[parsed.month]} ${parsed.year}`)
          }
          if (dateNeedsFix) {
            fixedDates++
            console.log(`  meetingDate gecorrigeerd: was ${new Date(w.meetingDate).toISOString()}, nu ${realDateUTC.toISOString()}`)
          }
        }
      }
    }

    console.log(`\nKlaar — ${moved} weeks verplaatst, ${fixedDates} datums gecorrigeerd, ${createdMonths} maanden toegevoegd.`)
  } finally {
    await p.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
