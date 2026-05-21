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

export interface WordInvoiceInfo {
  issueDate: Date
  dueDate: Date
  openAmount: number     // Open bedrag incl. BTW
  clientName?: string
}

/**
 * Parse BaseNet 'Overzicht' Word-export tekst naar { factuurnr → volledige info }.
 * Word is de master-bron: bevat ALLE openstaande facturen (ook discounts,
 * doorbelastingen etc) — anders dan PDF die alleen facturen met uren toont.
 */
export function parseDebiteurenWord(text: string): Map<string, WordInvoiceInfo> {
  const result = new Map<string, WordInvoiceInfo>()
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)

  let currentInv: string | null = null
  let issueDate: Date | null = null
  let dueDate: Date | null = null
  let openAmount: number | null = null
  let clientName: string | null = null
  let captureClient = false

  const flush = () => {
    if (currentInv && issueDate && dueDate && openAmount !== null) {
      const entry: WordInvoiceInfo = { issueDate, dueDate, openAmount }
      if (clientName) entry.clientName = clientName
      result.set(currentInv, entry)
    }
    currentInv = null
    issueDate = null
    dueDate = null
    openAmount = null
    clientName = null
    captureClient = false
  }

  const parseDate = (s: string): Date | null => {
    const m = s.match(/(\d{2})-(\d{2})-(\d{4})/)
    if (!m) return null
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
    return isNaN(d.getTime()) ? null : d
  }

  const parseAmount = (s: string): number | null => {
    const m = s.match(/(-?[\d.]+),(\d{2})/)
    if (!m) return null
    const v = parseFloat(m[1].replace(/\./g, '') + '.' + m[2])
    return isNaN(v) ? null : v
  }

  for (const line of lines) {
    // Factuurnummer = puur cijfers, 4-8 chars
    if (/^\d{4,8}$/.test(line)) {
      flush()
      currentInv = line
      continue
    }
    if (!currentInv) continue

    if (/^Open bedrag\s*:/i.test(line)) {
      const v = parseAmount(line)
      if (v !== null) openAmount = v
    } else if (/Verval\s*datum\s*:/i.test(line)) {
      const d = parseDate(line)
      if (d) dueDate = d
    } else if (/Verzenddatum\s*:/i.test(line)) {
      const d = parseDate(line)
      if (d) issueDate = d
      captureClient = true // volgende niet-systeemregel is de klantnaam
    } else if (captureClient && !clientName) {
      // Eerste regel na 'Verzenddatum:' is de klantnaam (geen header/email)
      if (!/^(Email|Open bedrag|Originele bedrag|Dagen|Verval|Verzend|Factnr|Bedragen)/i.test(line)) {
        clientName = line
        captureClient = false
      }
    }
  }
  flush()
  return result
}

/**
 * Match een ruwe advocaat-naam uit de PDF aan een User op naam.
 * Ondersteunt:
 *   - "mr. M. Ritmeester" (één initiaal)
 *   - "M.S. van Pesch" (meerdere initialen, roepnaam Wies)
 *   - "E.L.H van der Vos" (Emma)
 *   - "A.L. Heunen" (Alain)
 *   - "J de Roos" (initiaal zonder punt)
 * Eerst exact: initialen-prefix + achternaam matchen.
 * Anders alleen op achternaam — werkt voor gevallen waar de eerste
 * initiaal niet overeenkomt met de roepnaam (Wies, Emma, Alain etc.).
 */
function parseRawAttorney(raw: string): { initialFirst: string; lastname: string } | null {
  // Strip alle voortitels herhaaldelijk (bv "mr. dr." = twee titels)
  let stripped = raw.trim()
  const titleRe = /^(mr\.|mevr\.|mw\.|dhr\.|mevrouw|de\s+heer|dr\.|prof\.|ir\.|drs\.)\s+/i
  while (titleRe.test(stripped)) {
    stripped = stripped.replace(titleRe, '')
  }
  const tokens = stripped.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return null

  // Initialen-prefix: eerste tokens die uit (letter[.]letter[.]…) bestaan
  const isInitialToken = (t: string) => /^[A-Za-z](?:\.\s*[A-Za-z])*\.?$/.test(t)
  let idx = 0
  while (idx < tokens.length && isInitialToken(tokens[idx])) idx++
  if (idx === 0 || idx >= tokens.length) return null

  const firstInitialChar = tokens[0].charAt(0).toUpperCase()
  const lastname = tokens.slice(idx).join(' ').toLowerCase().replace(/\s+/g, ' ')
  return { initialFirst: firstInitialChar, lastname }
}

export function matchAttorney(
  raw: string,
  users: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const parsed = parseRawAttorney(raw)
  if (!parsed) return null
  const { initialFirst, lastname } = parsed

  // Eerst: eerste initiaal + achternaam exact
  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uInit = parts[0].charAt(0).toUpperCase()
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uInit === initialFirst && uLast === lastname) return u
  }
  // Fallback: alleen achternaam (voor multi-initialen waarvan de
  // roepnaam-letter afwijkt zoals Wies, Emma, Alain)
  for (const u of users) {
    const parts = u.name.split(' ').filter(Boolean)
    const uLast = parts.slice(1).join(' ').toLowerCase()
    if (uLast === lastname) return u
  }
  return null
}
