import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Weekly Cron Job — Crawl all active website sources for new content
 * Triggered by Vercel Cron every Monday at 03:00 CET
 *
 * For each active website source:
 * 1. Fetch content (with credentials if available)
 * 2. Compare with existing content
 * 3. Process new content with Claude
 * 4. Update the knowledge summary
 */

const CRON_SECRET = process.env.CRON_SECRET

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

Schrijf in het Nederlands. Wees uitgebreid maar gestructureerd. Focus op arbeidsrecht.
Let extra op NIEUWE rechtspraak en recente ontwikkelingen.`

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const log: string[] = []
  const addLog = (msg: string) => {
    console.log(`[cron] ${msg}`)
    log.push(msg)
  }

  addLog(`Wekelijkse crawl gestart: ${new Date().toISOString()}`)

  try {
    // Find all active website sources with URLs
    const sources = await prisma.aISource.findMany({
      where: {
        type: 'website',
        isActive: true,
        url: { not: null },
      },
    })

    addLog(`${sources.length} actieve website-bronnen gevonden`)

    const results: Array<{ name: string; success: boolean; newContent: boolean; error?: string }> = []

    for (const source of sources) {
      addLog(`\nVerwerken: ${source.name}`)

      try {
        const creds = source.credentials ? JSON.parse(source.credentials) : null
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (compatible; WorkxAI/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9',
        }
        if (creds?.cookie) headers['Cookie'] = creds.cookie
        if (creds?.token) headers['Authorization'] = `Bearer ${creds.token}`

        // Fetch main page
        const response = await fetch(source.url!, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
          addLog(`  HTTP ${response.status} — skip`)
          results.push({ name: source.name, success: false, newContent: false, error: `HTTP ${response.status}` })
          continue
        }

        const html = await response.text()

        // Extract text
        const newContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100000)

        if (newContent.length < 200) {
          addLog(`  Onvoldoende content (${newContent.length} tekens) — mogelijk login vereist`)
          results.push({ name: source.name, success: false, newContent: false, error: 'Te weinig content' })
          continue
        }

        // Check if content has changed significantly
        const oldContent = source.content || ''
        const contentChanged = newContent.length !== oldContent.length ||
          newContent.slice(0, 1000) !== oldContent.slice(0, 1000)

        if (!contentChanged && source.isProcessed) {
          addLog(`  Geen nieuwe content — skip`)
          results.push({ name: source.name, success: true, newContent: false })
          continue
        }

        addLog(`  Nieuwe content: ${newContent.length} tekens`)

        // Update raw content
        await prisma.aISource.update({
          where: { id: source.id },
          data: {
            content: newContent,
            lastSynced: new Date(),
          },
        })

        // Process with Claude
        addLog(`  Claude verwerkt...`)
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const contentToProcess = newContent.slice(0, 80000)
        const response2 = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          system: KNOWLEDGE_PROMPT,
          messages: [{
            role: 'user',
            content: `Verwerk de volgende recente content uit "${source.name}" (${source.category}). Focus op NIEUWE informatie ten opzichte van eerdere kennis:\n\n${contentToProcess}`,
          }],
        })

        const textBlock = response2.content.find(b => b.type === 'text')
        if (textBlock && textBlock.type === 'text') {
          // Append new knowledge to existing summary
          const existingSummary = source.summary || ''
          const updatedSummary = existingSummary
            ? `${existingSummary}\n\n---\n\n## Update ${new Date().toLocaleDateString('nl-NL')}\n\n${textBlock.text}`
            : textBlock.text

          await prisma.aISource.update({
            where: { id: source.id },
            data: {
              summary: updatedSummary.slice(0, 200000), // Cap at 200K
              isProcessed: true,
              processedAt: new Date(),
            },
          })

          addLog(`  Verwerkt! +${textBlock.text.length} tekens kennis`)
          results.push({ name: source.name, success: true, newContent: true })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Onbekende fout'
        addLog(`  FOUT: ${msg}`)
        results.push({ name: source.name, success: false, newContent: false, error: msg })
      }

      // Rate limit pause between sources
      await new Promise(r => setTimeout(r, 5000))
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    const processed = results.filter(r => r.success && r.newContent).length
    const unchanged = results.filter(r => r.success && !r.newContent).length
    const failed = results.filter(r => !r.success).length

    addLog(`\nKlaar in ${duration}s: ${processed} verwerkt, ${unchanged} ongewijzigd, ${failed} mislukt`)

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      processed,
      unchanged,
      failed,
      results,
      log,
    })
  } catch (error) {
    addLog(`FATAL: ${error instanceof Error ? error.message : 'Onbekende fout'}`)
    return NextResponse.json({ error: 'Cron job mislukt', log }, { status: 500 })
  }
}
