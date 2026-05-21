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
  category?: 'UWV' | 'ASR' | 'ZZP' | 'WGL' | 'MGMT' // UWV/ASR = retours, ZZP = externe advocaten, WGL = pensioenpremie, MGMT = management fee partners
}

// Skip transacties die geen 'bedrijfskost' zijn maar al elders in de
// administratie zitten:
//   - Belastingdienst (loonheffing zit in werkgeverslasten-invoer; VPB
//     is apart)
//   - Interne overboekingen tussen Workx-rekeningen
// Management fee naar partner-holdings (Les Dents Du Midi / Meneer Nilsson /
// Cavalieri / Jader) NIET skippen — dat is een echte kostenpost.
function shouldSkipDebet(desc: string): boolean {
  const lower = desc.toLowerCase()
  if (/\bbelastingdienst\b/.test(lower)) return true
  if (/\bworkx\s+advocaten\b/.test(lower)) return true
  return false
}

// Specifieke management-fee holdings → krijgen een nette omschrijving.
function managementFeeLabel(desc: string): string | null {
  const lower = desc.toLowerCase()
  if (/\bles\s+dents\s+du\s+midi\b/.test(lower)) return 'Management fee — Les Dents Du Midi'
  if (/\bmeneer\s+nilsson\b/.test(lower)) return 'Management fee — Meneer Nilsson'
  if (/\bcavalieri\b/.test(lower)) return 'Management fee — Cavalieri'
  if (/\bjader\b/.test(lower)) return 'Management fee — Jader'
  return null
}

// Detecteer in de omschrijving:
//   UWV (zwangerschapsverlof, bijschrijving) → negatieve correctie op WGL
//   ASR (verzuimverzekering, bijschrijving)  → idem
//   ZZP (externe advocaten, debet, alleen Nectaro/Lodewijk)
//   WGL (werkgeverslasten-aanvulling: pensioenpremie) → optellen bij WGL
// Tentoo is alleen payrolling-administratie → gewone overige kost (geen tag).
function detectCategory(desc: string): 'UWV' | 'ASR' | 'ZZP' | 'WGL' | null {
  const lower = desc.toLowerCase()
  if (/\buwv\b/.test(lower) || /\bwazo\b/.test(lower)) return 'UWV'
  if (/\basr\b/.test(lower) || /verzuimverzekering/.test(lower)) return 'ASR'
  if (/\bnectaro\b/.test(lower) || /\blodewijk\b/.test(lower)) return 'ZZP'
  if (/\bbright\s*pensioen\b/.test(lower) || /\bpensioen\b/.test(lower)) return 'WGL'
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
      const { vendorName, rawKey } = normalizeVendor(currentTx.desc)
      const detected = detectCategory(currentTx.desc)

      if (currentTx.isDebet) {
        // Skip belastingdienst (loonheffing) en interne Workx-overboekingen
        if (shouldSkipDebet(currentTx.desc)) { currentTx = null; inDesc = false; return }
        // Management fee → eigen category MGMT zodat we 'waarvan…' kunnen tonen
        const mgmtLabel = managementFeeLabel(currentTx.desc)
        // Debet: MGMT > ZZP > WGL > regulier
        const category: 'MGMT' | 'ZZP' | 'WGL' | undefined =
          mgmtLabel ? 'MGMT' :
          (detected === 'ZZP' || detected === 'WGL') ? detected : undefined
        const labelSuffix = category === 'ZZP' ? ' (ZZP)' : category === 'WGL' ? ' (pensioen)' : ''
        const finalDesc = mgmtLabel ?? (vendorName + labelSuffix)
        const finalRawKey = category ? `${category}:${rawKey}` : rawKey
        transactions.push({
          date: currentTx.date,
          amount: currentTx.amount,
          description: finalDesc,
          rawKey: finalRawKey,
          externalRef: hashTransaction(dateIso, currentTx.amount, finalRawKey),
          category,
        })
      } else if (detected === 'UWV' || detected === 'ASR') {
        // Credit: UWV/ASR-terugbetaling — negatief opslaan
        const label = detected === 'UWV'
          ? 'UWV-uitkering (zwangerschapsverlof)'
          : 'ASR-vergoeding (verzuimverzekering)'
        const negAmount = -currentTx.amount
        transactions.push({
          date: currentTx.date,
          amount: negAmount,
          description: label,
          rawKey: `${detected}:${rawKey}`,
          externalRef: hashTransaction(dateIso, negAmount, `${detected}:${rawKey}`),
          category: detected,
        })
      }
      // Andere credit-regels (overige inkomsten) negeren we
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
