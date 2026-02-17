/**
 * Chunk een specifieke bron en genereer embeddings
 * Gebruik: node scripts/chunk-source.js <source-id>
 */
const fs = require('fs')
const path = require('path')

function loadEnv(f) {
  try {
    for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = l.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}
loadEnv(path.join(__dirname, '..', '.env.local'))
loadEnv(path.join(__dirname, '..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const CHUNK_SIZE = 5000
const BATCH_SIZE = 50
const DELAY_MS = 500

const headingPattern = /^(#{1,4}\s|Artikel\s+\d|Art\.\s*\d|Afdeling\s+\d|Titel\s+\d|Boek\s+\d|Hoofdstuk\s+\d|\d+\.\d+[\s.]|[A-Z][A-Z\s]{5,}$|AR-\d{4}-\d+|ECLI:)/

async function generateEmbeddingsBatch(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
  return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding)
}

async function main() {
  const sourceId = process.argv[2]
  if (!sourceId) {
    console.error('Gebruik: node scripts/chunk-source.js <source-id>')
    process.exit(1)
  }

  const source = await prisma.aISource.findUnique({
    where: { id: sourceId },
    select: { id: true, name: true, content: true },
  })
  if (!source || !source.content) {
    console.error('Bron niet gevonden of geen content')
    process.exit(1)
  }

  console.log(`\n=== ${source.name} ===`)
  console.log(`Content: ${source.content.length} tekens`)

  // 1. Chunk
  console.log('\n--- Stap 1: Chunking ---')
  const del = await prisma.sourceChunk.deleteMany({ where: { sourceId } })
  if (del.count > 0) console.log(`${del.count} oude chunks verwijderd`)

  const chunks = []
  const lines = source.content.split('\n')
  let cur = '', heading = null
  for (const line of lines) {
    const isH = headingPattern.test(line.trim())
    if (isH && cur.length > CHUNK_SIZE * 0.3) {
      if (cur.trim()) chunks.push({ content: cur.trim(), heading })
      cur = line + '\n'; heading = line.trim().slice(0, 200); continue
    }
    cur += line + '\n'
    if (cur.length >= CHUNK_SIZE) {
      const lp = cur.lastIndexOf('\n\n', CHUNK_SIZE)
      const ls = cur.lastIndexOf('. ', CHUNK_SIZE)
      const sp = lp > CHUNK_SIZE * 0.5 ? lp : ls > CHUNK_SIZE * 0.5 ? ls + 2 : CHUNK_SIZE
      chunks.push({ content: cur.slice(0, sp).trim(), heading })
      cur = cur.slice(sp).trim() + '\n'
    }
  }
  if (cur.trim()) chunks.push({ content: cur.trim(), heading })

  await prisma.sourceChunk.createMany({
    data: chunks.map((c, i) => ({ sourceId, chunkIndex: i, content: c.content, heading: c.heading || null }))
  })
  console.log(`${chunks.length} chunks aangemaakt (gem. ${Math.round(source.content.length / chunks.length)} tekens)`)

  // 2. Embeddings
  if (!process.env.OPENAI_API_KEY) {
    console.log('\nOPENAI_API_KEY ontbreekt — embeddings overgeslagen')
    await prisma.$disconnect()
    return
  }

  console.log('\n--- Stap 2: Embeddings ---')
  const chunkRows = await prisma.sourceChunk.findMany({
    where: { sourceId },
    select: { id: true, content: true, heading: true },
    orderBy: { chunkIndex: 'asc' },
  })

  let processed = 0
  for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
    const batch = chunkRows.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.heading ? `${c.heading}\n\n${c.content}` : c.content)

    try {
      const embeddings = await generateEmbeddingsBatch(texts)
      for (let j = 0; j < batch.length; j++) {
        const embStr = `[${embeddings[j].join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`,
          embStr, batch[j].id
        )
      }
      processed += batch.length
      console.log(`  ${processed}/${chunkRows.length} embeddings`)
    } catch (err) {
      if (err.message.includes('429')) {
        console.log('  Rate limited — 30s wachten...')
        await new Promise(r => setTimeout(r, 30000))
        i -= BATCH_SIZE
        continue
      }
      console.error(`  Fout: ${err.message}`)
    }
    if (i + BATCH_SIZE < chunkRows.length) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`\n=== Klaar: ${chunks.length} chunks, ${processed} embeddings ===`)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
