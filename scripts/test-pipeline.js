/**
 * FASE 3: Full pipeline test
 * Test extractSearchTerms + expandSearchQueries + context window usage
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const Anthropic = require('@anthropic-ai/sdk').default

// Replicated from route.ts
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

async function expandSearchQueries(userMessage, apiKey) {
  const client = new Anthropic({ apiKey, timeout: 10000 })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: `Je bent een zoekquery-generator voor een Nederlandse arbeidsrecht-kennisbank met 5 bronnen:
- Tekst & Commentaar Arbeidsrecht (wetcommentaar per artikel)
- Thematica Arbeidsrecht (thematische analyses)
- VAAN AR Updates (recente rechtspraakoverzichten)
- RAR Rechtspraak Arbeidsrecht (jurisprudentie-annotaties 2000-2026)
- Rechtspraak.nl (uitspraken-database)

Genereer 5 zoekformuleringen die VERSCHILLENDE passages uit VERSCHILLENDE bronnen zullen treffen:
1. Het relevante BW-artikel met nummer (bijv. "art. 7:669 lid 3 sub g BW disfunctioneren") — treft T&C
2. Het juridische thema als zoekterm (bijv. "disfunctioneren verbetertraject ontslag") — treft Thematica
3. Juridische synoniemen/gerelateerde concepten (bijv. "ongeschiktheid functie-eisen herplaatsing") — treft RAR/VAAN
4. Proceduretermen (bijv. "ontbindingsverzoek kantonrechter disfunctioneren") — treft recente rechtspraak
5. Gerelateerde deelvraag die de gebruiker niet expliciet stelde maar wel relevant is (bijv. "transitievergoeding bij ontslag wegens disfunctioneren")

Geef ALLEEN de 5 queries, een per regel, zonder nummering of uitleg.`,
    messages: [{ role: 'user', content: userMessage }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  return text.split('\n').map(q => q.trim()).filter(q => q.length > 5 && q.length < 200).slice(0, 5)
}

const QUESTIONS = [
  "Wat is de opzegtermijn bij een dienstverband van 10 jaar?",
  "Wanneer is sprake van ernstig verwijtbaar handelen door de werkgever?",
  "Wat zijn de recente ontwikkelingen rond de i-grond/cumulatiegrond?",
  "Hoe wordt de billijke vergoeding berekend na de New Hairstyle beschikking?",
  "Wat zijn de vereisten voor ontslag wegens disfunctioneren?",
]

async function main() {
  console.log('FASE 3: FULL PIPELINE TEST')
  console.log('='.repeat(100))

  for (const q of QUESTIONS) {
    console.log('\n' + '-'.repeat(100))
    console.log(`VRAAG: "${q}"`)
    console.log('-'.repeat(100))

    // 1. extractSearchTerms
    const terms = extractSearchTerms(q)
    console.log(`\n  extractSearchTerms (${terms.length}):`)
    for (const t of terms) {
      const isPhrase = LEGAL_PHRASES.includes(t.toLowerCase())
      const isArticle = t.includes(':') || /\d+[.:]\d+/.test(t)
      const type = isPhrase ? '[JURIDISCHE FRASE]' : isArticle ? '[ARTIKEL]' : t.includes(' ') ? '[MULTI-WOORD]' : '[ENKEL]'
      console.log(`    ${type} "${t}"`)
    }

    // 2. expandSearchQueries
    console.log(`\n  expandSearchQueries:`)
    try {
      const expanded = await expandSearchQueries(q, process.env.ANTHROPIC_API_KEY)
      for (let i = 0; i < expanded.length; i++) {
        console.log(`    ${i + 1}. "${expanded[i]}"`)
      }

      // Check: zit er een artikelverwijzing bij?
      const hasArticle = expanded.some(e => /\d+:\d+/.test(e) || /art\.?\s*\d/i.test(e))
      console.log(`\n    Artikelverwijzing in expanded: ${hasArticle ? 'JA' : 'NEE'}`)

      // Check: unieke woorden over alle queries
      const allWords = expanded.flatMap(e => e.toLowerCase().split(/\s+/)).filter(w => w.length > 3)
      const uniqueWords = new Set(allWords)
      console.log(`    Unieke zoekwoorden: ${uniqueWords.size} (uit ${allWords.length} totaal)`)
    } catch (err) {
      console.log(`    FOUT: ${err.message}`)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\n\n' + '='.repeat(100))
  console.log('CONTEXT WINDOW ANALYSE')
  console.log('='.repeat(100))

  // Read the system prompt to estimate its size
  const routeFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'claude', 'chat', 'route.ts'), 'utf8')
  const promptMatch = routeFile.match(/const SYSTEM_PROMPT = `([\s\S]*?)`/)
  const systemPrompt = promptMatch ? promptMatch[1] : ''

  console.log(`\n  System prompt lengte: ${systemPrompt.length} tekens (~${Math.ceil(systemPrompt.length / 3.5)} tokens)`)

  // Estimate sourcesContext for 40 chunks
  const avgChunkLen = 3800 // from fase 1 data
  const enrichedChunkLen = avgChunkLen + 1600 // adjacent chunks (~800 before + ~800 after)
  const headerPerChunk = 80
  const totalContextPer40Chunks = 40 * (enrichedChunkLen + headerPerChunk)

  console.log(`  Geschatte broncontext (40 chunks):`)
  console.log(`    Gem. chunk: ${avgChunkLen} tekens`)
  console.log(`    + adjacent: ${enrichedChunkLen} tekens`)
  console.log(`    + headers: ${headerPerChunk} tekens`)
  console.log(`    Totaal: ${totalContextPer40Chunks} tekens (~${Math.ceil(totalContextPer40Chunks / 3.5)} tokens)`)

  const totalInput = systemPrompt.length + totalContextPer40Chunks
  console.log(`\n  TOTAAL INPUT:`)
  console.log(`    System prompt: ${systemPrompt.length} tekens`)
  console.log(`    Broncontext:   ${totalContextPer40Chunks} tekens`)
  console.log(`    Totaal:        ${totalInput} tekens (~${Math.ceil(totalInput / 3.5)} tokens)`)
  console.log(`    Max context:   170,000 tokens`)
  console.log(`    Benutting:     ${(Math.ceil(totalInput / 3.5) / 170000 * 100).toFixed(1)}%`)
  console.log(`    Ruimte over:   ~${170000 - Math.ceil(totalInput / 3.5)} tokens (voor history + antwoord)`)
}

main().catch(err => { console.error(err); process.exit(1) })
