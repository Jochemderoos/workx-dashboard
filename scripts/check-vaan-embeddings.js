const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Check embedding stats
  const stats = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total,
           COUNT(embedding)::int as with_emb,
           AVG(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as pct
    FROM "SourceChunk"
    WHERE "sourceId" = $1
  `, vaanId)
  console.log('VAAN embedding stats:', stats[0])

  // Try raw vector search
  const emb = await (async () => {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: 'disfunctioneren verbetertraject ontslag', dimensions: 1536 }),
    })
    return (await r.json()).data[0].embedding
  })()

  // Direct SQL query with detailed info
  const results = await prisma.$queryRawUnsafe(`
    SELECT "chunkIndex", heading, LEFT(content, 100) as preview,
           embedding IS NOT NULL as has_emb,
           CASE WHEN embedding IS NOT NULL THEN 1 - (embedding <=> $1::vector) ELSE NULL END as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = $2
    AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 10
  `, `[${emb.join(',')}]`, vaanId)

  console.log(`\nVAAN semantic search results (${results.length}):`)
  for (const r of results) {
    console.log(`  #${r.chunkIndex} [sim=${r.similarity ? Number(r.similarity).toFixed(4) : 'null'}] "${(r.heading || '').slice(0, 80)}"`)
  }

  // Also verify: does the previous test script's searchSimilarChunks work?
  // The issue might be in how it handles the sourceIds array
  const results2 = await prisma.$queryRawUnsafe(`
    SELECT id, "sourceId", "chunkIndex", heading,
           1 - (embedding <=> $1::vector) as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = ANY($2::text[])
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 15
  `, `[${emb.join(',')}]`, [vaanId])

  console.log(`\nUsing ANY() array syntax (${results2.length}):`)
  for (const r of results2) {
    console.log(`  #${r.chunkIndex} [sim=${Number(r.similarity).toFixed(4)}] "${(r.heading || '').slice(0, 80)}"`)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
