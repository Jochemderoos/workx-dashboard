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
  const items = await p.meetingTopic.findMany({
    where: { title: { contains: '16u afspraak', mode: 'insensitive' } },
  })
  for (const t of items) {
    console.log(`id=${t.id} title="${t.title}" remarks="${t.remarks || '(leeg)'}" isStandard=${t.isStandard ?? 'n/a'}`)
  }
  await p.$disconnect()
}
main()
