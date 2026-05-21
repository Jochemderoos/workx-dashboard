// Grondige kritische audit van data/mt940-2025.json: zoek alle mogelijke
// salaris/persoons-betalingen die er nog in zouden moeten staan.

import { readFileSync } from 'fs'

interface T { date: string; amount: number; description: string; category: string | null }
const txs: T[] = JSON.parse(readFileSync('data/mt940-2025.json', 'utf8'))

console.log(`Totaal in JSON: ${txs.length} records, EUR ${txs.reduce((s, t) => s + t.amount, 0).toFixed(0)}\n`)

// Per category
const byCat = new Map<string, { n: number; sum: number }>()
for (const t of txs) {
  const k = t.category || '(regulier)'
  const e = byCat.get(k) || { n: 0, sum: 0 }
  e.n++; e.sum += t.amount; byCat.set(k, e)
}
console.log('Per category:')
Array.from(byCat.entries()).forEach(([k, v]) => console.log(`  ${k}: ${v.n}x EUR ${v.sum.toFixed(0)}`))

// Mogelijke persoonsnamen: vendors met regelmatige betalingen (>=4)
// die geen bekende organisatie zijn
const orgKeywords = /b\.?v\.?|n\.?v\.?|gmbh|ltd|inc|holding|advoc|stichting|coöp|management fee|uwv|asr|google|microsoft|amazon|herengracht|basenet|spotify|amsterdam|zaandam|orde van|gamma|kpn|abn|albert heijn|vlaams|bocca|zerozero|tentoo|froot|iside|legal|norm|constant|digihero|nestor|nectaro|isma|cavalieri|jader|nilsson|dents|merch|hema|bol\.com|pos|via stic|smart|workx|verkoop|terugbet|servicekost|paypal|de bary|broodjes|fietskoerier|deli/i

const vendorCount = new Map<string, { count: number; total: number; samples: string[] }>()
for (const t of txs) {
  if (t.category === 'UWV' || t.category === 'ASR') continue
  const v = t.description
  if (orgKeywords.test(v)) continue
  const e = vendorCount.get(v) || { count: 0, total: 0, samples: [] }
  e.count++; e.total += t.amount
  if (e.samples.length < 3) e.samples.push(`${t.date} EUR ${t.amount.toFixed(0)}`)
  vendorCount.set(v, e)
}

console.log('\n--- Vendors zonder organisatie-keyword, >=4 betalingen (mogelijk teamlid) ---')
const susp = Array.from(vendorCount.entries()).filter(([_, v]) => v.count >= 4).sort((a, b) => b[1].total - a[1].total)
for (const [name, v] of susp) {
  console.log(`  ${name.padEnd(50)} x${String(v.count).padStart(2)}  EUR ${v.total.toFixed(0).padStart(8)}  ${v.samples.join(' / ')}`)
}

console.log('\n--- Top 30 grootste records ---')
const top = [...txs].filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 30)
for (const t of top) {
  console.log(`  ${t.date}  EUR ${t.amount.toFixed(0).padStart(8)}  [${t.category || '-'}] ${t.description}`)
}
