// Audit: zoek vendors die volgens groupKey verschillend zijn maar
// inhoudelijk vermoedelijk hetzelfde zijn (doublures).

import { readFileSync } from 'fs'
import { groupKey } from '../src/lib/cost-vendor'

interface T { description: string; amount: number; category: string | null }
const txs2025: T[] = JSON.parse(readFileSync('data/mt940-2025.json', 'utf8'))
const txs2026: T[] = JSON.parse(readFileSync('data/mt940-2026.json', 'utf8'))
const all = [...txs2025, ...txs2026].filter(t => t.amount > 0 && t.category !== 'UWV' && t.category !== 'ASR')

// Per groupKey de vendors verzamelen
const byGroup = new Map<string, { vendors: Set<string>; count: number; total: number }>()
for (const t of all) {
  const k = groupKey(t.description)
  const e = byGroup.get(k) || { vendors: new Set(), count: 0, total: 0 }
  e.vendors.add(t.description)
  e.count++
  e.total += t.amount
  byGroup.set(k, e)
}

// Mogelijke doublures: dezelfde 'eerste woord' of substring tussen verschillende groupKeys
console.log('Groepen met >1 vendor-variant:')
Array.from(byGroup.entries())
  .filter(([_, v]) => v.vendors.size > 1)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([k, v]) => {
    console.log(`  [${k}] x${v.count} EUR ${v.total.toFixed(0)}`)
    Array.from(v.vendors).forEach(vd => console.log(`    - ${vd}`))
  })

// Mogelijke cross-group doublures: zelfde 1e woord, andere groupKey
const byFirstWord = new Map<string, Set<string>>()
for (const [k] of Array.from(byGroup.entries())) {
  const fw = k.split(/\s+/)[0].toLowerCase()
  if (fw.length < 3) continue
  if (!byFirstWord.has(fw)) byFirstWord.set(fw, new Set())
  byFirstWord.get(fw)!.add(k)
}

console.log('\n--- Verschillende groupKeys met zelfde 1e woord (mogelijk doublure) ---')
Array.from(byFirstWord.entries())
  .filter(([_, ks]) => ks.size > 1)
  .forEach(([fw, ks]) => {
    console.log(`  [${fw}]`)
    Array.from(ks).forEach(k => {
      const g = byGroup.get(k)!
      console.log(`    - "${k}" x${g.count} EUR ${g.total.toFixed(0)}`)
    })
  })
