// AI-samenvatting voor een recruitment-kandidaat.
// Gebruikt Claude met web_search om publiek vindbare info te zoeken
// (kantoor-biopagina's, mediavermeldingen) en distilleert tot 3 zinnen.
// Cached in DB om herhaalde zoekkosten te vermijden.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  // Alleen PARTNER + ADMIN — anders zou iedereen de API kunnen aanslaan
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!me || (me.role !== 'PARTNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI niet geconfigureerd' }, { status: 500 })
  }

  try {
    const { candidateId, force } = await req.json() as { candidateId: string; force?: boolean }
    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId ontbreekt' }, { status: 400 })
    }

    const candidate = await prisma.recruitmentCandidate.findUnique({
      where: { id: candidateId },
    })
    if (!candidate) {
      return NextResponse.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    // Cache: gebruik bestaande samenvatting tenzij ouder dan 30 dagen of force=true
    if (!force && candidate.aiSummary && candidate.aiSummaryAt) {
      const ageDays = (Date.now() - candidate.aiSummaryAt.getTime()) / (24 * 60 * 60 * 1000)
      if (ageDays < 30) {
        return NextResponse.json({
          summary: candidate.aiSummary,
          cached: true,
          ageDays: Math.round(ageDays),
        })
      }
    }

    const prompt = `Zoek publiek vindbare informatie over deze advocaat en geef een bondige samenvatting van 3 zinnen.

Naam: ${candidate.name}
${candidate.currentOffice ? `Huidig kantoor: ${candidate.currentOffice}` : ''}
${candidate.experienceYear ? `Ervaring: ${candidate.experienceYear} jaar` : ''}

Zoek op web naar:
1. Het kantoor-biopagina (bv. ${candidate.currentOffice ? candidate.currentOffice.toLowerCase().split(' ')[0] : 'advocatenkantoor'}.nl/team/...)
2. Eventuele media-vermeldingen of artikelen
3. LinkedIn-profiel meta-info via Google

Geef in maximaal 3 zinnen:
- Achtergrond (opleiding, vorige kantoren)
- Specialisatie / expertise binnen arbeidsrecht of M&A
- Signalen over partner-ambities, ondernemerschap of bijzondere kwaliteiten

Schrijf in feitelijke, professionele toon. Begin direct met de samenvatting — geen inleiding. Als je weinig vindt, zeg dat eerlijk.

Vermeld bron-URLs aan het einde als markdown-links (bv. [Workx bio](https://...))`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      tools: [{
        type: 'web_search_20250305' as any,
        name: 'web_search',
        max_uses: 5,
      }],
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract text content
    let summary = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        summary += block.text
      }
    }
    summary = summary.trim()

    if (!summary) {
      return NextResponse.json({ error: 'AI gaf geen samenvatting terug' }, { status: 500 })
    }

    // Cache
    await prisma.recruitmentCandidate.update({
      where: { id: candidateId },
      data: { aiSummary: summary, aiSummaryAt: new Date() },
    })

    return NextResponse.json({ summary, cached: false })
  } catch (error) {
    console.error('[recruitment/ai-summary] mislukt:', error)
    return NextResponse.json({ error: 'AI-samenvatting mislukt' }, { status: 500 })
  }
}
