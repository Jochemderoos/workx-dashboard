// Parser voor BaseNet 'Overzicht Openstaande debiteuren' PDF-rapport.
// Werkt op de tekst zoals pdfjs-dist die levert (fragmenten op aparte
// regels). Strategie: normaliseer whitespace naar spaties, dan
// regex-match per factuur-blok over de volledige tekst.

export interface ParsedAttorneyLine {
  attorneyName: string
  hours: number
  hourlyRate: number
  amount: number
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

function num(s: string): number {
  // "1.658,50" → 1658.50; "21,42" → 21.42; "1,00" → 1.00
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

export function parseDebiteurenPDF(rawText: string): ParsedInvoice[] {
  // Normaliseer alle whitespace (incl. newlines uit pdfjs) tot 1 spatie
  const text = rawText.replace(/\s+/g, ' ').trim()

  // Stap 1: lokaliseer iedere factuur-header met offset
  const headerRe = /Verkoopboek\s+(\d{4})\s+(\d{1,2})\s+factuurnr\s+(\d+)/g
  const headers: { invoiceNumber: string; year: number; period: number; start: number }[] = []
  let h: RegExpExecArray | null
  while ((h = headerRe.exec(text)) !== null) {
    headers.push({
      invoiceNumber: h[3],
      year: parseInt(h[1], 10),
      period: parseInt(h[2], 10),
      start: h.index,
    })
  }
  if (headers.length === 0) return []

  // Stap 2: voor elke header, parse het blok tussen deze en de volgende
  const seen = new Set<string>()
  const invoices: ParsedInvoice[] = []
  for (let i = 0; i < headers.length; i++) {
    const cur = headers[i]
    if (seen.has(cur.invoiceNumber)) continue
    seen.add(cur.invoiceNumber)
    const end = i + 1 < headers.length ? headers[i + 1].start : text.length
    const block = text.substring(cur.start, end)
    const inv = parseBlock(block, cur.invoiceNumber, cur.year, cur.period)
    if (inv && inv.lines.length > 0) invoices.push(inv)
  }
  return invoices
}

function parseBlock(block: string, invoiceNumber: string, year: number, period: number): ParsedInvoice | null {
  const inv: ParsedInvoice = {
    invoiceNumber,
    bookYear: year,
    bookPeriod: period,
    totalExcl: 0,
    totalIncl: 0,
    totalBtw: 0,
    lines: [],
  }

  // Project: "Project: DXXXXXX <naam>"
  const proj = block.match(/Project:\s*(D\d+)\s*(.+?)(?=\s+Exclusief|\s+Inclusief|\s+Prod\.)/i)
  if (proj) {
    inv.projectCode = proj[1]
    const name = proj[2].replace(/\s+/g, ' ').trim()
    if (name) inv.projectName = name
  }

  // Klantnaam: tussen "Exclusief" en "Aanta" (of "Betaalwijze")
  const client = block.match(/Exclusief\s+(.+?)\s+(?:Aanta\b|Betaalwijze\b)/i)
  if (client) {
    // Pak alleen de eerste regel (alles vóór een postcode/getal+letters)
    const c = client[1].split(/\s+\d{4}\s+[A-Z]{2}\b/)[0].trim()
    if (c) inv.clientName = c
  }

  // Uren-regels: "Totaal Honorarium DD-MM-YYYY <naam>: • X uur x XXX,- Euro (Honorarium) btw incl excl 1,00"
  // pdfjs kan losse cijfers op verschillende regels gooien; al genormaliseerd
  const lineRe = /Totaal\s+Honorarium\s+\d{2}-\d{2}-\d{4}\s+([^:]+?):\s*[•·]?\s*([\d.,]+)\s*uur\s*x\s*([\d.,]+),?-?\s*Euro\s*\(Honorarium\)\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+1,?0+0/g
  let lm: RegExpExecArray | null
  while ((lm = lineRe.exec(block)) !== null) {
    const attorneyName = lm[1].trim()
    const hours = num(lm[2])
    const rate = num(lm[3])
    const amountExcl = num(lm[6])
    if (isNaN(hours) || isNaN(amountExcl)) continue
    inv.lines.push({ attorneyName, hours, hourlyRate: rate, amount: amountExcl })
  }

  // Totaalregel onderaan: "btw incl Totaa excl"
  const totalRe = /([\d.,]+)\s+([\d.,]+)\s+(?:T|Totaa)\S*\s+([\d.,]+)/g
  let lastTot: RegExpExecArray | null = null
  let t: RegExpExecArray | null
  while ((t = totalRe.exec(block)) !== null) lastTot = t
  if (lastTot) {
    inv.totalBtw = num(lastTot[1])
    inv.totalIncl = num(lastTot[2])
    inv.totalExcl = num(lastTot[3])
  } else if (inv.lines.length > 0) {
    // Fallback: totaal = som van line amounts
    inv.totalExcl = inv.lines.reduce((s, l) => s + l.amount, 0)
    inv.totalBtw = +(inv.totalExcl * 0.21).toFixed(2)
    inv.totalIncl = +(inv.totalExcl + inv.totalBtw).toFixed(2)
  }

  return inv
}

/**
 * Match een ruwe advocaat-naam uit de PDF aan een User op naam (initialen + achternaam).
 */
export function matchAttorney(
  raw: string,
  users: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const stripped = raw
    .replace(/^(mr\.|mevr\.|dhr\.|mevrouw|de\s+heer)\s+/i, '')
    .trim()
  const m = stripped.match(/^([A-Za-z])\.?\s+([\s\S]+)$/)
  if (!m) return null
  const initial = m[1].toUpperCase()
  const lastname = m[2].trim().toLowerCase().replace(/\s+/g, ' ')

  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uInit = parts[0].charAt(0).toUpperCase()
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uInit === initial && uLast === lastname) return u
  }
  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uLast === lastname) return u
  }
  return null
}
