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
  const topics = await p.meetingTopic.findMany({
    where: { title: { contains: 'Lodewijk', mode: 'insensitive' } },
    include: { week: { select: { dateLabel: true, month: { select: { label: true, year: true, month: true } } } } },
  })
  console.log(`Gevonden: ${topics.length} topics met "Lodewijk"`)
  for (const t of topics.slice(0, 20)) {
    console.log(`  [${t.week.month.label}] ${t.week.dateLabel}: "${t.title}"  id=${t.id}`)
  }
  await p.$disconnect()
}
main()
