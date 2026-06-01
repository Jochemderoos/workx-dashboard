/**
 * FASE 2: Retrieval-kwaliteit testen
 * Test 5 arbeidsrechtelijke vragen en analyseer welke chunks worden opgehaald.
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Duplicated from route.ts for testing
const DUTCH_STOP_WORDS = new Set([
  'de', 'het', 'een', 'van', 'in', 'is', 'dat', 'die', 'op', 'te', 'en', 'voor',
  'met', 'zijn', 'aan', 'er', 'maar', 'om', 'als', 'dan', 'nog', 'wel', 'geen',
  'ook', 'al', 'naar', 'uit', 'kan', 'tot', 'bij', 'zo', 'wat', 'niet', 'wordt',
  'door', 'over', 'dit', 'werd', 'worden', 'heeft', 'hoe', 'waar', 'wanneer',
  'wie', 'welke', 'moet', 'mag', 'zou', 'kunnen', 'hebben', 'deze', 'meer',
  'was', 'waren', 'veel', 'zeer', 'ben', 'je', 'jij', 'we', 'wij', 'zij', 'ik',
  'mijn', 'hun', 'ons', 'haar', 'hem', 'u', 'men', 'zich', 'hier', 'daar',
])

const LEGAL_PHRASES = [
  'ontslag op staande voet', 'dringende reden', 'billijke vergoeding',
  'ernstig verwijtbaar', 'kennelijk onredelijk', 'goed werkgeverschap',
  'goed werknemerschap', 'redelijke grond', 'herplaatsing binnen redelijke termijn',
  'overgang van onderneming', 'collectief ontslag', 'wet verbetering poortwachter',
  'uitvoerbaarheid bij voorraad', 'finale kwijting', 'opzegging arbeidsovereenkomst',
  'beeindiging arbeidsovereenkomst', 'schriftelijkheidsvereiste', 'concurrentiebeding',
  'relatiebeding', 'proeftijdbeding', 'ketenregeling', 'aanzegverplichting',
  'transitievergoeding', 'loondoorbetaling bij ziekte', 'deskundigenoordeel',
  'wederzijds goedvinden', 'vaststellingsovereenkomst', 'opzegverbod',
  'new hairstyle', 'deliveroo', 'asscher-escape', 'xella', 'stoof chimney',
  'taxi hofman', 'ontslagvergoeding', 'reorganisatie', 'sociaal plan',
  'cumulatiegrond', 'verstoorde arbeidsverhouding', 'disfunctioneren',
  'bedrijfseconomische redenen', 'vervaltermijn', 'verjaringstermijn',
  'bedenktermijn', 'wettelijke verhoging', 'vakantiegeld', 'vakantiedagen',
  'oproepovereenkomst', 'payrolling', 'uitzendovereenkomst',
]

function extractSearchTerms(message) {
  const terms = []
  const lowerMsg = message.toLowerCase()
  const articleMatches = message.match(/(?:art(?:ikel)?\.?\s*)?(\d+[.:]\d+(?:\s*(?:lid\s+\d+|sub\s+[a-z]))?(?:\s*BW)?)/gi)
  if (articleMatches) {
    for (const match of articleMatches) terms.push(match.trim())
  }
  for (const phrase of LEGAL_PHRASES) {
    if (lowerMsg.includes(phrase)) terms.push(phrase)
  }
  const words = message.toLowerCase().replace(/[^\w\s:.-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !DUTCH_STOP_WORDS.has(w))
  for (const word of words) {
    if (word.length >= 4) terms.push(word)
  }
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 3) terms.push(`${words[i]} ${words[i + 1]}`)
  }
  for (let i = 0; i < words.length - 2; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 2 && words[i + 2].length >= 3) {
      terms.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
    }
  }
  return Array.from(new Set(terms))
}

async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 32000), dimensions: 1536 }),
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
  const data = await response.json()
  return data.data[0].embedding
}

const TEST_QUESTIONS = [
  {
    id: 1,
    question: "Wat is de opzegtermijn bij een dienstverband van 10 jaar?",
    expectedSources: ['Tekst en Commentaar'],
    expectedTerms: ['opzegtermijn', '7:672'],
    description: "Feitelijk, T&C moet scoren",
  },
  {
    id: 2,
    question: "Wanneer is sprake van ernstig verwijtbaar handelen door de werkgever?",
    expectedSources: ['Thematica', 'RAR'],
    expectedTerms: ['ernstig verwijtbaar', 'billijke vergoeding'],
    description: "Analyse, Thematica + RAR",
  },
  {
    id: 3,
    question: "Wat zijn de recente ontwikkelingen rond de i-grond/cumulatiegrond?",
    expectedSources: ['VAAN', 'RAR'],
    expectedTerms: ['cumulatiegrond', 'i-grond', '7:669 lid 3'],
    description: "Actueel, VAAN + RAR",
  },
  {
    id: 4,
    question: "Hoe wordt de billijke vergoeding berekend na de New Hairstyle beschikking?",
    expectedSources: ['RAR', 'Thematica'],
    expectedTerms: ['billijke vergoeding', 'new hairstyle', '7:681'],
    description: "Jurisprudentie",
  },
  {
    id: 5,
    question: "Wat zijn de vereisten voor ontslag wegens disfunctioneren?",
    expectedSources: ['Tekst en Commentaar', 'Thematica', 'VAAN', 'RAR'],
    expectedTerms: ['disfunctioneren', '7:669 lid 3 sub d', 'verbetertraject'],
    description: "Breed, alle bronnen",
  },
]

async function testQuestion(q, sourceIds, sourceMap) {
  console.log('\n' + '='.repeat(100))
  console.log(`VRAAG ${q.id}: "${q.question}"`)
  console.log(`Verwachting: ${q.description}`)
  console.log('='.repeat(100))

  // 1. Extract search terms
  const terms = extractSearchTerms(q.question)
  console.log(`\n  ZOEKTERMEN (${terms.length}): ${terms.join(', ')}`)

  // 2. Generate embedding
  console.log(`\n  Embedding genereren...`)
  const embedding = await generateEmbedding(q.question)

  // 3. Semantic search
  console.log(`\n  --- SEMANTISCHE ZOEKRESULTATEN ---`)
  const semanticResults = await prisma.$queryRawUnsafe(`
    SELECT sc.id, sc."sourceId", sc."chunkIndex", sc.heading,
           LEFT(sc.content, 300) as preview,
           LENGTH(sc.content) as content_length,
           1 - (sc.embedding <=> $1::vector) as similarity
    FROM "SourceChunk" sc
    WHERE sc."sourceId" = ANY($2::text[])
    AND sc.embedding IS NOT NULL
    ORDER BY sc.embedding <=> $1::vector
    LIMIT 50
  `, `[${embedding.join(',')}]`, sourceIds)

  // Group by source
  const semBySource = {}
  for (const r of semanticResults) {
    const name = sourceMap[r.sourceId] || r.sourceId
    if (!semBySource[name]) semBySource[name] = []
    semBySource[name].push(r)
  }

  console.log(`  Totaal: ${semanticResults.length} chunks`)
  console.log(`  Top-10 similarity scores: ${semanticResults.slice(0, 10).map(r => Number(r.similarity).toFixed(4)).join(', ')}`)
  console.log(`\n  Per bron:`)
  for (const [name, chunks] of Object.entries(semBySource)) {
    console.log(`    ${name}: ${chunks.length} chunks (sim: ${Number(chunks[0].similarity).toFixed(4)} - ${Number(chunks[chunks.length - 1].similarity).toFixed(4)})`)
    // Top 3 per bron
    for (const c of chunks.slice(0, 3)) {
      console.log(`      [sim=${Number(c.similarity).toFixed(4)}] #${c.chunkIndex} "${(c.heading || '').slice(0, 80)}"`)
      console.log(`        preview: ${(c.preview || '').replace(/\n/g, ' ').slice(0, 120)}...`)
    }
  }

  // 4. Keyword search
  console.log(`\n  --- KEYWORD ZOEKRESULTATEN ---`)
  const orConditions = terms.slice(0, 30).map(term => ({
    content: { contains: term, mode: 'insensitive' },
  }))

  const keywordResults = await prisma.sourceChunk.findMany({
    where: {
      sourceId: { in: sourceIds },
      OR: orConditions,
    },
    select: { id: true, sourceId: true, chunkIndex: true, heading: true, content: true },
    take: 200,
  })

  // Score keyword results
  const scoredKeyword = keywordResults.map(chunk => {
    const contentLower = chunk.content.toLowerCase()
    let score = 0
    const matchedTerms = []
    for (const term of terms) {
      if (contentLower.includes(term.toLowerCase())) {
        const termLower = term.toLowerCase()
        if (LEGAL_PHRASES.includes(termLower)) { score += 8; matchedTerms.push(`${term}(8)`) }
        else if (term.includes(':') || /\d+[.:]\d+/.test(term)) { score += 6; matchedTerms.push(`${term}(6)`) }
        else if (term.includes(' ')) { score += 4; matchedTerms.push(`${term}(4)`) }
        else if (term.length >= 8) { score += 3; matchedTerms.push(`${term}(3)`) }
        else if (term.length >= 5) { score += 2; matchedTerms.push(`${term}(2)`) }
        else { score += 1; matchedTerms.push(`${term}(1)`) }
      }
    }
    return { ...chunk, score, matchedTerms }
  }).sort((a, b) => b.score - a.score)

  const kwBySource = {}
  for (const r of scoredKeyword) {
    const name = sourceMap[r.sourceId] || r.sourceId
    if (!kwBySource[name]) kwBySource[name] = []
    kwBySource[name].push(r)
  }

  console.log(`  Totaal: ${scoredKeyword.length} chunks`)
  console.log(`\n  Per bron:`)
  for (const [name, chunks] of Object.entries(kwBySource)) {
    console.log(`    ${name}: ${chunks.length} chunks`)
    for (const c of chunks.slice(0, 3)) {
      console.log(`      [score=${c.score}] #${c.chunkIndex} "${(c.heading || '').slice(0, 80)}"`)
      console.log(`        matched: ${c.matchedTerms.slice(0, 8).join(', ')}`)
    }
  }

  // 5. Simulate RRF fusion (same as route.ts)
  console.log(`\n  --- RRF FUSION RESULTAAT ---`)
  const K = 60
  const rrfScores = new Map()

  // Semantic with weight 0.6
  semanticResults.forEach((result, rank) => {
    const key = `${result.sourceId}-${result.chunkIndex}`
    const rrfScore = 0.6 / (K + rank + 1)
    rrfScores.set(key, {
      sourceId: result.sourceId,
      chunkIndex: result.chunkIndex,
      heading: result.heading,
      preview: result.preview,
      score: rrfScore,
      methods: ['semantic'],
    })
  })

  // Keyword with weight 0.4
  scoredKeyword.forEach((result, rank) => {
    const key = `${result.sourceId}-${result.chunkIndex}`
    const rrfScore = 0.4 / (K + rank + 1)
    const existing = rrfScores.get(key)
    if (existing) {
      existing.score += rrfScore
      existing.methods.push('keyword')
    } else {
      rrfScores.set(key, {
        sourceId: result.sourceId,
        chunkIndex: result.chunkIndex,
        heading: result.heading,
        preview: (result.content || '').slice(0, 200),
        score: rrfScore,
        methods: ['keyword'],
      })
    }
  })

  const combined = Array.from(rrfScores.values()).sort((a, b) => b.score - a.score)

  // Balanced selection (same as route.ts)
  const MIN_PER_SOURCE = 3
  const MAX_PER_SOURCE = 12
  const selected = []
  const perSource = new Map()
  for (const chunk of combined) {
    if (selected.length >= 40) break
    const count = perSource.get(chunk.sourceId) || 0
    if (count >= MAX_PER_SOURCE) continue
    selected.push(chunk)
    perSource.set(chunk.sourceId, count + 1)
  }

  // Min representation
  const allSourceIds = Array.from(new Set(combined.map(c => c.sourceId)))
  for (const sid of allSourceIds) {
    const currentCount = perSource.get(sid) || 0
    if (currentCount >= MIN_PER_SOURCE) continue
    const needed = MIN_PER_SOURCE - currentCount
    const candidates = combined.filter(c => c.sourceId === sid && !selected.includes(c))
    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      if (selected.length >= 46) break
      selected.push(candidates[i])
      perSource.set(sid, (perSource.get(sid) || 0) + 1)
    }
  }

  selected.sort((a, b) => b.score - a.score)
  const finalSelected = selected.slice(0, 46)

  console.log(`  Totaal na RRF+balancing: ${finalSelected.length} chunks`)
  const fusionBySource = {}
  for (const r of finalSelected) {
    const name = sourceMap[r.sourceId] || r.sourceId
    if (!fusionBySource[name]) fusionBySource[name] = []
    fusionBySource[name].push(r)
  }

  console.log(`\n  BRONVERDELING:`)
  for (const [name, chunks] of Object.entries(fusionBySource)) {
    console.log(`    ${name}: ${chunks.length} chunks`)
    // Top chunk per bron
    const top = chunks[0]
    console.log(`      top: [RRF=${top.score.toFixed(6)}, ${top.methods.join('+')}] #${top.chunkIndex} "${(top.heading || '').slice(0, 80)}"`)
  }

  // 6. Quality assessment
  console.log(`\n  KWALITEITSBEOORDELING:`)

  // Check if expected sources are represented
  const foundSources = Object.keys(fusionBySource)
  for (const expected of q.expectedSources) {
    const found = foundSources.some(s => s.toLowerCase().includes(expected.toLowerCase()))
    console.log(`    ${found ? 'OK' : 'GEMIST'}: ${expected} ${found ? 'vertegenwoordigd' : 'NIET gevonden in resultaten'}`)
  }

  // Check "both methods" overlap
  const bothMethods = finalSelected.filter(c => c.methods.length > 1).length
  console.log(`    Chunks gevonden door BEIDE methoden: ${bothMethods}/${finalSelected.length} (${Math.round(bothMethods / finalSelected.length * 100)}%)`)

  // Check if top-10 contains diverse sources
  const top10Sources = new Set(finalSelected.slice(0, 10).map(c => sourceMap[c.sourceId]))
  console.log(`    Bronnen in top-10: ${Array.from(top10Sources).join(', ')} (${top10Sources.size} uniek)`)

  // Check similarity scores
  const topSim = semanticResults.length > 0 ? Number(semanticResults[0].similarity) : 0
  const simGrade = topSim > 0.5 ? 'UITSTEKEND' : topSim > 0.4 ? 'GOED' : topSim > 0.3 ? 'MATIG' : 'SLECHT'
  console.log(`    Hoogste similarity: ${topSim.toFixed(4)} (${simGrade})`)

  return { question: q.id, fusionBySource, topSim, bothMethods, total: finalSelected.length }
}

async function main() {
  console.log('FASE 2: RETRIEVAL-KWALITEIT TESTEN')
  console.log('='.repeat(100))

  // Get sources
  const sources = await prisma.aISource.findMany({
    where: { isActive: true, isProcessed: true },
    select: { id: true, name: true },
  })
  const sourceIds = sources.map(s => s.id)
  const sourceMap = {}
  for (const s of sources) sourceMap[s.id] = s.name

  console.log(`\nBronnen: ${sources.map(s => s.name).join(', ')}`)

  // Test each question
  const results = []
  for (const q of TEST_QUESTIONS) {
    const result = await testQuestion(q, sourceIds, sourceMap)
    results.push(result)
    // Rate limit OpenAI
    await new Promise(r => setTimeout(r, 500))
  }

  // Summary
  console.log('\n\n' + '='.repeat(100))
  console.log('SAMENVATTEND OVERZICHT')
  console.log('='.repeat(100))
  console.log('\nVraag'.padEnd(6) + 'TopSim'.padEnd(10) + 'Beide'.padEnd(8) + 'Totaal'.padEnd(10) + 'Bronnen gevonden')
  console.log('-'.repeat(100))
  for (const r of results) {
    const bronnen = Object.entries(r.fusionBySource).map(([n, c]) => `${n.slice(0, 20)}(${c.length})`).join(', ')
    console.log(
      `  ${r.question}`.padEnd(6) +
      r.topSim.toFixed(4).padEnd(10) +
      String(r.bothMethods).padEnd(8) +
      String(r.total).padEnd(10) +
      bronnen
    )
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
