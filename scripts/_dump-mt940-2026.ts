// Dump 2026 MT940 -> data/mt940-2026.json

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { parseMT940 } from '../src/lib/parse-mt940'

const inputPath = process.argv[2] || 'C:/Users/quiri/Downloads/MT940260521214019.STA'
const outPath = 'data/mt940-2026.json'

const raw = readFileSync(inputPath, 'utf8')
const txs = parseMT940(raw)
const txs2026 = txs.filter(t => t.date.getFullYear() === 2026)

const out = txs2026.map(t => ({
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
const mgmt = out.filter(t => t.category === 'MGMT')
const byMonth = new Map<number, { count: number; sum: number }>()
for (const t of out) {
  const e = byMonth.get(t.month) || { count: 0, sum: 0 }
  e.count++; e.sum += t.amount; byMonth.set(t.month, e)
}

console.log(`[dump-mt940-2026] ${out.length} transacties → ${outPath}`)
console.log(`  Totaal: €${total.toFixed(2)}`)
console.log(`  MGMT: ${mgmt.length} posten (€${mgmt.reduce((s,t) => s+t.amount, 0).toFixed(0)})`)
console.log(`  Per maand:`)
Array.from(byMonth.entries()).sort((a, b) => a[0] - b[0]).forEach(([m, v]) => {
  console.log(`    M${m}: ${v.count}× €${v.sum.toFixed(0)}`)
})
