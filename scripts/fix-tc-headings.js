/**
 * Fix T&C Arbeidsrecht chunk headings
 *
 * Probleem: 97% van T&C chunks heeft GEEN heading, waardoor niet te zien is
 * welk wetsartikel ze bespreken. Dit maakt retrieval minder effectief.
 *
 * Oplossing: Detecteer wetsartikelverwijzingen in de chunk-inhoud en
 * genereer headings op basis daarvan.
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Source ID for T&C Arbeidsrecht
const TC_SOURCE_ID = 'cmlgkwzxu0001m3j93sne2sxg'

// Patterns to detect article headings and section headers in T&C content
const patterns = [
  // Art. 7:xxx BW headers (most common in T&C)
  /(?:^|\n)\s*(Art(?:ikel)?\.?\s*\d+[:.]?\d*(?:\s*(?:lid\s+\d+|BW))?(?:\s*BW)?)/mi,
  // Section-like headers (e.g., "Afdeling 2", "Titel 10")
  /(?:^|\n)\s*((?:Afdeling|Titel|Boek|Hoofdstuk)\s+\d+[^\n]{0,100})/mi,
  // Wet-namen (e.g., "Wet arbeid en zorg", "Wet flexibel werken")
  /(?:^|\n)\s*(Wet\s+(?:arbeid|flexibel|gelijke|minimumloon|op de|verbetering|allocatie|CAO|collectieve)[^\n]{0,80})/mi,
  // Author + wet reference at start (e.g., "E. Verhulp  Burgerlijk Wetboek")
  /^\s*\d+\s+[A-Z]\.\s*(?:[A-Z][a-z]+(?:\s+[a-z]+)*\s+)*\s*((?:Burgerlijk\s+Wetboek|Wet\s+[a-zA-Z]+)[^\n]{0,100})/m,
  // BW book/title (e.g., "Burgerlijk Wetboek Boek 7, Titel 10")
  /(?:^|\n)\s*(Burgerlijk\s+Wetboek[^\n]{0,120})/mi,
]

// Try to extract which BW articles are discussed in this chunk
function extractArticleRef(content) {
  // Look for specific article patterns
  const artMatches = content.match(/art(?:ikel)?\.?\s*(\d+[:.]?\d+)(?:\s*(?:lid\s+\d+|sub\s+[a-z]))*(?:\s*BW)?/gi)
  if (artMatches && artMatches.length > 0) {
    // Get the most common article reference
    const artCounts = {}
    for (const m of artMatches) {
      // Normalize to "art. X:XXX"
      const numMatch = m.match(/(\d+[:.]?\d+)/)
      if (numMatch) {
        const key = numMatch[1]
        artCounts[key] = (artCounts[key] || 0) + 1
      }
    }
    // Return the most frequently referenced article
    const sorted = Object.entries(artCounts).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      return `art. ${sorted[0][0]} BW`
    }
  }
  return null
}

// Try to detect the section/topic from the content
function extractTopic(content) {
  // Common T&C section markers
  const sectionPatterns = [
    /\b(opzegtermijn(?:en)?)\b/i,
    /\b(transitievergoeding)\b/i,
    /\b(proeftijd(?:beding)?)\b/i,
    /\b(concurrentiebeding)\b/i,
    /\b(ketenregeling)\b/i,
    /\b(dringende\s+reden)\b/i,
    /\b(kennelijk\s+onredelijk(?:e?\s+opzegging)?)\b/i,
    /\b(billijke\s+vergoeding)\b/i,
    /\b(opzegverbod(?:en)?)\b/i,
    /\b(loondoorbetaling\s+bij\s+ziekte)\b/i,
    /\b(vakantie(?:geld|dagen|recht(?:en)?))\b/i,
    /\b(ontbinding(?:\s+arbeidsovereenkomst)?)\b/i,
    /\b(overgang\s+van\s+onderneming)\b/i,
    /\b(uitzend(?:overeenkomst|kracht(?:en)?))\b/i,
    /\b(collectieve\s+arbeidsovereenkomst|cao)\b/i,
    /\b(aanzegverplichting)\b/i,
    /\b(vaststellingsovereenkomst)\b/i,
    /\b(werkgeversaansprakelijkheid)\b/i,
    /\b(re-?integratie(?:verplichtingen)?)\b/i,
    /\b(medezeggenschap|ondernemingsraad)\b/i,
    /\b(payroll(?:ing)?)\b/i,
    /\b(goed\s+werkgeverschap)\b/i,
    /\b(disfunctioneren)\b/i,
    /\b(verstoorde\s+arbeidsverhouding)\b/i,
    /\b(bedrijfseconomische\s+redenen)\b/i,
  ]

  for (const p of sectionPatterns) {
    const m = content.match(p)
    if (m) return m[1]
  }
  return null
}

async function main() {
  console.log('Fix T&C Arbeidsrecht chunk headings')
  console.log('='.repeat(60))

  // Get all T&C chunks without heading
  const chunks = await prisma.sourceChunk.findMany({
    where: {
      sourceId: TC_SOURCE_ID,
      OR: [
        { heading: null },
        { heading: '' },
        { heading: 'BIJLAGEN' },
      ],
    },
    select: { id: true, chunkIndex: true, content: true, heading: true },
    orderBy: { chunkIndex: 'asc' },
  })

  console.log(`Chunks zonder heading: ${chunks.length}`)

  let updated = 0
  let withArticle = 0
  let withTopic = 0
  let unchanged = 0

  for (const chunk of chunks) {
    // Try to extract heading from content
    let newHeading = null

    // 1. Try section header patterns
    for (const pattern of patterns) {
      const match = chunk.content.match(pattern)
      if (match && match[1]) {
        newHeading = match[1].trim().slice(0, 200)
        break
      }
    }

    // 2. If no section header, try article reference + topic
    if (!newHeading) {
      const articleRef = extractArticleRef(chunk.content)
      const topic = extractTopic(chunk.content)

      if (articleRef && topic) {
        newHeading = `T&C ${articleRef} — ${topic}`
        withArticle++
      } else if (articleRef) {
        newHeading = `T&C ${articleRef}`
        withArticle++
      } else if (topic) {
        newHeading = `T&C Arbeidsrecht — ${topic}`
        withTopic++
      }
    }

    if (newHeading && newHeading !== chunk.heading) {
      await prisma.sourceChunk.update({
        where: { id: chunk.id },
        data: { heading: newHeading },
      })
      updated++
      if (updated <= 20) {
        console.log(`  #${chunk.chunkIndex}: "${newHeading}"`)
      }
    } else {
      unchanged++
    }
  }

  console.log(`\nResultaat:`)
  console.log(`  Updated:     ${updated}`)
  console.log(`  Met artikel: ${withArticle}`)
  console.log(`  Met topic:   ${withTopic}`)
  console.log(`  Unchanged:   ${unchanged}`)

  // Verify: check headings now
  const afterCheck = await prisma.sourceChunk.findMany({
    where: { sourceId: TC_SOURCE_ID },
    select: { heading: true },
  })
  const withH = afterCheck.filter(c => c.heading && c.heading.trim().length > 0).length
  console.log(`\nNa fix: ${withH}/${afterCheck.length} chunks hebben heading (${Math.round(withH / afterCheck.length * 100)}%)`)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
