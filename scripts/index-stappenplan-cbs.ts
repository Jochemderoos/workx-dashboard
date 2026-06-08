// Eenmalig: indexeert de omzet-thresholds in 'stappenplan-partner' met
// CBS-cumulatief sinds 2022 (~21%) en rondt af naar boven op €5.000.

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

function loadEnv(file: string) {
  try {
    const c = fs.readFileSync(file, 'utf8')
    for (const line of c.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {}
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

const INDEX_FACTOR = 1.21 // CBS cumulatief 2022→mid-2026 (10.0 + 3.8 + 3.3 + ~3.0)

function roundUpTo5000(n: number): number {
  return Math.ceil(n / 5000) * 5000
}

function formatRange(s: string): string {
  // Match patterns als "€ 120.000 – 160.000" of "€ 40.000 – 60.000"
  const m = s.match(/€\s*([\d.]+)\s*[–-]\s*([\d.]+)/)
  if (!m) return s
  const low = parseInt(m[1].replace(/\./g, ''), 10)
  const high = parseInt(m[2].replace(/\./g, ''), 10)
  if (isNaN(low) || isNaN(high)) return s
  const lowIdx = roundUpTo5000(low * INDEX_FACTOR)
  const highIdx = roundUpTo5000(high * INDEX_FACTOR)
  const fmt = (n: number) => n.toLocaleString('nl-NL')
  return `€ ${fmt(lowIdx)} – ${fmt(highIdx)}`
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const policy = await prisma.editablePolicy.findUnique({
      where: { key: 'stappenplan-partner' },
    })
    if (!policy) {
      console.log('Geen stappenplan-partner policy gevonden in DB.')
      return
    }
    const data = JSON.parse(policy.content)
    if (!Array.isArray(data.steps)) {
      console.log('Onverwacht JSON-formaat — geen steps array.')
      return
    }
    console.log('Voor indexering:')
    for (const step of data.steps) {
      console.log(`  Stap ${step.id} ${step.naam}:`)
      console.log(`    Workx-omzet:  ${step.omzetWorkx}  →  ${formatRange(step.omzetWorkx)}`)
      console.log(`    Eigen omzet:  ${step.omzetEigen}  →  ${formatRange(step.omzetEigen)}`)
    }
    for (const step of data.steps) {
      step.omzetWorkx = formatRange(step.omzetWorkx)
      step.omzetEigen = formatRange(step.omzetEigen)
    }
    await prisma.editablePolicy.update({
      where: { key: 'stappenplan-partner' },
      data: { content: JSON.stringify(data) },
    })
    console.log('\n✓ Stappenplan bijgewerkt in DB.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
