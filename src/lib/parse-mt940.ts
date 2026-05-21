// Lichtgewicht MT940-parser voor ABN AMRO. Pakt alleen de debet-
// transacties (kosten) en hun omschrijving uit :86:-regels.

import crypto from 'crypto'
import { normalizeVendor } from './cost-vendor'

export interface MT940Transaction {
  date: Date          // valutadatum
  amount: number      // positief getal in euros (negatief = bijschrijving die als correctie meetelt)
  description: string // genormaliseerde vendornaam (zelfde stijl als handmatige posten)
  rawKey: string      // stabiele counterparty-fingerprint (voor leer-aliassen)
  externalRef: string // hash voor duplicaat-detectie
  category?: 'UWV' | 'ASR' // bijschrijvingen die we als terugbetaling meenemen
}

// Detecteer UWV (zwangerschapsverlof) of ASR (verzuimverzekering) in omschrijving
function detectCategory(desc: string): 'UWV' | 'ASR' | null {
  const lower = desc.toLowerCase()
  // UWV bijschrijvingen: WAZO/Wet arbeid en zorg / zwangerschapsuitkering / uwv
  if (/\buwv\b/.test(lower) || /\bwazo\b/.test(lower)) return 'UWV'
  // ASR verzuimverzekering: 'asr' of variaties
  if (/\basr\b/.test(lower) || /verzuimverzekering/.test(lower)) return 'ASR'
  return null
}

function hashTransaction(dateIso: string, amount: number, rawKey: string): string {
  const key = `${dateIso}|${amount.toFixed(2)}|${rawKey}`
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20)
}

export function parseMT940(content: string): MT940Transaction[] {
  // Normaliseer line endings en vouw multi-line :86: samen
  const lines = content.replace(/\r/g, '').split('\n')
  const transactions: MT940Transaction[] = []

  let currentTx: { date: Date; amount: number; isDebet: boolean; desc: string } | null = null
  let inDesc = false

  const flush = () => {
    if (!currentTx) return
    if (currentTx.amount > 0) {
      const dateIso = currentTx.date.toISOString().slice(0, 10)
      if (currentTx.isDebet) {
        // Reguliere kost (debet)
        const { vendorName, rawKey } = normalizeVendor(currentTx.desc)
        transactions.push({
          date: currentTx.date,
          amount: currentTx.amount,
          description: vendorName,
          rawKey,
          externalRef: hashTransaction(dateIso, currentTx.amount, rawKey),
        })
      } else {
        // Bijschrijving (credit): alleen UWV/ASR meenemen als negatieve correctie
        const category = detectCategory(currentTx.desc)
        if (category) {
          const { rawKey } = normalizeVendor(currentTx.desc)
          const label = category === 'UWV'
            ? 'UWV-uitkering (zwangerschapsverlof)'
            : 'ASR-vergoeding (verzuimverzekering)'
          // Bedrag negatief opslaan zodat het kosten verlaagt
          const negAmount = -currentTx.amount
          transactions.push({
            date: currentTx.date,
            amount: negAmount,
            description: label,
            rawKey: `${category}:${rawKey}`,
            externalRef: hashTransaction(dateIso, negAmount, `${category}:${rawKey}`),
            category,
          })
        }
      }
    }
    currentTx = null
    inDesc = false
  }

  for (const line of lines) {
    if (line.startsWith(':61:')) {
      flush()
      const rest = line.slice(4)
      // Formaat: YYMMDD[MMDD][C|D|RC|RD][R]amount[NMSC]...
      const m = rest.match(/^(\d{6})(\d{4})?(R?[CD])([\d,]+)/)
      if (!m) continue
      const valutaRaw = m[1]
      const dcRaw = m[3]
      const amountStr = m[4]
      const yy = parseInt(valutaRaw.substring(0, 2), 10)
      const mm = parseInt(valutaRaw.substring(2, 4), 10)
      const dd = parseInt(valutaRaw.substring(4, 6), 10)
      // ABN-jaar conventie: 00-79 = 2000-2079
      const year = yy < 80 ? 2000 + yy : 1900 + yy
      const amount = parseFloat(amountStr.replace(',', '.'))
      if (isNaN(amount)) continue
      const isDebet = dcRaw === 'D' || dcRaw === 'RC' // RC = reverse credit = teruggetrokken inkomst → kost
      currentTx = {
        date: new Date(year, mm - 1, dd),
        amount,
        isDebet,
        desc: '',
      }
      inDesc = false
    } else if (line.startsWith(':86:')) {
      if (currentTx) {
        currentTx.desc += ' ' + line.slice(4)
        inDesc = true
      }
    } else if (line.startsWith(':')) {
      // Andere MT940-tag: stopt :86:-doorlopen
      inDesc = false
      if (line.startsWith(':62F:') || line.startsWith(':62M:') || line.startsWith(':-')) {
        // Einde van de bewegingen-sectie
        flush()
      }
    } else if (inDesc && currentTx) {
      // Voortgezet :86:
      currentTx.desc += ' ' + line
    }
  }
  flush()

  return transactions
}
