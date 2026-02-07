import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Rechtspraak.nl Open Data API integratie
 * Zoekt naar ECLI uitspraken via data.rechtspraak.nl
 * Documentatie: https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx
 */

const RECHTSPRAAK_SEARCH_URL = 'https://data.rechtspraak.nl/uitspraken/zoeken'
const RECHTSPRAAK_CONTENT_URL = 'https://data.rechtspraak.nl/uitspraken/content'

interface RechtspraakResult {
  ecli: string
  title: string
  date: string
  court: string
  summary: string
  url: string
}

// GET: zoek rechtspraak
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const rechtsgebied = searchParams.get('rechtsgebied') || 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht'
  const max = searchParams.get('max') || '10'
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to') // YYYY-MM-DD

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Zoekterm is verplicht' }, { status: 400 })
  }

  try {
    // Build search URL with parameters
    const params = new URLSearchParams({
      q: query,
      max: max,
      return: 'DOC',
      sort: 'DESC',
    })

    // Add optional filters
    if (rechtsgebied) params.append('subject', rechtsgebied)
    if (from) params.append('date', `>=${from}`)
    if (to) params.append('date', `<=${to}`)

    const response = await fetch(`${RECHTSPRAAK_SEARCH_URL}?${params}`, {
      headers: { Accept: 'application/xml' },
    })

    if (!response.ok) {
      throw new Error(`Rechtspraak API error: ${response.status}`)
    }

    const xml = await response.text()
    const results = parseRechtspraakXml(xml)

    return NextResponse.json({
      results,
      total: results.length,
      query,
    })
  } catch (error) {
    console.error('Rechtspraak search error:', error)
    return NextResponse.json(
      { error: 'Kon rechtspraak niet doorzoeken. Probeer het later opnieuw.' },
      { status: 500 }
    )
  }
}

// POST: haal volledige uitspraak op via ECLI
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { ecli } = await req.json()

  if (!ecli?.trim()) {
    return NextResponse.json({ error: 'ECLI is verplicht' }, { status: 400 })
  }

  try {
    const response = await fetch(`${RECHTSPRAAK_CONTENT_URL}?id=${encodeURIComponent(ecli)}`, {
      headers: { Accept: 'application/xml' },
    })

    if (!response.ok) {
      throw new Error(`Rechtspraak content error: ${response.status}`)
    }

    const xml = await response.text()
    const content = parseRechtspraakContent(xml)

    return NextResponse.json(content)
  } catch (error) {
    console.error('Rechtspraak content error:', error)
    return NextResponse.json(
      { error: 'Kon uitspraak niet ophalen.' },
      { status: 500 }
    )
  }
}

/** Parse search results XML from rechtspraak.nl */
function parseRechtspraakXml(xml: string): RechtspraakResult[] {
  const results: RechtspraakResult[] = []

  // Parse feed entries - rechtspraak returns Atom XML
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    const ecli = extractTag(entry, 'id') || ''
    const title = extractTag(entry, 'title') || ''
    const updated = extractTag(entry, 'updated') || ''
    const summary = extractTag(entry, 'summary') || ''

    // Extract court from ECLI (format: ECLI:NL:RBAMS:2023:1234)
    const ecliParts = ecli.split(':')
    const courtCode = ecliParts[2] || ''

    results.push({
      ecli,
      title: cleanHtml(title),
      date: updated ? updated.split('T')[0] : '',
      court: courtCodeToName(courtCode),
      summary: cleanHtml(summary).slice(0, 500),
      url: `https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(ecli)}`,
    })
  }

  return results
}

/** Parse full content XML for a single ruling */
function parseRechtspraakContent(xml: string): {
  ecli: string
  title: string
  date: string
  court: string
  content: string
  url: string
} {
  const ecli = extractTag(xml, 'dcterms:identifier') || extractTag(xml, 'rdf:Description')?.match(/ecli="([^"]+)"/)?.[1] || ''
  const title = extractTag(xml, 'dcterms:title') || ''
  const date = extractTag(xml, 'dcterms:date') || ''

  // Extract the main body text
  let content = ''
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g
  let sectionMatch
  while ((sectionMatch = sectionRegex.exec(xml)) !== null) {
    content += cleanHtml(sectionMatch[1]) + '\n\n'
  }

  // Fallback: extract from inhoudsindicatie or any text content
  if (!content) {
    const inhoud = extractTag(xml, 'inhoudsindicatie') || ''
    const uitspraak = extractTag(xml, 'uitspraak') || ''
    content = cleanHtml(inhoud || uitspraak || xml)
  }

  return {
    ecli,
    title: cleanHtml(title),
    date,
    court: '',
    content: content.trim().slice(0, 50000), // Max 50K chars
    url: ecli ? `https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(ecli)}` : '',
  }
}

/** Extract content of an XML tag */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

/** Strip HTML/XML tags */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Convert rechtspraak court code to readable name */
function courtCodeToName(code: string): string {
  const courts: Record<string, string> = {
    RBAMS: 'Rechtbank Amsterdam',
    RBDHA: 'Rechtbank Den Haag',
    RBROT: 'Rechtbank Rotterdam',
    RBMNE: 'Rechtbank Midden-Nederland',
    RBNHO: 'Rechtbank Noord-Holland',
    RBOBR: 'Rechtbank Oost-Brabant',
    RBGEL: 'Rechtbank Gelderland',
    RBLIM: 'Rechtbank Limburg',
    RBOVE: 'Rechtbank Overijssel',
    RBNNE: 'Rechtbank Noord-Nederland',
    RBZWB: 'Rechtbank Zeeland-West-Brabant',
    GHAMS: 'Gerechtshof Amsterdam',
    GHDHA: 'Gerechtshof Den Haag',
    GHSHE: "Gerechtshof 's-Hertogenbosch",
    GHARL: 'Gerechtshof Arnhem-Leeuwarden',
    HR: 'Hoge Raad',
    PHR: 'Parket bij de Hoge Raad',
    CRVB: 'Centrale Raad van Beroep',
    CBHO: 'College van Beroep voor het Hoger Onderwijs',
  }
  return courts[code] || code
}
