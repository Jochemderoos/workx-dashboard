const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Check if embeddings are actually stored as vectors
  const checkEmb = await prisma.$queryRawUnsafe(`
    SELECT id, "chunkIndex",
           embedding IS NOT NULL as has_emb,
           pg_typeof(embedding)::text as emb_type
    FROM "SourceChunk"
    WHERE "sourceId" = $1
    LIMIT 3
  `, vaanId)
  console.log('VAAN chunk embedding types:')
  for (const r of checkEmb) {
    console.log(`  #${r.chunkIndex}: has_emb=${r.has_emb}, type=${r.emb_type}`)
  }

  // Try to get vector dimension
  try {
    const dimCheck = await prisma.$queryRawUnsafe(`
      SELECT id, "chunkIndex", vector_dims(embedding) as dims
      FROM "SourceChunk"
      WHERE "sourceId" = $1 AND embedding IS NOT NULL
      LIMIT 3
    `, vaanId)
    console.log('\nVector dimensions:')
    for (const r of dimCheck) {
      console.log(`  #${r.chunkIndex}: ${r.dims} dims`)
    }
  } catch (e) {
    console.log('\nVector dims check failed:', e.message)
  }

  // Compare with T&C which works
  const tcId = 'cmlgkwzxu0001m3j93sne2sxg'
  const tcCheck = await prisma.$queryRawUnsafe(`
    SELECT id, "chunkIndex",
           embedding IS NOT NULL as has_emb,
           pg_typeof(embedding)::text as emb_type
    FROM "SourceChunk"
    WHERE "sourceId" = $1
    LIMIT 3
  `, tcId)
  console.log('\nT&C chunk embedding types:')
  for (const r of tcCheck) {
    console.log(`  #${r.chunkIndex}: has_emb=${r.has_emb}, type=${r.emb_type}`)
  }

  // Try to compute cosine distance directly
  try {
    const testEmb = await (async () => {
      const r = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: 'test', dimensions: 1536 }),
      })
      return (await r.json()).data[0].embedding
    })()

    const distCheck = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex", embedding <=> $1::vector as distance
      FROM "SourceChunk"
      WHERE "sourceId" = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 5
    `, `[${testEmb.join(',')}]`, vaanId)
    console.log('\nVAAN distance check:')
    for (const r of distCheck) {
      console.log(`  #${r.chunkIndex}: distance=${Number(r.distance).toFixed(6)}`)
    }
  } catch (e) {
    console.log('\nDistance check failed:', e.message)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
