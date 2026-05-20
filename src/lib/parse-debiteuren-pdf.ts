// Parser voor BaseNet 'Overzicht Openstaande debiteuren' PDF-rapport.
// Verwerkt per factuur de regels:
//   "Bkjr: Per.:	Verkoopboek YYYY P factuurnr NNNNN"
//   "Project: DXXXXXX <projectnaam>"
//   "10000 Totaal Honorarium DD-MM-YYYY <prefix> <naam>:"
//   "• X,X uur x XXX,- Euro"
// Plus de totalen onderaan elke factuur.

export interface ParsedAttorneyLine {
  attorneyName: string  // "mr. M. Ritmeester"
  hours: number
  hourlyRate: number
  amount: number        // honorarium excl. BTW
}

export interface ParsedInvoice {
  invoiceNumber: string
  bookYear: number
  bookPeriod: number
  projectCode?: string
  projectName?: string
  clientName?: string
  totalExcl: number
  totalIncl: number
  totalBtw: number
  lines: ParsedAttorneyLine[]
}

const RE_INVOICE = /Verkoopboek\s+(\d{4})\s+(\d{1,2})\s+factuurnr\s+(\d+)/i
const RE_PROJECT = /Project:\s*(D\d+)\s*(.*)$/i
const RE_LINE_NAME = /Totaal Honorarium\s+\d{2}-\d{2}-\d{4}\s+(.+?):\s*$/i
const RE_LINE_HOURS = /^[••]\s*([\d,.]+)\s*uur\s*x\s*([\d.,]+),?-?\s*Euro/i

function parseNumber(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

function startsNewInvoice(line: string): RegExpExecArray | null {
  return RE_INVOICE.exec(line)
}

export function parseDebiteurenPDF(text: string): ParsedInvoice[] {
  const lines = text.split('\n').map(l => l.trim())
  const invoices: ParsedInvoice[] = []
  const seenInvoiceNumbers = new Set<string>()
  let current: ParsedInvoice | null = null
  let pendingName: string | null = null
  let lastNonEmptyAfterExclusief: string[] = []
  let exclusiefSeen = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Nieuwe factuur
    const invMatch = startsNewInvoice(line)
    if (invMatch) {
      const invoiceNumber = invMatch[3]
      if (current && !seenInvoiceNumbers.has(current.invoiceNumber)) {
        invoices.push(current)
        seenInvoiceNumbers.add(current.invoiceNumber)
      }
      // Skip als we deze factuur al hebben gezien (PDF kan herhalen op pagina-wissel)
      if (seenInvoiceNumbers.has(invoiceNumber)) {
        current = null
        continue
      }
      current = {
        invoiceNumber,
        bookYear: parseInt(invMatch[1], 10),
        bookPeriod: parseInt(invMatch[2], 10),
        totalExcl: 0,
        totalIncl: 0,
        totalBtw: 0,
        lines: [],
      }
      pendingName = null
      exclusiefSeen = false
      lastNonEmptyAfterExclusief = []
      continue
    }
    if (!current) continue

    // Project info
    const projMatch = RE_PROJECT.exec(line)
    if (projMatch) {
      current.projectCode = projMatch[1]
      current.projectName = projMatch[2].trim() || undefined
      continue
    }

    // Klantnaam: regels direct na "Exclusief" tot een tag-regel
    if (line === 'Exclusief') { exclusiefSeen = true; continue }
    if (exclusiefSeen && !current.clientName) {
      if (/^(Aanta|Betaalwijze|Voor:|Geexporteerd|Via\s)/i.test(line)) {
        exclusiefSeen = false
        current.clientName = lastNonEmptyAfterExclusief[0]?.trim() || undefined
      } else if (!/^(Inclusief|BTW|Prod\.|Omschrijving|Bkjr|Per\.:)/i.test(line)) {
        lastNonEmptyAfterExclusief.push(line)
      }
    }

    // Advocaat-regel: naam
    const nameMatch = RE_LINE_NAME.exec(line)
    if (nameMatch) {
      pendingName = nameMatch[1].trim()
      continue
    }

    // Advocaat-regel: uren + tarief
    const hoursMatch = RE_LINE_HOURS.exec(line)
    if (hoursMatch && pendingName) {
      const hours = parseNumber(hoursMatch[1])
      const hourlyRate = parseNumber(hoursMatch[2])
      // amount is meestal de volgende getallen-regel
      let amount = hours * hourlyRate
      // Probeer exacte bedrag te vinden in de eerstvolgende paar regels
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const n = lines[j]
        // formaat van bedrag-regel: bv "780,78 4.498,78	3.718,00	1,00"
        const m = n.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+1,?0+0/)
        if (m) {
          amount = parseNumber(m[3])
          break
        }
      }
      current.lines.push({ attorneyName: pendingName, hours, hourlyRate, amount })
      pendingName = null
      continue
    }

    // Totaal-regel onderaan factuur (laatst voorkomend voor volgende factuur)
    // Formaat: "1.658,5 9.556,58	Totaa 7.898,00" of "21,42 123,42	Totaa 102,00"
    const totalMatch = line.match(/^([\d.,]+)\s+([\d.,]+)\s+(?:T|Totaa)\S*\s+([\d.,]+)/)
    if (totalMatch) {
      current.totalBtw = parseNumber(totalMatch[1])
      current.totalIncl = parseNumber(totalMatch[2])
      current.totalExcl = parseNumber(totalMatch[3])
    }
  }
  if (current && !seenInvoiceNumbers.has(current.invoiceNumber)) {
    invoices.push(current)
  }

  // Filter facturen zonder lines weg (waarschijnlijk onvolledige parse)
  return invoices.filter(inv => inv.lines.length > 0)
}

/**
 * Match een ruwe advocaat-naam uit de PDF aan een User op naam (initialen + achternaam).
 * Voorbeelden: "mr. M. Ritmeester" → Marnix Ritmeester;
 *              "de heer K. Maes" → Kay Maes;
 *              "J de Roos" → Jochem de Roos.
 */
export function matchAttorney(
  raw: string,
  users: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const stripped = raw
    .replace(/^(mr\.|mevr\.|dhr\.|mevrouw|de\s+heer)\s+/i, '')
    .trim()
  // "M. Ritmeester" of "J de Roos"
  const m = stripped.match(/^([A-Za-z])\.?\s+([\s\S]+)$/)
  if (!m) return null
  const initial = m[1].toUpperCase()
  const lastname = m[2].trim().toLowerCase().replace(/\s+/g, ' ')

  // Eerst exact initial + lastname
  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uInit = parts[0].charAt(0).toUpperCase()
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uInit === initial && uLast === lastname) return u
  }
  // Fallback: alleen achternaam matcht
  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uLast === lastname) return u
  }
  return null
}
