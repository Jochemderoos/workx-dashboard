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
    const updated = await p.user.update({
      where: { email: 'jochem.deroos@workxadvocaten.nl' },
      data: { birthDate: '03-02' }, // MM-DD: 2 maart
    })
    console.log(`Verjaardag bijgewerkt voor ${updated.name}: ${updated.birthDate}`)
  } finally {
    await p.$disconnect()
  }
}
main()
