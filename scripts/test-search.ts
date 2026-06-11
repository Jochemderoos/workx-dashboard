// Quick sanity-check voor de search-index. Run met:
//   npx tsx scripts/test-search.ts
// Toont voor elke query de top-5 hits met score + matched field.

import { searchIndex } from '../src/lib/search-index'

const QUERIES = [
  'kantoor',
  'IBAN',
  'KvK',
  'btw nummer',
  'verlof aanvragen',
  'declaratie kosten',
  'hanna',
  'workx docs',
  'rekeningnummer abn',
  'wachtwoord',
  'po punten',
  'transitievergoeding',
  'borrel',
  'jaarplan',
  'lustrum',
  'praat met bas',
]

for (const q of QUERIES) {
  const hits = searchIndex(q, 5)
  console.log(`\n— "${q}" — ${hits.length} hits`)
  hits.forEach((h, i) => {
    console.log(
      `  ${i + 1}. [${h.item.kind.padEnd(8)}] ${h.item.label.padEnd(40)}  score=${h.score}  via=${h.matchedField}  ${h.item.href}`,
    )
  })
}
