/**
 * FASE 1: Chunk-kwaliteit inspectie
 * Haalt random chunks op uit ELKE bron en analyseert de kwaliteit.
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(100))
  console.log('FASE 1: CHUNK-KWALITEIT INSPECTIE')
  console.log('='.repeat(100))

  // 1. Haal alle actieve bronnen op
  const sources = await prisma.aISource.findMany({
    where: { isActive: true, isProcessed: true },
    select: { id: true, name: true, category: true },
  })
  console.log(`\nActieve bronnen: ${sources.length}`)
  for (const s of sources) {
    console.log(`  - ${s.name} (${s.id})`)
  }

  // 2. Per bron: statistieken en voorbeeldchunks
  for (const source of sources) {
    console.log('\n' + '='.repeat(100))
    console.log(`BRON: ${source.name}`)
    console.log('='.repeat(100))

    // Totaal chunks en basis stats
    const allChunks = await prisma.sourceChunk.findMany({
      where: { sourceId: source.id },
      select: { id: true, chunkIndex: true, content: true, heading: true },
      orderBy: { chunkIndex: 'asc' },
    })

    if (allChunks.length === 0) {
      console.log('  GEEN CHUNKS')
      continue
    }

    // Bereken statistieken
    const lengths = allChunks.map(c => c.content.length)
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    const min = Math.min(...lengths)
    const max = Math.max(...lengths)
    const median = lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)]
    const tooShort = lengths.filter(l => l < 100).length
    const tooLong = lengths.filter(l => l > 5000).length
    const veryShort = lengths.filter(l => l < 50).length
    const hasHeading = allChunks.filter(c => c.heading && c.heading.trim().length > 0).length
    const noHeading = allChunks.length - hasHeading

    // Embeddings check
    const embeddingCount = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as cnt FROM "SourceChunk" WHERE "sourceId" = $1 AND embedding IS NOT NULL`,
      source.id
    )
    const withEmbedding = Number(embeddingCount[0].cnt)

    console.log(`\n  STATISTIEKEN:`)
    console.log(`  Totaal chunks:       ${allChunks.length}`)
    console.log(`  Met embedding:       ${withEmbedding} (${Math.round(withEmbedding / allChunks.length * 100)}%)`)
    console.log(`  Gemiddelde lengte:   ${avg} tekens`)
    console.log(`  Mediaan lengte:      ${median} tekens`)
    console.log(`  Minimum lengte:      ${min} tekens`)
    console.log(`  Maximum lengte:      ${max} tekens`)
    console.log(`  Te kort (<100):      ${tooShort} (${(tooShort / allChunks.length * 100).toFixed(1)}%)`)
    console.log(`  Heel kort (<50):     ${veryShort}`)
    console.log(`  Te lang (>5000):     ${tooLong} (${(tooLong / allChunks.length * 100).toFixed(1)}%)`)
    console.log(`  Met heading:         ${hasHeading} (${Math.round(hasHeading / allChunks.length * 100)}%)`)
    console.log(`  Zonder heading:      ${noHeading}`)

    // Lengteverdeling histogram
    const buckets = [0, 100, 500, 1000, 2000, 3000, 4000, 5000, 7000, 10000, Infinity]
    console.log(`\n  LENGTEVERDELING:`)
    for (let i = 0; i < buckets.length - 1; i++) {
      const count = lengths.filter(l => l >= buckets[i] && l < buckets[i + 1]).length
      const bar = '#'.repeat(Math.round(count / allChunks.length * 50))
      console.log(`    ${String(buckets[i]).padStart(5)}-${(buckets[i + 1] === Infinity ? '...' : String(buckets[i + 1])).padStart(5)}: ${String(count).padStart(5)} ${bar}`)
    }

    // Kwaliteitscheck: beginnen chunks met een afgebroken zin?
    let brokenStart = 0
    let brokenEnd = 0
    for (const chunk of allChunks) {
      const c = chunk.content.trim()
      // Check of chunk begint midden in een zin (start met kleine letter, geen bullet/nummer)
      if (c.length > 0 && /^[a-z]/.test(c) && !/^(de |het |een |van |in |is |dat |die |op |te |en |voor |met )/.test(c)) {
        brokenStart++
      }
      // Check of chunk eindigt midden in een zin (geen punt, geen heading, geen bullet)
      if (c.length > 0 && !/[.!?:;)\]]$/.test(c) && c.length > 100) {
        brokenEnd++
      }
    }
    console.log(`\n  CHUNK BOUNDARIES:`)
    console.log(`  Start midden in zin: ${brokenStart} (${(brokenStart / allChunks.length * 100).toFixed(1)}%)`)
    console.log(`  Einde midden in zin: ${brokenEnd} (${(brokenEnd / allChunks.length * 100).toFixed(1)}%)`)

    // 3. Toon 8 random voorbeeldchunks
    console.log(`\n  VOORBEELDCHUNKS (8 random):`)
    const randomIndices = []
    const step = Math.max(1, Math.floor(allChunks.length / 8))
    for (let i = 0; i < 8 && i * step < allChunks.length; i++) {
      randomIndices.push(Math.min(i * step + Math.floor(Math.random() * step), allChunks.length - 1))
    }

    for (const idx of randomIndices) {
      const chunk = allChunks[idx]
      console.log(`\n  --- Chunk #${chunk.chunkIndex} [${chunk.content.length} tekens] ---`)
      console.log(`  Heading: "${chunk.heading || '(leeg)'}"`)

      // Toon begin en einde van chunk
      const preview = chunk.content.length > 400
        ? chunk.content.slice(0, 200) + '\n  [...]\n  ' + chunk.content.slice(-200)
        : chunk.content
      console.log(`  Content: ${preview.split('\n').map(l => '  ' + l).join('\n')}`)

      // Kwaliteitsindicatoren
      const issues = []
      if (chunk.content.length < 100) issues.push('TE KORT')
      if (chunk.content.length > 5000) issues.push('TE LANG')
      if (!chunk.heading) issues.push('GEEN HEADING')
      if (/^[a-z]/.test(chunk.content.trim())) issues.push('BEGINT MIDDEN IN ZIN')
      if (chunk.content.trim().length > 100 && !/[.!?:;)\]]$/.test(chunk.content.trim())) issues.push('EINDIGT MIDDEN IN ZIN')

      // Check of chunk juridisch relevant is (bevat wetsverwijzingen, ECLI, etc.)
      const hasLegalRef = /\bart\.?\s*\d|BW\b|ECLI:|lid\s+\d|sub\s+[a-z]|Hoge Raad|kantonrechter|rechtbank|gerechtshof/i.test(chunk.content)
      if (!hasLegalRef && chunk.content.length > 200) issues.push('GEEN JURIDISCHE REFERENTIES')

      if (issues.length > 0) {
        console.log(`  ISSUES: ${issues.join(', ')}`)
      } else {
        console.log(`  KWALITEIT: OK`)
      }
    }

    // 4. Toon de kortste en langste chunks
    const sortedByLen = [...allChunks].sort((a, b) => a.content.length - b.content.length)

    console.log(`\n  KORTSTE 3 CHUNKS:`)
    for (const chunk of sortedByLen.slice(0, 3)) {
      console.log(`    #${chunk.chunkIndex} [${chunk.content.length} tekens] heading="${chunk.heading || '(leeg)'}"`)
      console.log(`    "${chunk.content.slice(0, 150).replace(/\n/g, ' ')}"`)
    }

    console.log(`\n  LANGSTE 3 CHUNKS:`)
    for (const chunk of sortedByLen.slice(-3)) {
      console.log(`    #${chunk.chunkIndex} [${chunk.content.length} tekens] heading="${chunk.heading || '(leeg)'}"`)
      console.log(`    begin: "${chunk.content.slice(0, 100).replace(/\n/g, ' ')}"`)
      console.log(`    einde: "${chunk.content.slice(-100).replace(/\n/g, ' ')}"`)
    }

    // 5. Heading analyse
    const headings = allChunks.filter(c => c.heading).map(c => c.heading)
    const uniqueHeadings = new Set(headings)
    console.log(`\n  HEADING ANALYSE:`)
    console.log(`    Unieke headings: ${uniqueHeadings.size}`)
    console.log(`    Duplicaat headings: ${headings.length - uniqueHeadings.size}`)

    // Toon eerste 10 unieke headings
    const headingSample = [...uniqueHeadings].slice(0, 15)
    console.log(`    Voorbeeld headings:`)
    for (const h of headingSample) {
      console.log(`      - "${h}"`)
    }
  }

  // GLOBAAL OVERZICHT
  console.log('\n\n' + '='.repeat(100))
  console.log('GLOBAAL OVERZICHT')
  console.log('='.repeat(100))

  const totalChunks = await prisma.sourceChunk.count()
  const totalWithEmb = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "SourceChunk" WHERE embedding IS NOT NULL`)

  console.log(`\nTotaal chunks:     ${totalChunks}`)
  console.log(`Met embedding:     ${Number(totalWithEmb[0].cnt)} (${(Number(totalWithEmb[0].cnt) / totalChunks * 100).toFixed(1)}%)`)
  console.log(`Zonder embedding:  ${totalChunks - Number(totalWithEmb[0].cnt)}`)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
