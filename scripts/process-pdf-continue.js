/**
 * Continue processing the PDF source (starting from chunk 5)
 * Previous chunks 1-4 already processed successfully
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

// Load env files
function loadEnv(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('#') || !line.includes('=')) continue
      const idx = line.indexOf('=')
      const key = line.substring(0, idx).trim()
      let val = line.substring(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1)
      if (key && !(key in process.env)) process.env[key] = val
    }
  } catch (e) { /* skip */ }
}
loadEnv('.env')
loadEnv('.env.local')

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
  const source = await prisma.aISource.findFirst({
    where: { userId: USER_ID, type: 'document', name: { contains: 'Themata' } }
  })

  if (!source || !source.content) {
    console.log('Bron niet gevonden')
    return
  }

  console.log(`Bron: ${source.name}`)
  console.log(`Content: ${source.content.length} tekens`)

  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Split into chunks
  const maxChunk = 80000
  const content = source.content
  const chunks = []
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

  console.log(`${chunks.length} delen totaal, verwerken vanaf deel 5...\n`)

  // Skip first 4 chunks (already processed)
  const startFrom = 4
  const summaries = []

  for (let i = startFrom; i < chunks.length; i++) {
    console.log(`  Deel ${i + 1}/${chunks.length} (${chunks[i].length} tekens)...`)

    let retries = 0
    while (retries < 5) {
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
        break
      } catch (err) {
        if (err.status === 429) {
          retries++
          const waitTime = Math.min(90 * retries, 300)
          console.log(`    Rate limit, wachten ${waitTime}s... (${retries}/5)`)
          await new Promise(r => setTimeout(r, waitTime * 1000))
        } else {
          throw err
        }
      }
    }

    // Wait between chunks
    if (i < chunks.length - 1) {
      console.log('    Wachten 75s...')
      await new Promise(r => setTimeout(r, 75000))
    }
  }

  // Save the partial summaries — we'll combine with existing data
  // Just save what we have for now
  const partialSummary = summaries.join('\n\n---\n\n')

  // Read existing summary if any, or combine later
  const existingSummary = source.summary || ''
  const combinedSummary = existingSummary
    ? existingSummary + '\n\n---\n\n' + partialSummary
    : partialSummary

  await prisma.aISource.update({
    where: { id: source.id },
    data: {
      summary: combinedSummary,
      isProcessed: true,
      processedAt: new Date(),
    }
  })

  console.log(`\nKlaar! ${combinedSummary.length} tekens totale kennissamenvatting opgeslagen.`)
}

main()
  .catch(err => { console.error('Fout:', err.message || err); process.exit(1) })
  .finally(() => prisma[String.fromCharCode(36) + 'disconnect']())
