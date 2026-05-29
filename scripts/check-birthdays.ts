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
import { PrismaClient } from '@prisma/client'

async function main() {
  const p = new PrismaClient()
  try {
    const users = await p.user.findMany({
      where: { isActive: true },
      select: { name: true, birthDate: true, startDate: true },
      orderBy: { name: 'asc' },
    })
    let filled = 0
    let empty = 0
    for (const u of users) {
      if (u.birthDate) { filled++; console.log(`✓ ${u.name}: ${u.birthDate}`) }
      else { empty++; console.log(`  ${u.name}: -`) }
    }
    console.log(`\n${filled}/${users.length} met geboortedatum, ${empty} leeg`)
  } finally { await p.$disconnect() }
}
main()
