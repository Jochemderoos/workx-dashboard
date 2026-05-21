// Eenmalig: lees het MT940-bestand, parse via parseMT940 en schrijf het
// resultaat naar data/mt940-2025.json. Deze JSON wordt later door
// scripts/seed-monthly-costs-2025.ts ingelezen om de records in de DB
// te seeden (idempotent via externalRef).

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { parseMT940 } from '../src/lib/parse-mt940'

const inputPath = process.argv[2] || 'C:/Users/quiri/Downloads/MT940260521203054.STA'
const outPath = 'data/mt940-2025.json'

const raw = readFileSync(inputPath, 'utf8')
const txs = parseMT940(raw)

// Bewaar alleen 2025 (mocht het bestand er meer bevatten)
const txs2025 = txs.filter(t => t.date.getFullYear() === 2025)

const out = txs2025.map(t => ({
  date: t.date.toISOString().slice(0, 10),
  year: t.date.getFullYear(),
  month: t.date.getMonth() + 1,
  amount: t.amount,
  description: t.description,
  rawKey: t.rawKey,
  externalRef: t.externalRef,
  category: t.category ?? null,
}))

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(out, null, 2))

const total = out.reduce((s, t) => s + t.amount, 0)
const mgmt = out.filter(t => t.description.startsWith('Management fee'))
console.log(`[dump-mt940-2025] ${out.length} transacties → ${outPath}`)
console.log(`  Totaal: €${total.toFixed(2)}`)
console.log(`  Management fee posten: ${mgmt.length} (€${mgmt.reduce((s, t) => s + t.amount, 0).toFixed(2)})`)
