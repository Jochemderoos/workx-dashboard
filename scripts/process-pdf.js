/**
 * Process the PDF source with Claude — extract structured legal knowledge
 * Run: node scripts/process-pdf.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

// Load .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const prisma = new PrismaClient()
const USER_ID = 'cml1u6k0700034ehqar3klcr5'

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

async function main() {
  // Find the PDF source
  const source = await prisma.aISource.findFirst({
    where: {
      userId: USER_ID,
      type: 'document',
      isProcessed: false,
      NOT: { content: null }
    }
  })

  if (!source) {
    console.log('Geen onverwerkte PDF bron gevonden')
    return
  }

  console.log(`Bron: ${source.name}`)
  console.log(`Content: ${source.content.length} tekens`)

  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Split into chunks (max 80K per chunk)
  const maxChunk = 80000
  const content = source.content
  const chunks = []

  if (content.length <= maxChunk) {
    chunks.push(content)
  } else {
    let remaining = content
    while (remaining.length > 0) {
      if (remaining.length <= maxChunk) {
        chunks.push(remaining)
        break
      }
      let split = remaining.lastIndexOf('\n\n', maxChunk)
      if (split < maxChunk * 0.5) split = remaining.lastIndexOf('. ', maxChunk)
      if (split < maxChunk * 0.5) split = maxChunk
      chunks.push(remaining.slice(0, split))
      remaining = remaining.slice(split).trim()
    }
  }

  console.log(`Verwerken in ${chunks.length} delen...`)

  const summaries = []

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Deel ${i + 1}/${chunks.length} (${chunks[i].length} tekens)...`)

    // Retry with exponential backoff for rate limits
    let retries = 0
    const maxRetries = 5
    while (retries < maxRetries) {
      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          system: KNOWLEDGE_PROMPT,
          messages: [{
            role: 'user',
            content: `Verwerk de volgende tekst uit "${source.name}" (${source.category}):\n\n${chunks[i]}`
          }]
        })

        const text = response.content.find(b => b.type === 'text')
        if (text) {
          summaries.push(text.text)
          console.log(`    -> ${text.text.length} tekens samenvatting`)
        }
        break // Success, exit retry loop
      } catch (err) {
        if (err.status === 429) {
          retries++
          const waitTime = Math.min(90 * retries, 300) // Wait 90s, 180s, 270s...
          console.log(`    Rate limit bereikt, wachten ${waitTime}s... (poging ${retries}/${maxRetries})`)
          await new Promise(r => setTimeout(r, waitTime * 1000))
        } else {
          throw err // Non-rate-limit error
        }
      }
    }

    // Wait between chunks to avoid rate limits
    if (i < chunks.length - 1) {
      console.log('    Wachten 70s voor rate limit...')
      await new Promise(r => setTimeout(r, 70000))
    }
  }

  // Consolidate if multiple chunks
  let finalSummary = summaries.join('\n\n---\n\n')

  if (summaries.length > 1) {
    console.log('Consolideren tot één samenvatting...')
    console.log('Wachten 70s voor rate limit...')
    await new Promise(r => setTimeout(r, 70000))

    let retries = 0
    while (retries < 5) {
      try {
        const consolidation = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          system: KNOWLEDGE_PROMPT,
          messages: [{
            role: 'user',
            content: `Consolideer de volgende ${summaries.length} deelsamenvatting(en) van "${source.name}" tot één samenhangende kennissamenvatting. Verwijder duplicaten maar bewaar alle unieke informatie:\n\n${finalSummary}`
          }]
        })
        const text = consolidation.content.find(b => b.type === 'text')
        if (text) {
          finalSummary = text.text
        }
        break
      } catch (e) {
        if (e.status === 429) {
          retries++
          const waitTime = 90 * retries
          console.log(`  Rate limit, wachten ${waitTime}s...`)
          await new Promise(r => setTimeout(r, waitTime * 1000))
        } else {
          console.log('Consolidatie mislukt, gebruik geconcateneerde samenvattingen')
          break
        }
      }
    }
  }

  // Save
  await prisma.aISource.update({
    where: { id: source.id },
    data: {
      summary: finalSummary,
      isProcessed: true,
      processedAt: new Date(),
    }
  })

  console.log(`\nKlaar! ${finalSummary.length} tekens kennissamenvatting opgeslagen.`)
  console.log(`Preview:\n${finalSummary.slice(0, 500)}...`)
}

main()
  .catch(err => { console.error('Fout:', err); process.exit(1) })
  .finally(() => prisma[String.fromCharCode(36) + 'disconnect']())
