// Dump MT940-transacties die op een salarisbetaling lijken: zoek naar
// 'SALARIS', 'LOON', 'NETTO', of grote terugkerende bedragen aan
// dezelfde persoonsnaam.

import { readFileSync } from 'fs'
import { parseMT940 } from '../src/lib/parse-mt940'

const raw = readFileSync('C:/Users/quiri/Downloads/MT940260521203054.STA', 'utf8')
const txs = parseMT940(raw).filter(t => t.amount > 0)

// 1) Letterlijk 'salaris' / 'loon' in description
console.log('--- "salaris" / "loon" / "netto" in description ---')
const salaryWords = txs.filter(t => /salaris|\bloon\b|netto/i.test(t.description))
for (const t of salaryWords) {
  console.log(`  ${t.date.toISOString().slice(0,10)}  €${t.amount.toFixed(2).padStart(9)}  ${t.description}`)
}
console.log(`  totaal ${salaryWords.length}\n`)

// 2) Vendors met >=8 betalingen die geen bekende organisaties zijn (waarschijnlijk personen/salaris)
const vendorCount = new Map<string, { count: number; total: number; samples: string[] }>()
for (const t of txs) {
  const v = t.description
  const e = vendorCount.get(v) || { count: 0, total: 0, samples: [] }
  e.count++
  e.total += t.amount
  if (e.samples.length < 3) e.samples.push(`${t.date.toISOString().slice(0,10)} €${t.amount.toFixed(2)}`)
  vendorCount.set(v, e)
}

console.log('--- Vendors met >=8 betalingen (mogelijk salaris) ---')
const frequent = Array.from(vendorCount.entries())
  .filter(([_, v]) => v.count >= 8)
  .sort((a, b) => b[1].total - a[1].total)
for (const [name, v] of frequent.slice(0, 30)) {
  console.log(`  ${name.padEnd(50)} ×${v.count}  €${v.total.toFixed(0).padStart(8)}  ${v.samples.join(' / ')}`)
}
