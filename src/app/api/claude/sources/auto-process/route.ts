import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Auto-Process: verwerk automatisch alle onverwerkte bronnen
 * Wordt aangeroepen bij het laden van de AI pagina
 * en kan ook via cron worden aangeroepen
 */

const KNOWLEDGE_PROMPT = `Je bent een juridisch kennissysteem voor Workx Advocaten (arbeidsrecht, Amsterdam).

Verwerk de volgende tekst tot een gestructureerde kennissamenvatting. Gebruik deze structuur:

## Wetsartikelen & Regelgeving
- Exacte artikelnummers en inhoud

## Rechtspraak
- ECLI-nummers, datum, rechtsregel, kernbeslissing

## Juridische Principes
- Vuistregels, berekeningswijzen, termijnen

## Praktijktips
- Concrete tips voor arbeidsrechtadvocaten

Schrijf in het Nederlands. Wees uitgebreid maar gestructureerd. Focus op arbeidsrecht.`

// POST: verwerk alle onverwerkte bronnen voor de ingelogde gebruiker
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Find unprocessed sources with content
  const unprocessed = await prisma.aISource.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      isProcessed: false,
      content: { not: null },
    },
    select: {
      id: true,
      name: true,
      category: true,
      content: true,
    },
  })

  if (unprocessed.length === 0) {
    return NextResponse.json({ message: 'Alle bronnen zijn al verwerkt', processed: 0 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: Array<{ id: string; name: string; success: boolean; summaryLength?: number }> = []

  for (const source of unprocessed) {
    if (!source.content || source.content.length < 50) continue

    try {
      const fullContent = source.content || ''

      // Split into chunks for large documents (same approach as ingest)
      const chunkSize = 80000
      const chunks: string[] = []
      let remaining = fullContent
      while (remaining.length > 0) {
        if (remaining.length <= chunkSize) {
          chunks.push(remaining)
          break
        }
        let splitPoint = remaining.lastIndexOf('\n\n', chunkSize)
        if (splitPoint < chunkSize * 0.5) splitPoint = remaining.lastIndexOf('. ', chunkSize)
        if (splitPoint < chunkSize * 0.5) splitPoint = chunkSize
        chunks.push(remaining.slice(0, splitPoint))
        remaining = remaining.slice(splitPoint).trim()
      }

      const summaries: string[] = []
      for (let i = 0; i < chunks.length; i++) {
        const chunkLabel = chunks.length > 1 ? `\n\n[Deel ${i + 1} van ${chunks.length}]` : ''
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 16000,
          system: KNOWLEDGE_PROMPT,
          messages: [{
            role: 'user',
            content: `Verwerk de volgende tekst uit "${source.name}" (${source.category}) tot een uitgebreide kennissamenvatting. Bewaar zoveel mogelijk detail:${chunkLabel}\n\n${chunks[i]}`,
          }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (textBlock && textBlock.type === 'text') {
          summaries.push(textBlock.text)
        }
      }

      if (summaries.length > 0) {
        const finalSummary = summaries.join('\n\n---\n\n')
        await prisma.aISource.update({
          where: { id: source.id },
          data: {
            summary: finalSummary,
            isProcessed: true,
            processedAt: new Date(),
          },
        })

        results.push({ id: source.id, name: source.name, success: true, summaryLength: finalSummary.length })
      }
    } catch (error) {
      console.error(`Failed to process source ${source.name}:`, error)
      results.push({ id: source.id, name: source.name, success: false })
    }
  }

  return NextResponse.json({
    processed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  })
}
