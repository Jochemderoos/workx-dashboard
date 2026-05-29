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
async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const p = new PrismaClient()
  const months = await p.meetingMonth.findMany({
    where: { year: 2026, month: { in: [5, 6] } },
    include: { weeks: { orderBy: { meetingDate: 'asc' }, select: { id: true, meetingDate: true, dateLabel: true } } },
    orderBy: { month: 'asc' },
  })
  for (const m of months) {
    console.log(`\n[Month ${m.year}-${String(m.month).padStart(2,'0')}] ${m.label} (id=${m.id})`)
    for (const w of m.weeks) {
      const d = new Date(w.meetingDate)
      const realMonth = d.getMonth() + 1
      const flag = realMonth !== m.month ? ' ← MISMATCH' : ''
      console.log(`  ${w.dateLabel}  meetingDate=${d.toISOString().slice(0,10)} (real m=${realMonth})${flag}  id=${w.id}`)
    }
  }
  await p.$disconnect()
}
main().catch(e => console.error(e))
