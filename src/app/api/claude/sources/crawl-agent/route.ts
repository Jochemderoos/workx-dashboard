import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Crawl Agent — Systematisch juridische content ophalen en verwerken
 *
 * Ondersteunt:
 * - InView.nl (Arbeidsrecht tijdschrift, RAR, JAR)
 * - VAAN AR Updates
 * - Rechtspraak.nl
 * - Elke website met gestructureerde content
 *
 * POST body: { sourceId: string, mode: 'full' | 'recent' }
 */

const KNOWLEDGE_PROMPT = `Je bent een juridisch kennissysteem. Verwerk de volgende tekst tot een gestructureerde kennissamenvatting.

Focus op:
1. Wetsartikelen met exacte nummers (art. 7:669 BW, etc.)
2. Rechtspraak: ECLI-nummers, rechtsregels, kernbeslissingen
3. Juridische principes en vuistregels
4. Berekeningen en termijnen
5. Praktijktips voor arbeidsrechtadvocaten

Schrijf in het Nederlands. Wees uitgebreid maar gestructureerd.`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { sourceId, mode = 'full' } = await req.json()

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is verplicht' }, { status: 400 })
  }

  const source = await prisma.aISource.findFirst({
    where: { id: sourceId, userId: session.user.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  if (!source.url) {
    return NextResponse.json({ error: 'Bron heeft geen URL' }, { status: 400 })
  }

  const creds = source.credentials ? JSON.parse(source.credentials) : null

  // Stream response as SSE for real-time progress
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }

      try {
        send('status', 'Agent gestart...')

        // Step 1: Crawl the source
        send('status', 'Content ophalen van ' + source.name + '...')
        const crawlResult = await crawlSource(source.url!, creds, mode, (msg) => send('status', msg))

        send('status', `${crawlResult.pages.length} pagina\'s opgehaald (${crawlResult.totalChars} tekens)`)

        if (crawlResult.totalChars < 100) {
          send('error', 'Onvoldoende content gevonden. Mogelijk zijn inloggegevens vereist.')
          controller.close()
          return
        }

        // Step 2: Update raw content
        const rawContent = crawlResult.pages
          .map(p => `[${p.title || p.url}]\n${p.content}`)
          .join('\n\n---\n\n')
          .slice(0, 500000)

        await prisma.aISource.update({
          where: { id: source.id },
          data: {
            content: rawContent,
            pagesCrawled: crawlResult.pages.length,
            lastSynced: new Date(),
          },
        })

        send('status', 'Content opgeslagen. Claude gaat nu de kennis verwerken...')

        // Step 3: Process with Claude
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const chunks = splitText(rawContent, 80000)
        const summaries: string[] = []

        for (let i = 0; i < chunks.length; i++) {
          send('status', `Claude verwerkt deel ${i + 1} van ${chunks.length}...`)

          const response = await client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            system: KNOWLEDGE_PROMPT,
            messages: [{
              role: 'user',
              content: `Verwerk de volgende tekst uit "${source.name}" (${source.category}):\n\n${chunks[i]}`,
            }],
          })

          const text = response.content.find(b => b.type === 'text')
          if (text && text.type === 'text') {
            summaries.push(text.text)
          }
        }

        // Step 4: Consolidate if multiple chunks
        let finalSummary = summaries.join('\n\n---\n\n')

        if (summaries.length > 1) {
          send('status', 'Kennis consolideren tot één samenvatting...')
          try {
            const consolidation = await client.messages.create({
              model: 'claude-sonnet-4-5-20250929',
              max_tokens: 8000,
              system: KNOWLEDGE_PROMPT,
              messages: [{
                role: 'user',
                content: `Consolideer de volgende ${summaries.length} deelsamenvatting(en) van "${source.name}" tot één samenhangende kennissamenvatting. Verwijder duplicaten maar bewaar alle unieke informatie:\n\n${finalSummary}`,
              }],
            })
            const text = consolidation.content.find(b => b.type === 'text')
            if (text && text.type === 'text') {
              finalSummary = text.text
            }
          } catch {
            // Keep concatenated summaries
          }
        }

        // Step 5: Save processed knowledge
        await prisma.aISource.update({
          where: { id: source.id },
          data: {
            summary: finalSummary,
            isProcessed: true,
            processedAt: new Date(),
          },
        })

        send('status', `Verwerking voltooid! ${finalSummary.length} tekens kennis opgeslagen.`)
        send('result', JSON.stringify({
          pagesProcessed: crawlResult.pages.length,
          totalChars: crawlResult.totalChars,
          summaryLength: finalSummary.length,
          preview: finalSummary.slice(0, 300),
        }))
        send('done', '')
      } catch (error) {
        console.error('Crawl agent error:', error)
        send('error', 'Agent fout: ' + (error instanceof Error ? error.message : 'Onbekende fout'))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

interface CrawlPage {
  url: string
  title: string
  content: string
}

interface CrawlResult {
  pages: CrawlPage[]
  totalChars: number
}

async function crawlSource(
  baseUrl: string,
  creds: { email?: string; password?: string; cookie?: string; token?: string } | null,
  mode: string,
  onStatus: (msg: string) => void
): Promise<CrawlResult> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
  }

  if (creds?.cookie) headers['Cookie'] = creds.cookie
  if (creds?.token) headers['Authorization'] = `Bearer ${creds.token}`

  const visited = new Set<string>()
  const pages: CrawlPage[] = []
  const maxPages = mode === 'full' ? 30 : 10
  const baseHost = new URL(baseUrl).hostname

  async function fetchPage(url: string): Promise<{ html: string; ok: boolean }> {
    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) return { html: '', ok: false }
      return { html: await response.text(), ok: true }
    } catch {
      return { html: '', ok: false }
    }
  }

  function extractContent(html: string): { title: string; content: string; links: string[] } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''

    // Extract main content (remove nav, footer, scripts, styles)
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      // Keep article/main content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    // Extract links
    const linkRegex = /href="([^"]+)"/g
    const links: string[] = []
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const link = new URL(match[1], baseUrl)
        if (
          link.hostname === baseHost &&
          !link.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|pdf|zip)$/i) &&
          !link.pathname.includes('/login') &&
          !link.pathname.includes('/account') &&
          !link.hash
        ) {
          links.push(link.href)
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return { title, content, links }
  }

  // Start crawling
  async function crawl(url: string, depth: number): Promise<void> {
    if (visited.size >= maxPages || depth > 3) return
    if (visited.has(url)) return
    visited.add(url)

    onStatus(`Pagina ${visited.size}/${maxPages}: ${url.slice(0, 60)}...`)

    const { html, ok } = await fetchPage(url)
    if (!ok || !html) return

    const { title, content, links } = extractContent(html)

    if (content.length > 200) {
      pages.push({ url, title, content: content.slice(0, 30000) })
    }

    // Follow relevant links
    if (depth < 3) {
      // Prioritize article/content links over navigation
      const relevantLinks = links.filter(l =>
        l.includes('artikel') ||
        l.includes('uitspraak') ||
        l.includes('rechtspraak') ||
        l.includes('content') ||
        l.includes('detail') ||
        l.includes('update') ||
        l.includes('publicatie') ||
        // Default: follow most links at depth 1
        depth === 0
      )

      const uniqueLinks = Array.from(new Set(relevantLinks))
      for (const link of uniqueLinks.slice(0, 8)) {
        if (visited.size >= maxPages) break
        await crawl(link, depth + 1)
      }
    }
  }

  await crawl(baseUrl, 0)

  const totalChars = pages.reduce((sum, p) => sum + p.content.length, 0)
  return { pages, totalChars }
}

function splitText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining)
      break
    }
    let split = remaining.lastIndexOf('\n\n', maxSize)
    if (split < maxSize * 0.5) split = remaining.lastIndexOf('. ', maxSize)
    if (split < maxSize * 0.5) split = maxSize
    chunks.push(remaining.slice(0, split))
    remaining = remaining.slice(split).trim()
  }
  return chunks
}
