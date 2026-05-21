// Dumpt alle MT940 :86:-omschrijvingen van de 5 partner-holdings, zodat
// we per transactie kunnen zien of er een hint in de tekst staat
// (Management fee Q1 / dividend / winstuitkering / etc).

import { readFileSync } from 'fs'

const file = 'C:/Users/quiri/Downloads/MT940260521203054.STA'
const raw = readFileSync(file, 'utf8').replace(/\r/g, '')
const lines = raw.split('\n')

interface Tx {
  date: string
  amount: number
  isDebet: boolean
  desc: string
}

const txs: Tx[] = []
let cur: Tx | null = null
let inDesc = false

for (const line of lines) {
  if (line.startsWith(':61:')) {
    if (cur) txs.push(cur)
    const rest = line.slice(4)
    const m = rest.match(/^(\d{6})(\d{4})?(R?[CD])([\d,]+)/)
    if (!m) continue
    const yy = parseInt(m[1].substring(0, 2), 10)
    const mm = parseInt(m[1].substring(2, 4), 10)
    const dd = parseInt(m[1].substring(4, 6), 10)
    const year = yy < 80 ? 2000 + yy : 1900 + yy
    const amount = parseFloat(m[4].replace(',', '.'))
    cur = {
      date: `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
      amount,
      isDebet: m[3] === 'D' || m[3] === 'RC',
      desc: '',
    }
    inDesc = false
  } else if (line.startsWith(':86:')) {
    if (cur) {
      cur.desc += ' ' + line.slice(4)
      inDesc = true
    }
  } else if (line.startsWith(':')) {
    inDesc = false
  } else if (inDesc && cur) {
    cur.desc += ' ' + line
  }
}
if (cur) txs.push(cur)

const PARTNERS = ['les dents du midi', 'cavalieri', 'meneer nilsson', 'meneer nillson', 'jader', 'isma']

const matched = txs.filter(t =>
  t.isDebet && PARTNERS.some(p => t.desc.toLowerCase().includes(p))
)

console.log(`${matched.length} debet-transacties naar de 5 partner-holdings:\n`)

// Group by holding
for (const partner of PARTNERS) {
  const subset = matched.filter(t => t.desc.toLowerCase().includes(partner))
  if (subset.length === 0) continue
  console.log(`\n=== ${partner.toUpperCase()} (${subset.length} stuks, totaal €${subset.reduce((s, t) => s + t.amount, 0).toFixed(0)}) ===`)
  for (const t of subset) {
    console.log(`  ${t.date}  €${t.amount.toFixed(2).padStart(10)}   ${t.desc.trim().replace(/\s+/g, ' ').slice(0, 200)}`)
  }
}
