/**
 * VAAN AR Updates — Volledige crawler via Boom API
 * Haalt ALLE 10.000 uitspraken op via de middleware API
 *
 * Gebruik: node scripts/crawl-vaan-all.js
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const SOURCE_ID = 'cmlcq12aj0001jmy15c7x98if'
const API_URL = 'https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter'
const PAGE_SIZE = 100

async function generateEmbeddingsBatch(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.map(t => t.slice(0, 8000)), dimensions: 1536 }),
  })
  if (!res.ok) throw new Error(`OpenAI fout (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.data.sort((a, b) => a.index - b.index).map(i => i.embedding)
}

function formatItem(item) {
  let text = ''
  text += `[${item.id}] ${item.title}\n`
  if (item.ecli) text += `ECLI: ${item.ecli}\n`
  if (item.verdictDate?.valueNl) text += `Datum: ${item.verdictDate.valueNl}\n`
  if (item.type) text += `Type: ${item.type}\n`
  if (item.judicialAuthorityList?.length) text += `Instantie: ${item.judicialAuthorityList.join(', ')}\n`
  if (item.lawReferences?.length) text += `Wetsartikelen: ${item.lawReferences.join(', ')}\n`
  if (item.keywords?.length) text += `Trefwoorden: ${item.keywords.join(', ')}\n`
  if (item.topics?.length) text += `Onderwerpen: ${item.topics.map(t => t.title).join(', ')}\n`
  if (item.description) text += `\n${item.description}\n`
  if (item.lawyers?.length) {
    const names = item.lawyers.map(l => `${l.initials} ${l.middleName || ''} ${l.lastName}`.trim())
    text += `\nAnnotator(en): ${names.join(', ')}\n`
  }
  return text
}

async function main() {
  const source = await prisma.aISource.findUnique({ where: { id: SOURCE_ID } })
  const creds = JSON.parse(source.credentials)
  const puppeteer = require('puppeteer-core')

  console.log('=== VAAN Volledige Crawler ===\n')
  console.log('Chrome starten en inloggen...')

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // Login
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))
  const btns = await page.$$('button')
  for (const btn of btns) { const t = await page.evaluate(el => (el.textContent||'').toLowerCase(), btn); if (t.includes('alle cookies')) { await btn.click(); await new Promise(r=>setTimeout(r,2000)); break } }
  const em = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (em) {
    await em.type(creds.email, { delay: 20 }); let pw = await page.$('input[type="password"]'); if (!pw) { const b = await page.$('button[type="submit"]'); if (b) { await b.click(); await new Promise(r=>setTimeout(r,3000)) } }
    pw = await page.$('input[type="password"]'); if (pw) { await pw.type(creds.password, { delay: 20 }); const s = await page.$('button[type="submit"]'); if (s) { await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), s.click()]); await new Promise(r=>setTimeout(r,3000)) } }
  }
  if (!page.url().includes('catalogus')) await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  console.log('Ingelogd!\n')

  // === STAP 1: HAAL ALLE ITEMS OP VIA API ===
  console.log('Stap 1: Alle uitspraken ophalen via API...')

  let allItems = []
  let totalHits = 0
  let pg = 1

  while (true) {
    const result = await page.evaluate(async (apiUrl, pageNum, pageSize) => {
      const body = { caseLawId: "ar-updates", year: null, page: pageNum, sort: "publication_date", filter: "", pageSize }
      const res = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
      })
      const data = await res.json()
      return { total: data.totalHits, items: data.content || [] }
    }, API_URL, pg, PAGE_SIZE)

    if (pg === 1) {
      totalHits = result.total
      console.log(`  Totaal beschikbaar: ${totalHits} uitspraken`)
    }

    if (result.items.length === 0) break

    allItems = allItems.concat(result.items)
    if (pg % 10 === 0 || result.items.length < PAGE_SIZE) {
      console.log(`  ${allItems.length}/${totalHits} opgehaald (pagina ${pg})`)
    }

    if (result.items.length < PAGE_SIZE) break // Last page
    pg++

    // Small delay to not overload the API
    await new Promise(r => setTimeout(r, 200))
  }

  await browser.close()
  console.log(`\n  ${allItems.length} uitspraken opgehaald!`)

  // === STAP 2: FORMAT EN OPSLAAN ===
  console.log('\nStap 2: Content formatteren en opslaan...')

  const rawContent = allItems.map(item => formatItem(item)).join('\n---\n\n')
  console.log(`  ${rawContent.length.toLocaleString()} tekens totaal`)

  await prisma.aISource.update({
    where: { id: SOURCE_ID },
    data: {
      content: rawContent,
      pagesCrawled: allItems.length,
      lastSynced: new Date(),
      isProcessed: true,
      processedAt: new Date(),
    },
  })

  // === STAP 3: CHUNKEN ===
  console.log('\nStap 3: Chunks aanmaken...')
  await prisma.sourceChunk.deleteMany({ where: { sourceId: SOURCE_ID } })

  // Each "item" is already a natural chunk (most are 200-1000 chars)
  // Group multiple items per chunk for efficiency (target ~3000 chars per chunk)
  const chunks = []
  let currentChunk = ''
  let currentHeading = null

  for (const item of allItems) {
    const text = formatItem(item)

    if (currentChunk.length + text.length > 4000 && currentChunk.length > 500) {
      chunks.push({ content: currentChunk.trim(), heading: currentHeading })
      currentChunk = ''
      currentHeading = null
    }

    if (!currentHeading) {
      currentHeading = `${item.id}: ${(item.title || '').slice(0, 150)}`
    }
    currentChunk += text + '\n---\n\n'
  }
  if (currentChunk.trim()) chunks.push({ content: currentChunk.trim(), heading: currentHeading })

  // Batch insert
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    await prisma.sourceChunk.createMany({
      data: batch.map((c, idx) => ({ sourceId: SOURCE_ID, chunkIndex: i + idx, content: c.content, heading: c.heading || null }))
    })
  }
  console.log(`  ${chunks.length} chunks aangemaakt`)

  // === STAP 4: EMBEDDINGS ===
  if (process.env.OPENAI_API_KEY) {
    console.log('\nStap 4: Embeddings genereren...')
    const chunkRows = await prisma.sourceChunk.findMany({
      where: { sourceId: SOURCE_ID }, select: { id: true, content: true, heading: true }, orderBy: { chunkIndex: 'asc' }
    })

    let embedded = 0
    for (let i = 0; i < chunkRows.length; i += 25) {
      const batch = chunkRows.slice(i, i + 25)
      const texts = batch.map(c => c.heading ? `${c.heading}\n\n${c.content}` : c.content)

      try {
        const embeddings = await generateEmbeddingsBatch(texts)
        for (let j = 0; j < batch.length; j++) {
          const embStr = `[${embeddings[j].join(',')}]`
          await prisma.$executeRawUnsafe(`UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`, embStr, batch[j].id)
        }
        embedded += batch.length
        if (embedded % 100 === 0 || embedded === chunkRows.length) console.log(`  ${embedded}/${chunkRows.length} embeddings`)
      } catch (err) {
        if (err.message.includes('429')) {
          console.log('  Rate limit — 30s wachten...')
          await new Promise(r => setTimeout(r, 30000))
          i -= 25; continue
        }
        console.error(`  Fout: ${err.message}`)
      }
      if (i + 25 < chunkRows.length) await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`\n=== KLAAR ===`)
  console.log(`Uitspraken: ${allItems.length}`)
  console.log(`Content: ${rawContent.length.toLocaleString()} tekens`)
  console.log(`Chunks: ${chunks.length}`)
  console.log(`ECLI's: ${allItems.filter(i => i.ecli).length}`)
  console.log(`Wetsartikelen: ${new Set(allItems.flatMap(i => i.lawReferences || [])).size} uniek`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
