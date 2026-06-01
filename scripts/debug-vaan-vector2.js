const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Step 1: verify we can select VAAN chunks normally
  const basic = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt
    FROM "SourceChunk"
    WHERE "sourceId" = $1
  `, vaanId)
  console.log('VAAN total chunks:', basic[0].cnt)

  // Step 2: check embeddings without distance calc
  const embCheck = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt
    FROM "SourceChunk"
    WHERE "sourceId" = $1 AND embedding IS NOT NULL
  `, vaanId)
  console.log('VAAN with embedding:', embCheck[0].cnt)

  // Step 3: try a very simple distance query with a fixed vector
  // Create a zero-ish vector
  const zeroVec = new Array(1536).fill(0.001).join(',')
  try {
    const simpleTest = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex",
             embedding <=> $1::vector as distance
      FROM "SourceChunk"
      WHERE "sourceId" = $2 AND embedding IS NOT NULL
      LIMIT 3
    `, `[${zeroVec}]`, vaanId)
    console.log('\nSimple distance with zero-ish vector:', simpleTest.length, 'results')
    for (const r of simpleTest) {
      console.log(`  #${r.chunkIndex}: distance=${r.distance}`)
    }
  } catch (e) {
    console.log('Simple distance failed:', e.message)
  }

  // Step 4: Try ORDER BY without distance filter
  try {
    const orderTest = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex", heading
      FROM "SourceChunk"
      WHERE "sourceId" = $1 AND embedding IS NOT NULL
      ORDER BY "chunkIndex"
      LIMIT 3
    `, vaanId)
    console.log('\nSimple order by chunkIndex:', orderTest.length, 'results')
    for (const r of orderTest) {
      console.log(`  #${r.chunkIndex}: "${(r.heading || '').slice(0, 60)}"`)
    }
  } catch (e) {
    console.log('Order test failed:', e.message)
  }

  // Step 5: Check if the issue is NaN or Infinity in embeddings
  try {
    const nanCheck = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex",
             (embedding::text LIKE '%NaN%') as has_nan,
             (embedding::text LIKE '%Infinity%') as has_inf,
             LEFT(embedding::text, 50) as emb_start
      FROM "SourceChunk"
      WHERE "sourceId" = $1 AND embedding IS NOT NULL
      LIMIT 3
    `, vaanId)
    console.log('\nNaN/Infinity check:')
    for (const r of nanCheck) {
      console.log(`  #${r.chunkIndex}: nan=${r.has_nan}, inf=${r.has_inf}, start="${r.emb_start}"`)
    }
  } catch (e) {
    console.log('NaN check failed:', e.message)
  }

  // Step 6: Compare with RAR which works
  const rarId = 'cmlcq12oz0005jmy1yg3bjguk'
  try {
    const rarTest = await prisma.$queryRawUnsafe(`
      SELECT "chunkIndex",
             embedding <=> $1::vector as distance
      FROM "SourceChunk"
      WHERE "sourceId" = $2 AND embedding IS NOT NULL
      LIMIT 3
    `, `[${zeroVec}]`, rarId)
    console.log('\nRAR distance with zero-ish vector:', rarTest.length, 'results')
    for (const r of rarTest) {
      console.log(`  #${r.chunkIndex}: distance=${r.distance}`)
    }
  } catch (e) {
    console.log('RAR distance failed:', e.message)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
