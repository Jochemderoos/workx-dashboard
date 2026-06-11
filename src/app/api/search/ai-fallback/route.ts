// AI-fallback voor de zoekfunctie. Wordt aangeroepen door CommandPalette
// wanneer de rule-based engine 0 of zwakke matches geeft. Stuurt de query
// + een compacte versie van de search-index naar Claude Haiku en vraagt
// om de 3 meest relevante items + één-zin reden.
//
// Goedkoop (~$0,0008/query) en snel (~1s). Alleen pagina-titels +
// beschrijvingen gaan naar Anthropic — geen body-content, geen
// cliëntnamen.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildSearchIndex } from '@/lib/search-index'

export const runtime = 'nodejs'
export const maxDuration = 30

// Simpele per-user rate limit zodat de search niet vol-pikt
const rateLimit = new Map<string, { count: number; resetAt: number }>()
function checkRate(userId: string, max = 60, windowMs = 3600_000): boolean {
  const now = Date.now()
  const e = rateLimit.get(userId)
  if (!e || now > e.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (e.count >= max) return false
  e.count++
  return true
}

interface AISuggestion {
  href: string
  label: string
  reason: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!checkRate(session.user.id)) {
    return NextResponse.json({ suggestions: [] })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestions: [] })
  }

  let query = ''
  try {
    const body = await req.json()
    query = String(body?.query || '').trim()
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
  }
  if (!query || query.length < 2 || query.length > 200) {
    return NextResponse.json({ suggestions: [] })
  }

  // Bouw een compacte representatie van de index — alleen titel/desc/section,
  // GEEN bodies (te groot en bevat soms gevoelige info).
  const index = buildSearchIndex()
  const compact = index
    .filter(i => i.kind !== 'doc' || i.label.length > 0) // alle items
    .map(i => ({
      href: i.href,
      label: i.label,
      kind: i.kind,
      desc: i.description?.slice(0, 120),
      section: i.section,
    }))

  const systemPrompt = [
    'Je bent een zoek-assistent voor het Workx Advocaten dashboard.',
    'Je krijgt een zoekopdracht van een gebruiker en een lijst van alle beschikbare pagina\'s, documenten, gegevens, acties en mensen op het dashboard.',
    'Antwoord met de 1 tot 3 meest relevante items en geef per item een korte uitleg (max 60 tekens) waarom dat past.',
    'ALLEEN als er echt iets relevants is. Antwoord met JSON: { "suggestions": [{ "href": "...", "label": "...", "reason": "..." }] }',
    'Geen extra tekst, alleen valid JSON. Als niks relevant is: { "suggestions": [] }.',
  ].join(' ')

  const userPrompt = [
    `Zoekopdracht: "${query}"`,
    '',
    'Beschikbare items (JSON):',
    JSON.stringify(compact),
  ].join('\n')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Pak de tekst
    const txt = resp.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n')
      .trim()

    // Strip eventuele markdown-fencing
    const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    let parsed: { suggestions?: AISuggestion[] }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ suggestions: [] })
    }

    // Valideer dat hrefs in onze index voorkomen — voorkom hallucinaties
    const validHrefs = new Set(index.map(i => i.href))
    const safe = (parsed.suggestions || [])
      .filter(s => s && typeof s.href === 'string' && validHrefs.has(s.href))
      .slice(0, 3)

    return NextResponse.json({ suggestions: safe })
  } catch (err) {
    console.error('AI fallback failed', err)
    return NextResponse.json({ suggestions: [] })
  }
}
