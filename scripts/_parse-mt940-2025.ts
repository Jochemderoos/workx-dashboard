import { readFileSync } from 'fs'
import { parseMT940 } from '../src/lib/parse-mt940'

const buf = readFileSync('C:/Users/quiri/Downloads/MT940260521203054.STA', 'utf8')
const txs = parseMT940(buf)
console.log(`Aantal transacties: ${txs.length}`)
console.log(`Totaal: €${txs.reduce((s, t) => s + t.amount, 0).toFixed(2)}\n`)

// Per categorie
const byCat = new Map<string, { count: number; sum: number }>()
for (const t of txs) {
  const k = t.category || '(geen)'
  const e = byCat.get(k) || { count: 0, sum: 0 }
  e.count++
  e.sum += t.amount
  byCat.set(k, e)
}
console.log('Per categorie:')
for (const [k, v] of Array.from(byCat.entries())) {
  console.log(`  ${k}: ${v.count} × totaal €${v.sum.toFixed(2)}`)
}

// Salaris/loonbelasting kandidaten
console.log('\nVerdachte salaris/loonbelasting/SVB:')
const suspect = txs.filter(t => /salaris|loonbel|loonheff|belastingdienst|svb|nationale-nederlanden|bright|pensioen|aegon/i.test(t.description))
for (const t of suspect.slice(0, 30)) {
  console.log(`  ${t.date.toISOString().slice(0, 10)}  €${t.amount.toFixed(2).padStart(9)}  [${t.category || '-'}]  ${t.description}`)
}
console.log(`  ... totaal ${suspect.length}\n`)

// Top-20 hoogste bedragen
console.log('Top 20 grootste:')
const top = [...txs].sort((a, b) => b.amount - a.amount).slice(0, 20)
for (const t of top) {
  console.log(`  ${t.date.toISOString().slice(0, 10)}  €${t.amount.toFixed(2).padStart(10)}  [${t.category || '-'}]  ${t.description}`)
}

// Unieke vendors
const vendorSums = new Map<string, number>()
for (const t of txs) {
  vendorSums.set(t.description, (vendorSums.get(t.description) || 0) + t.amount)
}
console.log(`\nUnieke beschrijvingen: ${vendorSums.size}`)
