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
  category?: 'UWV' | 'ASR' | 'ZZP' | 'MGMT' | 'BALANS' | 'DOORBELAST' // UWV/ASR = retours, ZZP = externe advocaten, MGMT = management fee partners (incl BTW), BALANS = waarborgsommen / vooruitbetalingen / deposito's (geen kost), DOORBELAST = aan klant doorbelaste kosten zoals griffierechten (geen netto kost)
}

// De vijf partner-holdings van Workx. Naar dezelfde holding gaan zowel
// management fee (kost, incl 21% BTW) als dividend (geen kost) — het
// onderscheid zit in de MT940-omschrijving.
const PARTNER_HOLDINGS: { regex: RegExp; partner: string }[] = [
  { regex: /\bles\s+dents\s+du\s+midi\b/i, partner: 'Les Dents Du Midi' },
  { regex: /\bmeneer\s+nil+s+on\b/i, partner: 'Meneer Nilsson' }, // tolereer NILSSON/NILLSON varianten
  { regex: /\bcavalieri\b/i, partner: 'Cavalieri' },
  { regex: /\bjader\b/i, partner: 'Jader' },
  { regex: /\bisma\s+b\.?v\.?\b/i, partner: 'Isma' }, // 'isma' zonder b.v. matcht te veel
]

function detectPartner(desc: string): string | null {
  for (const p of PARTNER_HOLDINGS) {
    if (p.regex.test(desc)) return p.partner
  }
  // M. De Jong = Maaike (partner, eigenaar Meneer Nilsson BV) — directe
  // onkostendeclaraties aan haarzelf. Niet management fee, maar wel kost.
  if (/\bm\.?\s+de\s+jong\b/i.test(desc)) return 'Maaike de Jong'
  return null
}

// Per partner-betaling de omschrijving classificeren.
//   - 'MGMT'    = management fee (kost, 21% BTW)
//   - 'SKIP'    = dividend / retour (geen kost)
//   - 'REGULAR' = gewone kost (bv. doorbetaalde onkostendeclaratie)
type PartnerClass = 'MGMT' | 'SKIP' | 'REGULAR'
function classifyPartnerPayment(desc: string, partner: string): PartnerClass {
  const lower = desc.toLowerCase()
  // Maaike de Jong = altijd onkostendeclaratie (direct aan persoon, niet holding)
  if (partner === 'Maaike de Jong') return 'REGULAR'
  if (/\bdividend\b/.test(lower)) return 'SKIP'
  if (/\bretour\b/.test(lower)) return 'SKIP'
  if (/\b\d{4}[-/\s]?deel\b/.test(lower)) return 'SKIP' // "2024-DEEL 2"
  if (/\bdeclaratie/.test(lower)) return 'REGULAR'      // onkostendeclaratie
  if (/\bmanag[ae]ment\s*fee\b/.test(lower)) return 'MGMT'
  if (/\bcorrectie\b/.test(lower)) return 'MGMT'         // management fee correctie
  // Onbekend bij partner — skip om dubbeltelling/dividend te voorkomen
  return 'SKIP'
}

// Workx-medewerkers — directe salarisbetalingen via MT940 zijn dubbel-
// telling met de werkgeverslasten (zit al op loonstrook). Match op
// achternaam alleen, hoofdletter-ongevoelig — robuust tegen diakrieten
// en encoding-varianten in de MT940-omschrijving.
const WORKX_TEAM_LASTNAMES: RegExp[] = [
  /\bschipper\b/i,
  /\bvan\s+der\s+vos\b/i,
  /\bheunen\b/i,
  /\brip\b/i,
  /\bschellekens\b/i,
  /\bvan\s+pesch\b/i,
  /\bvan\s+zadelhof\b/i,
  /\bblaauboer\b/i,
  /\bmaes\b/i,
  /\bpesser\b/i,
  /\bgroen\b/i,
  /\bniersman\b/i,
  /\bsint[-\s]?truien\b/i,        // 'Van Sint-Truien'
  /\bsint[-\s]?truiden\b/i,        // 'Van Sint Truiden' (variant)
  /\bloomans\b/i,                  // Lauren Loomans (vanaf sep 2025)
  /\bportman\b/i,                  // Bente Portman
  /\bcollot\b/i,                   // Alexander Collot d'Escury (salaris, zit in werkgeverslasten)
  /\bwakkas\b/i,                   // Diyar Wakkas (salaris, zit in werkgeverslasten)
]

function isWorkxTeam(desc: string): boolean {
  return WORKX_TEAM_LASTNAMES.some(re => re.test(desc))
}

// Skip transacties die geen 'bedrijfskost' zijn:
//   - Belastingdienst (loonheffing zit in werkgeverslasten-invoer; VPB apart)
//   - Interne overboekingen tussen Workx-rekeningen
//   - Bright Pensioen / pensioen — zit al op de loonstrook
//   - Workx-medewerkers (salaris via MT940 = dubbeltelling)
// Partner-holdings worden hier NIET geskipt; zie classifyPartnerPayment.
function shouldSkipDebet(desc: string): boolean {
  const lower = desc.toLowerCase()
  if (/\bbelastingdienst\b/.test(lower)) return true
  if (/\bworkx\s+advocaten\b/.test(lower)) return true
  if (/\bbright\s*pensioen\b/.test(lower)) return true
  if (/\bpensioen\b/.test(lower)) return true
  if (isWorkxTeam(desc)) return true
  return false
}

// Detecteer in de omschrijving:
//   UWV (zwangerschapsverlof, bijschrijving) → negatieve correctie op WGL
//   ASR (verzuimverzekering, bijschrijving)  → idem
//   ZZP (externe advocaten, debet: Nectaro/Lodewijk + Louwmans Legal)
// Bright Pensioen wordt geskipt (zit al in werkgeverslasten via loonstrook).
// Tentoo is payrolling-administratie → gewone overige kost (21% BTW).
function detectCategory(desc: string): 'UWV' | 'ASR' | 'ZZP' | 'BALANS' | 'DOORBELAST' | null {
  const lower = desc.toLowerCase()
  if (/\buwv\b/.test(lower) || /\bwazo\b/.test(lower)) return 'UWV'
  if (/\basr\b/.test(lower) || /verzuimverzekering/.test(lower)) return 'ASR'
  if (/\bnectaro\b/.test(lower) || /\blodewijk\b/.test(lower) || /\bl[ao]uwmans\b/.test(lower)) return 'ZZP'
  // Griffierechten e.d. — wel betaald, maar doorbelast aan de klant (geen netto kost)
  if (/ministerie\s+van\s+(veiligheid\s+en\s+)?justitie/.test(lower)) return 'DOORBELAST'
  if (/waarborgsom|borgsom|deposito|vooruitbetaling/.test(lower)) return 'BALANS'
  return null
}

// Stabiele hash op basis van de RUWE bank-data (datum + bedrag + ruwe
// description). Niet baseren op normalizeVendor-output omdat die tussen
// code-versies kan verschuiven en dezelfde transactie dan een andere
// externalRef krijgt → dubbele imports.
function hashTransaction(dateIso: string, amount: number, rawDesc: string): string {
  // Normaliseer alleen whitespace en case in de hash-input; verander
  // verder niets aan de oorspronkelijke description.
  const stable = rawDesc.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200)
  const key = `${dateIso}|${amount.toFixed(2)}|${stable}`
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
        // Skip belastingdienst (loonheffing), interne Workx-overboekingen, pensioen
        if (shouldSkipDebet(currentTx.desc)) { currentTx = null; inDesc = false; return }

        // Partner-holdings: classificeer op basis van omschrijving
        const partner = detectPartner(currentTx.desc)
        let category: 'MGMT' | 'ZZP' | 'BALANS' | 'DOORBELAST' | undefined
        let finalDesc = vendorName
        if (detected === 'BALANS') {
          // Waarborgsom / vooruitbetaling / deposito — balanspost, geen kost.
          category = 'BALANS'
        } else if (detected === 'DOORBELAST') {
          // Griffierechten e.d. — doorbelast aan de klant, geen netto kost.
          category = 'DOORBELAST'
        } else if (partner) {
          const cls = classifyPartnerPayment(currentTx.desc, partner)
          if (cls === 'SKIP') { currentTx = null; inDesc = false; return }
          if (cls === 'MGMT') {
            category = 'MGMT'
            finalDesc = `Management fee — ${partner}`
          } else {
            // REGULAR (bv. onkostendeclaratie) — gewone kost met partnernaam
            finalDesc = `${partner} — declaratie`
          }
        } else if (detected === 'ZZP') {
          category = 'ZZP'
          finalDesc = vendorName + ' (ZZP)'
        }

        const finalRawKey = category ? `${category}:${rawKey}` : rawKey
        transactions.push({
          date: currentTx.date,
          amount: currentTx.amount,
          description: finalDesc,
          rawKey: finalRawKey,
          // Hash op ruwe bank-description (stabiel tussen code-versies)
          externalRef: hashTransaction(dateIso, currentTx.amount, currentTx.desc),
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
          // Hash op ruwe bank-description (stabiel)
          externalRef: hashTransaction(dateIso, negAmount, currentTx.desc),
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
