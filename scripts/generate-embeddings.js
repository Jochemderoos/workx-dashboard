/**
 * Script: Embeddings genereren voor alle SourceChunks
 *
 * Gebruik:
 *   node scripts/generate-embeddings.js [--source-id <id>]
 *
 * Vereist: OPENAI_API_KEY in .env
 *
 * Verwerkt chunks in batches van 50, met rate limiting.
 * Kan veilig opnieuw gestart worden — slaat chunks over die al een embedding hebben.
 */

const fs = require('fs')
const path = require('path')

// Load .env and .env.local manually (no dotenv dependency needed)
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* file doesn't exist, skip */ }
}
loadEnvFile(path.join(__dirname, '..', '.env.local'))
loadEnvFile(path.join(__dirname, '..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const BATCH_SIZE = 50
const DELAY_MS = 500 // Half second between batches to respect rate limits

async function generateEmbeddingsBatch(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts.map(t => t.slice(0, 32000)),
      dimensions: 1536,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API fout (${response.status}): ${error}`)
  }

  const data = await response.json()
  const sorted = data.data.sort((a, b) => a.index - b.index)
  return sorted.map(item => item.embedding)
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY ontbreekt in .env of .env.local')
    console.error('Voeg toe: OPENAI_API_KEY="sk-..."')
    process.exit(1)
  }

  // Parse arguments
  const args = process.argv.slice(2)
  const sourceIdIdx = args.indexOf('--source-id')
  const sourceId = sourceIdIdx >= 0 ? args[sourceIdIdx + 1] : null

  console.log('=== Embeddings Genereren ===\n')

  // Get chunks without embeddings
  let query = `
    SELECT sc.id, sc.content, sc.heading, s.name as "sourceName"
    FROM "SourceChunk" sc
    JOIN "AISource" s ON s.id = sc."sourceId"
    WHERE sc.embedding IS NULL
  `
  if (sourceId) {
    query += ` AND sc."sourceId" = '${sourceId}'`
  }
  query += ` ORDER BY sc."sourceId", sc."chunkIndex"`

  const chunks = await prisma.$queryRawUnsafe(query)
  console.log(`${chunks.length} chunks zonder embedding gevonden`)

  if (chunks.length === 0) {
    console.log('Alle chunks hebben al embeddings!')
    await prisma.$disconnect()
    return
  }

  // Show per-source breakdown
  const sourceCounts = {}
  for (const c of chunks) {
    sourceCounts[c.sourceName] = (sourceCounts[c.sourceName] || 0) + 1
  }
  for (const [name, count] of Object.entries(sourceCounts)) {
    console.log(`  - ${name}: ${count} chunks`)
  }

  // Estimated cost
  const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0)
  const estimatedTokens = Math.round(totalChars / 3.5)
  const estimatedCost = (estimatedTokens / 1000000) * 0.02
  console.log(`\nGeschatte tokens: ${estimatedTokens.toLocaleString()}`)
  console.log(`Geschatte kosten: $${estimatedCost.toFixed(4)}`)
  console.log(`Batches: ${Math.ceil(chunks.length / BATCH_SIZE)}\n`)

  // Process in batches
  let processed = 0
  let errors = 0
  const startTime = Date.now()

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

    // Prepare texts (include heading for better context)
    const texts = batch.map(c =>
      c.heading ? `${c.heading}\n\n${c.content}` : c.content
    )

    try {
      const embeddings = await generateEmbeddingsBatch(texts)

      // Store each embedding
      for (let j = 0; j < batch.length; j++) {
        const embeddingStr = `[${embeddings[j].join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`,
          embeddingStr,
          batch[j].id
        )
      }

      processed += batch.length
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
      console.log(`  Batch ${batchNum}/${totalBatches}: ${processed}/${chunks.length} chunks (${rate}/s, ${elapsed}s)`)
    } catch (err) {
      console.error(`  Batch ${batchNum} FOUT: ${err.message}`)
      errors += batch.length

      // If rate limited, wait longer
      if (err.message.includes('429')) {
        console.log('  Rate limited — 30 seconden wachten...')
        await new Promise(r => setTimeout(r, 30000))
        i -= BATCH_SIZE // Retry this batch
        continue
      }
    }

    // Rate limiting delay
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n=== Voltooid ===`)
  console.log(`Verwerkt: ${processed}/${chunks.length}`)
  if (errors > 0) console.log(`Fouten: ${errors}`)
  console.log(`Tijd: ${totalTime}s`)

  // Final stats
  const stats = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int as total,
      COUNT(embedding)::int as with_embedding
    FROM "SourceChunk"
  `)
  console.log(`\nTotaal in database: ${stats[0].total} chunks, ${stats[0].with_embedding} met embedding`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fout:', err)
  process.exit(1)
})
