const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const vaanId = 'cmlcq12aj0001jmy15c7x98if'

  // Keyword search
  const keywords = ['disfunctioneren', 'opzegtermijn', 'billijke vergoeding', 'cumulatiegrond', 'ernstig verwijtbaar']
  for (const kw of keywords) {
    const results = await prisma.sourceChunk.findMany({
      where: { sourceId: vaanId, content: { contains: kw, mode: 'insensitive' } },
      select: { heading: true, chunkIndex: true },
      take: 3,
    })
    console.log(`VAAN "${kw}": ${results.length > 0 ? results.length + ' matches' : 'GEEN MATCHES'}`)
    for (const r of results) {
      console.log(`  "${(r.heading || '').slice(0, 100)}"`)
    }
  }

  // Also check semantic for one term
  const emb = await (async () => {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: 'ontslag wegens disfunctioneren verbetertraject', dimensions: 1536 }),
    })
    return (await r.json()).data[0].embedding
  })()

  const semResults = await prisma.$queryRawUnsafe(`
    SELECT heading, 1 - (embedding <=> $1::vector) as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = $2 AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector LIMIT 5
  `, `[${emb.join(',')}]`, vaanId)

  console.log(`\nVAAN semantic top-5 voor "disfunctioneren":`)
  for (const r of semResults) {
    console.log(`  [sim=${Number(r.similarity).toFixed(4)}] "${(r.heading || '').slice(0, 100)}"`)
  }

  await prisma.$disconnect()
}
main().catch(console.error)
