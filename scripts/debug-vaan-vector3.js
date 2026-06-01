const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Generate real embedding
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: 'disfunctioneren verbetertraject ontslag', dimensions: 1536 }),
  })
  const emb = (await r.json()).data[0].embedding
  const embStr = `[${emb.join(',')}]`
  console.log(`Embedding length: ${emb.length}, first 3: ${emb.slice(0, 3)}`)

  // Exact same query as searchSimilarChunks in embeddings.ts
  console.log('\n--- Test 1: Exact searchSimilarChunks query for VAAN only ---')
  try {
    const results1 = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        "sourceId",
        "chunkIndex",
        content,
        heading,
        1 - (embedding <=> $1::vector) as similarity
      FROM "SourceChunk"
      WHERE "sourceId" = ANY($2::text[])
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, embStr, [vaanId], 15)
    console.log(`Results: ${results1.length}`)
    for (const r of results1.slice(0, 3)) {
      console.log(`  [sim=${Number(r.similarity).toFixed(4)}] #${r.chunkIndex} "${(r.heading || '').slice(0, 60)}"`)
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }

  // Test 2: Same query but with = instead of ANY
  console.log('\n--- Test 2: Direct = comparison ---')
  try {
    const results2 = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        "sourceId",
        "chunkIndex",
        heading,
        1 - (embedding <=> $1::vector) as similarity
      FROM "SourceChunk"
      WHERE "sourceId" = $2
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 15
    `, embStr, vaanId)
    console.log(`Results: ${results2.length}`)
    for (const r of results2.slice(0, 3)) {
      console.log(`  [sim=${Number(r.similarity).toFixed(4)}] #${r.chunkIndex} "${(r.heading || '').slice(0, 60)}"`)
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }

  // Test 3: All sources
  console.log('\n--- Test 3: All 4 sources ---')
  const allIds = [
    'cmlgkwzxu0001m3j93sne2sxg', // T&C
    'cmlcq2s9o00014sn2seuw6eps', // Thematica
    'cmlcq12aj0001jmy15c7x98if', // VAAN
    'cmlcq12oz0005jmy1yg3bjguk', // RAR
  ]
  try {
    const results3 = await prisma.$queryRawUnsafe(`
      SELECT
        "sourceId",
        "chunkIndex",
        heading,
        1 - (embedding <=> $1::vector) as similarity
      FROM "SourceChunk"
      WHERE "sourceId" = ANY($2::text[])
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 60
    `, embStr, allIds)
    console.log(`Results: ${results3.length}`)
    // Count per source
    const bySource = {}
    for (const r of results3) {
      bySource[r.sourceId] = (bySource[r.sourceId] || 0) + 1
    }
    console.log('By source:', JSON.stringify(bySource))
    // Show first VAAN result
    const vaanResults = results3.filter(r => r.sourceId === vaanId)
    console.log(`VAAN results: ${vaanResults.length}`)
    if (vaanResults.length > 0) {
      console.log(`  First: [sim=${Number(vaanResults[0].similarity).toFixed(4)}] #${vaanResults[0].chunkIndex}`)
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
