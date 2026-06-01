const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sources = await prisma.aISource.findMany({
    select: { id: true, name: true, url: true, pagesCrawled: true }
  })

  console.log('=== AI Bronnen ===')
  for (const s of sources) {
    console.log(`${s.id} | ${s.name} | pages: ${s.pagesCrawled} | url: ${(s.url || '').slice(0, 80)}`)
  }

  console.log('\n=== Chunks per bron ===')
  for (const s of sources) {
    const total = await prisma.sourceChunk.count({ where: { sourceId: s.id } })
    const withEmb = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as cnt FROM "SourceChunk" WHERE "sourceId" = $1 AND embedding IS NOT NULL`, s.id
    )
    console.log(`${s.name} | chunks: ${total} | met embedding: ${withEmb[0].cnt}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
