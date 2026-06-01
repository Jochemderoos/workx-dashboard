const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Check indexes on SourceChunk
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'SourceChunk'
  `)
  console.log('Indexes on SourceChunk:')
  for (const idx of indexes) {
    console.log(`  ${idx.indexname}: ${idx.indexdef}`)
  }

  // Try disable seq scan to force vector index use
  console.log('\n--- Set ivfflat.probes and try again ---')
  try {
    await prisma.$executeRawUnsafe(`SET ivfflat.probes = 20`)
  } catch (e) { /* ignore */ }
  try {
    await prisma.$executeRawUnsafe(`SET hnsw.ef_search = 100`)
  } catch (e) { /* ignore */ }

  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: 'disfunctioneren', dimensions: 1536 }),
  })
  const emb = (await r.json()).data[0].embedding
  const embStr = `[${emb.join(',')}]`

  const results = await prisma.$queryRawUnsafe(`
    SELECT "chunkIndex", heading,
           1 - (embedding <=> $1::vector) as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = $2 AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 10
  `, embStr, vaanId)
  console.log(`VAAN results after index tuning: ${results.length}`)
  for (const r of results.slice(0, 5)) {
    console.log(`  [sim=${Number(r.similarity).toFixed(4)}] #${r.chunkIndex} "${(r.heading || '').slice(0, 60)}"`)
  }

  // Try with explicit SET enable_seqscan = off
  console.log('\n--- Force index scan ---')
  try {
    // First try: disable seq scan entirely
    await prisma.$executeRawUnsafe(`SET enable_seqscan = off`)
    const results2 = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex", heading,
             1 - (embedding <=> $1::vector) as similarity
      FROM "SourceChunk"
      WHERE "sourceId" = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 5
    `, embStr, vaanId)
    console.log(`VAAN results with seqscan=off: ${results2.length}`)
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }

  // Check total rows with valid embeddings per source
  const embStats = await prisma.$queryRawUnsafe(`
    SELECT "sourceId", COUNT(*)::int as cnt,
           COUNT(embedding)::int as with_emb
    FROM "SourceChunk"
    GROUP BY "sourceId"
    ORDER BY cnt DESC
  `)
  console.log('\nEmbedding stats per source:')
  for (const s of embStats) {
    console.log(`  ${s.sourceId}: ${s.cnt} total, ${s.with_emb} with embedding`)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
