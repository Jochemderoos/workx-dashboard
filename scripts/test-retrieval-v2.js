/**
 * FASE 5: Validatie - Test de verbeterde per-source retrieval
 * Vergelijk met de resultaten van voor de wijziging.
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

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
const DUTCH_STOP_WORDS = new Set([
  'de', 'het', 'een', 'van', 'in', 'is', 'dat', 'die', 'op', 'te', 'en', 'voor',
  'met', 'zijn', 'aan', 'er', 'maar', 'om', 'als', 'dan', 'nog', 'wel', 'geen',
  'ook', 'al', 'naar', 'uit', 'kan', 'tot', 'bij', 'zo', 'wat', 'niet', 'wordt',
  'door', 'over', 'dit', 'werd', 'worden', 'heeft', 'hoe', 'waar', 'wanneer',
  'wie', 'welke', 'moet', 'mag', 'zou', 'kunnen', 'hebben', 'deze', 'meer',
  'was', 'waren', 'veel', 'zeer', 'ben', 'je', 'jij', 'we', 'wij', 'zij', 'ik',
  'mijn', 'hun', 'ons', 'haar', 'hem', 'u', 'men', 'zich', 'hier', 'daar',
])

function extractSearchTerms(message) {
  const terms = []
  const lowerMsg = message.toLowerCase()
  const articleMatches = message.match(/(?:art(?:ikel)?\.?\s*)?(\d+[.:]\d+(?:\s*(?:lid\s+\d+|sub\s+[a-z]))?(?:\s*BW)?)/gi)
  if (articleMatches) for (const match of articleMatches) terms.push(match.trim())
  for (const phrase of LEGAL_PHRASES) if (lowerMsg.includes(phrase)) terms.push(phrase)
  const words = message.toLowerCase().replace(/[^\w\s:.-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !DUTCH_STOP_WORDS.has(w))
  for (const word of words) if (word.length >= 4) terms.push(word)
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
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 32000), dimensions: 1536 }),
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
  return (await response.json()).data[0].embedding
}

const QUESTIONS = [
  { q: "Wat is de opzegtermijn bij een dienstverband van 10 jaar?", expect: "T&C + Thematica" },
  { q: "Wanneer is sprake van ernstig verwijtbaar handelen door de werkgever?", expect: "Thematica + RAR + T&C" },
  { q: "Wat zijn de recente ontwikkelingen rond de i-grond/cumulatiegrond?", expect: "VAAN + RAR + T&C" },
  { q: "Hoe wordt de billijke vergoeding berekend na de New Hairstyle beschikking?", expect: "RAR + Thematica + T&C" },
  { q: "Wat zijn de vereisten voor ontslag wegens disfunctioneren?", expect: "ALLE bronnen" },
]

async function testQuestion(q, sourceIds, sourceMap) {
  const SEMANTIC_PER_SOURCE = 15
  const KEYWORD_PER_SOURCE = 50

  console.log(`\nVRAAG: "${q.q}" (verwacht: ${q.expect})`)

  const terms = extractSearchTerms(q.q)
  const embedding = await generateEmbedding(q.q)

  // Per-source semantic search
  const perSourceSemantic = {}
  for (const sid of sourceIds) {
    const results = await prisma.$queryRawUnsafe(`
      SELECT sc.id, sc."sourceId", sc."chunkIndex", sc.heading,
             LEFT(sc.content, 150) as preview,
             1 - (sc.embedding <=> $1::vector) as similarity
      FROM "SourceChunk" sc
      WHERE sc."sourceId" = $2
      AND sc.embedding IS NOT NULL
      ORDER BY sc.embedding <=> $1::vector
      LIMIT $3
    `, `[${embedding.join(',')}]`, sid, SEMANTIC_PER_SOURCE)
    const name = sourceMap[sid]
    perSourceSemantic[name] = results
  }

  // Per-source keyword search
  const allTerms = terms.slice(0, 30)
  const orConditions = allTerms.map(t => ({ content: { contains: t, mode: 'insensitive' } }))

  const perSourceKeyword = {}
  for (const sid of sourceIds) {
    const results = await prisma.sourceChunk.findMany({
      where: { sourceId: sid, OR: orConditions },
      select: { id: true, sourceId: true, chunkIndex: true, heading: true, content: true },
      take: KEYWORD_PER_SOURCE,
    })
    // Score
    const scored = results.map(chunk => {
      const contentLower = chunk.content.toLowerCase()
      const headingLower = (chunk.heading || '').toLowerCase()
      let score = 0
      for (const term of allTerms) {
        const tl = term.toLowerCase()
        const inC = contentLower.includes(tl)
        const inH = headingLower.includes(tl)
        if (!inC && !inH) continue
        let s = LEGAL_PHRASES.includes(tl) ? 8 : (term.includes(':') || /\d+[.:]\d+/.test(term)) ? 6 : term.includes(' ') ? 4 : term.length >= 8 ? 3 : term.length >= 5 ? 2 : 1
        if (inH) s = Math.round(s * 1.5)
        score += s
      }
      return { ...chunk, score }
    }).sort((a, b) => b.score - a.score)

    const name = sourceMap[sid]
    perSourceKeyword[name] = scored
  }

  // RRF Fusion
  const K = 60
  const rrfScores = new Map()

  // Flatten per-source semantic into a single ranked list
  const allSemantic = []
  for (const [name, results] of Object.entries(perSourceSemantic)) {
    for (const r of results) allSemantic.push(r)
  }
  allSemantic.sort((a, b) => Number(b.similarity) - Number(a.similarity))

  // Semantic RRF
  allSemantic.forEach((r, rank) => {
    const key = `${r.sourceId}-${r.chunkIndex}`
    rrfScores.set(key, {
      sourceId: r.sourceId, chunkIndex: r.chunkIndex, heading: r.heading,
      preview: r.preview, score: 0.6 / (K + rank + 1), methods: ['sem'],
    })
  })

  // Keyword RRF
  const allKeyword = []
  for (const [name, results] of Object.entries(perSourceKeyword)) {
    for (const r of results) allKeyword.push(r)
  }
  allKeyword.sort((a, b) => b.score - a.score)

  allKeyword.forEach((r, rank) => {
    const key = `${r.sourceId}-${r.chunkIndex}`
    const existing = rrfScores.get(key)
    if (existing) {
      existing.score += 0.4 / (K + rank + 1)
      existing.methods.push('kw')
    } else {
      rrfScores.set(key, {
        sourceId: r.sourceId, chunkIndex: r.chunkIndex, heading: r.heading,
        preview: (r.content || '').slice(0, 150), score: 0.4 / (K + rank + 1), methods: ['kw'],
      })
    }
  })

  const combined = Array.from(rrfScores.values()).sort((a, b) => b.score - a.score)

  // Balanced selection
  const MIN_PER_SOURCE = 4
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

  const allSrcIds = Array.from(new Set(combined.map(c => c.sourceId)))
  for (const sid of allSrcIds) {
    const cur = perSource.get(sid) || 0
    if (cur >= MIN_PER_SOURCE) continue
    const needed = MIN_PER_SOURCE - cur
    const candidates = combined.filter(c => c.sourceId === sid && !selected.includes(c))
    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      if (selected.length >= 48) break
      selected.push(candidates[i])
      perSource.set(sid, (perSource.get(sid) || 0) + 1)
    }
  }

  selected.sort((a, b) => b.score - a.score)
  const final = selected.slice(0, 48)

  // Report
  const bySource = {}
  for (const c of final) {
    const name = sourceMap[c.sourceId] || c.sourceId
    if (!bySource[name]) bySource[name] = []
    bySource[name].push(c)
  }

  const bothMethods = final.filter(c => c.methods.length > 1).length

  console.log(`  Totaal: ${final.length} chunks, ${bothMethods} door beide methoden (${Math.round(bothMethods / Math.max(final.length, 1) * 100)}%)`)
  for (const [name, chunks] of Object.entries(bySource)) {
    const shortName = name.slice(0, 40)
    console.log(`  ${shortName}: ${chunks.length} chunks`)
    const top = chunks[0]
    console.log(`    top: [${top.score.toFixed(6)}, ${top.methods.join('+')}] "${(top.heading || '').slice(0, 60)}"`)
  }

  return { bySource, bothMethods, total: final.length }
}

async function main() {
  console.log('FASE 5: VALIDATIE — PER-SOURCE RETRIEVAL')
  console.log('='.repeat(80))

  const sources = await prisma.aISource.findMany({
    where: { isActive: true, isProcessed: true },
    select: { id: true, name: true },
  })
  // Filter out sources without chunks
  const sourceChunkCounts = await Promise.all(sources.map(async s => ({
    ...s,
    count: await prisma.sourceChunk.count({ where: { sourceId: s.id } })
  })))
  const activeSources = sourceChunkCounts.filter(s => s.count > 0)
  console.log(`Bronnen met chunks: ${activeSources.map(s => `${s.name}(${s.count})`).join(', ')}`)

  const sourceIds = activeSources.map(s => s.id)
  const sourceMap = {}
  for (const s of activeSources) sourceMap[s.id] = s.name

  const results = []
  for (const q of QUESTIONS) {
    const result = await testQuestion(q, sourceIds, sourceMap)
    results.push({ ...q, ...result })
    await new Promise(r => setTimeout(r, 500))
  }

  // Summary comparison table
  console.log('\n\n' + '='.repeat(80))
  console.log('VERGELIJKING: VOOR vs NA per-source search')
  console.log('='.repeat(80))

  // Before data from fase 2 (hardcoded from test results)
  const before = [
    { q: 1, TC: 12, Thematica: 10, VAAN: 0, RAR: 12, both: 0 },
    { q: 2, TC: 12, Thematica: 4, VAAN: 0, RAR: 12, both: 0 },
    { q: 3, TC: 12, Thematica: 3, VAAN: 0, RAR: 12, both: 0 },
    { q: 4, TC: 12, Thematica: 4, VAAN: 0, RAR: 12, both: 0 },
    { q: 5, TC: 12, Thematica: 1, VAAN: 0, RAR: 12, both: 0 },
  ]

  console.log('\n' + 'Vraag'.padEnd(6) + ' | ' + 'VOOR'.padEnd(40) + ' | ' + 'NA')
  console.log('-'.repeat(100))
  for (let i = 0; i < QUESTIONS.length; i++) {
    const b = before[i]
    const a = results[i]
    const afterCounts = {}
    for (const [name, chunks] of Object.entries(a.bySource)) {
      let key = 'RAR'
      if (name.includes('Tekst')) key = 'TC'
      else if (name.includes('Themata') || name.includes('Thematica')) key = 'Themata'
      else if (name.includes('VAAN')) key = 'VAAN'
      afterCounts[key] = (afterCounts[key] || 0) + chunks.length
    }
    const beforeStr = `TC=${b.TC} Th=${b.Thematica} VAAN=${b.VAAN} RAR=${b.RAR} both=${b.both}`
    const afterStr = `TC=${afterCounts.TC||0} Th=${afterCounts.Themata||0} VAAN=${afterCounts.VAAN||0} RAR=${afterCounts.RAR||0} both=${a.bothMethods}`
    console.log(`  ${i + 1}`.padEnd(6) + ' | ' + beforeStr.padEnd(40) + ' | ' + afterStr)
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
