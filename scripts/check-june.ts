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
  const june = await p.meetingMonth.findUnique({ where: { year_month_isLustrum: { year: 2026, month: 6, isLustrum: false } } })
  console.log('Juni 2026 month bestaat?', !!june, june)
  await p.$disconnect()
}
main()
