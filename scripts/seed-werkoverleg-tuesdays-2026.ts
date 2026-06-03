// Seed: alle dinsdagen 2026 als werkoverleg-dag (WerkoverlegDay).
// Idempotent — als er al een day op die datum bestaat, skip.
// Bakt standaard agenda-items mee (zelfde set als POST /api/werkoverleg).

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
const STANDARD_AGENDA = [
  { title: 'Wie kan er voorzitter zijn volgende week?', sortOrder: 1 },
  { title: 'Wie maakt de actielijst?', sortOrder: 2 },
  { title: 'Actielijst vorige week', sortOrder: 3 },
  { title: 'Terugkoppeling partneroverleg', sortOrder: 4 },
  { title: 'Ingebrachte onderwerpen', sortOrder: 5 },
  { title: 'WVTTK', sortOrder: 6 },
]

function allTuesdays(year: number): Date[] {
  const result: Date[] = []
  const d = new Date(Date.UTC(year, 0, 1, 12, 0, 0))
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCFullYear() === year) {
    result.push(new Date(d))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return result
}

function dateLabel(d: Date): string {
  const s = d.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const p = new PrismaClient()
  try {
    const tuesdays = allTuesdays(YEAR)
    console.log(`${tuesdays.length} dinsdagen in ${YEAR}`)

    const existing = await p.werkoverlegDay.findMany({
      where: {
        meetingDate: { gte: new Date(`${YEAR}-01-01`), lt: new Date(`${YEAR + 1}-01-01`) },
      },
      select: { meetingDate: true },
    })
    const existingDates = new Set(existing.map(d => new Date(d.meetingDate).toISOString().slice(0, 10)))

    let created = 0
    let skipped = 0

    for (const tuesday of tuesdays) {
      const ymd = tuesday.toISOString().slice(0, 10)
      if (existingDates.has(ymd)) { skipped++; continue }
      await p.werkoverlegDay.create({
        data: {
          meetingDate: tuesday,
          dateLabel: dateLabel(tuesday),
          agendaItems: { create: STANDARD_AGENDA },
        },
      })
      created++
    }

    console.log(`\nKlaar: ${created} dinsdagen aangemaakt, ${skipped} bestonden al.`)
  } finally {
    await p.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
