import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const KNOWLEDGE_EXTRACTION_PROMPT = `Je bent een juridisch kennissysteem voor een Nederlands arbeidsrechtadvocatenkantoor (Workx Advocaten, Amsterdam).

Je taak is om de volgende brontekst te verwerken tot een gestructureerde kennissamenvatting die je later kunt gebruiken om juridische vragen te beantwoorden.

## Instructies
1. Extraheer ALLE relevante juridische kennis uit de tekst
2. Structureer de kennis in de volgende categorieën (voor zover van toepassing):

### Wetsartikelen & Regelgeving
- Vermeld exacte artikelnummers (bijv. art. 7:669 BW)
- Beschrijf de inhoud/strekking kort

### Rechtspraak & Jurisprudentie
- ECLI-nummers en datum
- Rechtsregel / kernoverweging
- Relevantie voor de praktijk

### Juridische Principes & Regels
- Belangrijke arbeidsrechtelijke principes
- Vuistregels voor de praktijk
- Berekeningswijzen (transitievergoeding, opzegtermijnen, etc.)

### Procedures & Termijnen
- Relevante termijnen en verjaringstermijnen
- Procedurestappen (UWV, kantonrechter, hoger beroep)

### Praktijktips & Aandachtspunten
- Concrete tips voor advocaten
- Veelvoorkomende valkuilen
- Best practices

## Regels
- Schrijf in het Nederlands
- Wees precies met bronvermeldingen (artikelnummers, ECLI-nummers)
- Focus op PRAKTISCH bruikbare kennis
- Als de tekst over meerdere rechtsgebieden gaat, focus op arbeidsrecht
- Bewaar zoveel mogelijk detail — deze samenvatting wordt gebruikt als kennisbasis
- Geef aan als informatie mogelijk verouderd kan zijn
- Vermeld specifieke bedragen, percentages en berekeningen waar relevant`

// POST: verwerk bron tot gestructureerde kennis
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const source = await prisma.aISource.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  const { deepCrawl } = await req.json().catch(() => ({ deepCrawl: false }))

  // Step 1: Gather content
  let fullContent = source.content || ''
  let pagesCrawled = source.pagesCrawled || 0

  // For website sources: optionally deep crawl
  if (source.type === 'website' && source.url && deepCrawl) {
    try {
      const crawlResult = await deepCrawlWebsite(source.url, source.credentials)
      fullContent = crawlResult.content
      pagesCrawled = crawlResult.pagesCrawled

      // Update raw content
      await prisma.aISource.update({
        where: { id: source.id },
        data: {
          content: fullContent.slice(0, 500000),
          pagesCrawled,
          lastSynced: new Date(),
        },
      })
    } catch (error) {
      console.error('Deep crawl failed:', error)
      // Continue with existing content
    }
  }

  if (!fullContent || fullContent.length < 50) {
    return NextResponse.json(
      { error: 'Onvoldoende content om te verwerken. Synchroniseer eerst de bron.' },
      { status: 400 }
    )
  }

  // Step 2: Process content with Claude to extract structured knowledge
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Split content into chunks if too large (Claude context limit)
    const chunks = splitIntoChunks(fullContent, 80000)
    const summaries: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunkLabel = chunks.length > 1
        ? `\n\n[Deel ${i + 1} van ${chunks.length}]`
        : ''

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        system: KNOWLEDGE_EXTRACTION_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Verwerk de volgende tekst uit de bron "${source.name}" (categorie: ${source.category}) tot een gestructureerde kennissamenvatting:${chunkLabel}\n\n---\n\n${chunks[i]}\n\n---\n\nMaak een uitgebreide, gestructureerde samenvatting van alle juridische kennis in deze tekst.`,
          },
        ],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        summaries.push(textBlock.text)
      }
    }

    // If multiple chunks, create a combined summary
    let finalSummary = summaries.join('\n\n---\n\n')

    // If we had multiple chunks, do a final consolidation pass
    if (summaries.length > 1) {
      try {
        const consolidation = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          system: KNOWLEDGE_EXTRACTION_PROMPT,
          messages: [
            {
              role: 'user',
              content: `De volgende kennissamenvatting is gemaakt uit ${summaries.length} delen van de bron "${source.name}". Consolideer dit tot één samenhangende kennissamenvatting. Verwijder duplicaten maar bewaar alle unieke informatie:\n\n${finalSummary}`,
            },
          ],
        })
        const textBlock = consolidation.content.find((b) => b.type === 'text')
        if (textBlock && textBlock.type === 'text') {
          finalSummary = textBlock.text
        }
      } catch {
        // Keep the concatenated summaries if consolidation fails
      }
    }

    // Step 3: Save the processed knowledge
    const updated = await prisma.aISource.update({
      where: { id: source.id },
      data: {
        summary: finalSummary,
        isProcessed: true,
        processedAt: new Date(),
        pagesCrawled,
      },
    })

    return NextResponse.json({
      success: true,
      summaryLength: finalSummary.length,
      chunksProcessed: chunks.length,
      pagesCrawled,
      processedAt: updated.processedAt,
      // Return first 500 chars as preview
      preview: finalSummary.slice(0, 500) + (finalSummary.length > 500 ? '...' : ''),
    })
  } catch (error) {
    console.error('Knowledge extraction error:', error)
    return NextResponse.json(
      { error: 'Kennisverwerking mislukt. Probeer het later opnieuw.' },
      { status: 500 }
    )
  }
}

/** Deep crawl a website: fetch the main page + follow internal links */
async function deepCrawlWebsite(
  baseUrl: string,
  credentialsJson: string | null
): Promise<{ content: string; pagesCrawled: number }> {
  const creds = credentialsJson ? JSON.parse(credentialsJson) : null
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; WorkxAI/1.0)',
  }
  if (creds?.cookie) headers['Cookie'] = creds.cookie
  if (creds?.token) headers['Authorization'] = `Bearer ${creds.token}`

  const visited = new Set<string>()
  const allContent: string[] = []
  const maxPages = 15 // Limit to prevent excessive crawling
  const baseHost = new URL(baseUrl).hostname

  async function crawlPage(url: string, depth: number): Promise<void> {
    if (visited.size >= maxPages || depth > 2) return
    if (visited.has(url)) return

    visited.add(url)

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) return

      const html = await response.text()

      // Extract text content
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (textContent.length > 100) {
        allContent.push(`[Pagina: ${url}]\n${textContent}`)
      }

      // Extract links for further crawling (only same-host, relevant paths)
      if (depth < 2) {
        const linkRegex = /href="([^"]+)"/g
        let match
        const links: string[] = []

        while ((match = linkRegex.exec(html)) !== null) {
          try {
            const link = new URL(match[1], url)
            if (
              link.hostname === baseHost &&
              !link.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|pdf)$/i) &&
              !link.hash &&
              !visited.has(link.href)
            ) {
              links.push(link.href)
            }
          } catch {
            // Invalid URL
          }
        }

        // Crawl up to 5 links per page
        for (const link of links.slice(0, 5)) {
          await crawlPage(link, depth + 1)
        }
      }
    } catch {
      // Skip failed pages
    }
  }

  await crawlPage(baseUrl, 0)

  return {
    content: allContent.join('\n\n---\n\n').slice(0, 500000),
    pagesCrawled: visited.size,
  }
}

/** Split text into chunks for processing */
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining)
      break
    }

    // Try to split at a paragraph boundary
    let splitPoint = remaining.lastIndexOf('\n\n', maxChunkSize)
    if (splitPoint < maxChunkSize * 0.5) {
      // No good paragraph boundary, try sentence boundary
      splitPoint = remaining.lastIndexOf('. ', maxChunkSize)
    }
    if (splitPoint < maxChunkSize * 0.5) {
      // No good boundary, force split
      splitPoint = maxChunkSize
    }

    chunks.push(remaining.slice(0, splitPoint))
    remaining = remaining.slice(splitPoint).trim()
  }

  return chunks
}
