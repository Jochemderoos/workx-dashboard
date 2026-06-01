/**
 * FASE 5 FINALE: Validatie na ef_search fix + per-source retrieval
 * Test VAAN semantic search specifiek
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SOURCES = {
  TC: 'cmlgkwzxu0001m3j93sne2sxg',
  Thematica: 'cmlcq2s9o00014sn2seuw6eps',
  VAAN: 'cmlcq12aj0001jmy15c7x98if',
  RAR: 'cmlcq12oz0005jmy1yg3bjguk',
}

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 32000), dimensions: 1536 }),
  })
  return (await response.json()).data[0].embedding
}

const QUESTIONS = [
  "Wat is de opzegtermijn bij een dienstverband van 10 jaar?",
  "Wanneer is sprake van ernstig verwijtbaar handelen door de werkgever?",
  "Wat zijn de recente ontwikkelingen rond de i-grond/cumulatiegrond?",
  "Hoe wordt de billijke vergoeding berekend na de New Hairstyle beschikking?",
  "Wat zijn de vereisten voor ontslag wegens disfunctioneren?",
]

async function main() {
  console.log('FINALE VALIDATIE: ef_search=200 + per-source search')
  console.log('='.repeat(80))

  // Set ef_search (same as the updated embeddings.ts)
  await prisma.$executeRawUnsafe('SET hnsw.ef_search = 200')

  const allSourceIds = Object.values(SOURCES)

  for (const q of QUESTIONS) {
    const emb = await generateEmbedding(q)
    const embStr = `[${emb.join(',')}]`

    const results = {}
    for (const [name, sid] of Object.entries(SOURCES)) {
      const chunks = await prisma.$queryRawUnsafe(`
        SELECT "chunkIndex", heading,
               1 - (embedding <=> $1::vector) as similarity
        FROM "SourceChunk"
        WHERE "sourceId" = $2 AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 15
      `, embStr, sid)
      results[name] = chunks
    }

    console.log(`\n"${q.slice(0, 60)}..."`)
    for (const [name, chunks] of Object.entries(results)) {
      const topSim = chunks.length > 0 ? Number(chunks[0].similarity).toFixed(4) : 'N/A'
      const topHead = chunks.length > 0 ? (chunks[0].heading || '').slice(0, 60) : 'N/A'
      console.log(`  ${name.padEnd(12)}: ${String(chunks.length).padEnd(4)} chunks, top sim=${topSim}, "${topHead}"`)
    }

    await new Promise(r => setTimeout(r, 300))
  }

  // Also compare: what does the global search return?
  console.log('\n\n--- Vergelijking: globaal vs per-source ---')
  const emb = await generateEmbedding("Wat zijn de vereisten voor ontslag wegens disfunctioneren?")
  const embStr = `[${emb.join(',')}]`

  const globalResults = await prisma.$queryRawUnsafe(`
    SELECT "sourceId", "chunkIndex", heading,
           1 - (embedding <=> $1::vector) as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = ANY($2::text[]) AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 60
  `, embStr, allSourceIds)

  const globalBySource = {}
  for (const r of globalResults) {
    const name = Object.entries(SOURCES).find(([_, sid]) => sid === r.sourceId)?.[0] || r.sourceId
    globalBySource[name] = (globalBySource[name] || 0) + 1
  }
  console.log('Globaal (top 60):', JSON.stringify(globalBySource))

  // Per-source (15 per source = max 60)
  const perSourceTotal = {}
  for (const [name, sid] of Object.entries(SOURCES)) {
    const chunks = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex"
      FROM "SourceChunk"
      WHERE "sourceId" = $1 AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector
      LIMIT 15
    `, sid, embStr)
    perSourceTotal[name] = chunks.length
  }
  console.log('Per-source (15 per):  ', JSON.stringify(perSourceTotal))

  await prisma.$disconnect()
}

main().catch(console.error)
