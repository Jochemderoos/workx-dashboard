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
  // Standaard-Lodewijk-items zonder remarks veilig opruimen
  const targets = await p.meetingTopic.findMany({
    where: {
      isStandard: true,
      title: { contains: 'Lodewijk', mode: 'insensitive' },
      OR: [{ remarks: null }, { remarks: '' }],
    },
  })
  console.log(`${targets.length} standaard Lodewijk-topics te verwijderen`)
  for (const t of targets) console.log(`  - "${t.title}" id=${t.id}`)
  if (targets.length > 0) {
    await p.meetingTopic.deleteMany({ where: { id: { in: targets.map(t => t.id) } } })
    console.log('Verwijderd.')
  }
  await p.$disconnect()
}
main()
