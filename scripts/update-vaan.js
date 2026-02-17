/**
 * VAAN AR Updates — Wekelijkse incrementele update
 * Haalt alleen NIEUWE uitspraken op sinds de laatste sync
 *
 * Gebruik: node scripts/update-vaan.js
 * Plan: wekelijks draaien via Windows Task Scheduler
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
  if (!source) { console.error('VAAN bron niet gevonden!'); process.exit(1) }

  const lastSynced = source.lastSynced
  const creds = JSON.parse(source.credentials)
  const puppeteer = require('puppeteer-core')

  console.log('=== VAAN Wekelijkse Update ===')
  console.log(`Laatste sync: ${lastSynced ? lastSynced.toISOString() : 'nooit'}`)
  console.log('')

  // --- Login via Puppeteer ---
  console.log('Chrome starten en inloggen...')
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

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

  // --- Haal bestaande item IDs op ---
  // We checken de bestaande content om te zien welke IDs al in de database staan
  const existingChunks = await prisma.sourceChunk.findMany({
    where: { sourceId: SOURCE_ID },
    select: { content: true },
  })
  const existingIds = new Set()
  for (const chunk of existingChunks) {
    // Extract item IDs like [ar-2025-0834] from chunk content
    const matches = chunk.content.match(/\[ar-\d{4}-\d{4}\]/g)
    if (matches) matches.forEach(m => existingIds.add(m.slice(1, -1)))
  }
  console.log(`Bestaande uitspraken in database: ${existingIds.size}`)

  // --- Haal nieuwe items op ---
  console.log('Nieuwe uitspraken ophalen...')
  let newItems = []
  let pg = 1
  let consecutiveOldPages = 0

  while (true) {
    const result = await page.evaluate(async (apiUrl, pageNum, pageSize) => {
      const body = { caseLawId: "ar-updates", year: null, page: pageNum, sort: "publication_date", filter: "", pageSize }
      const res = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
      })
      const data = await res.json()
      return { total: data.totalHits, items: data.content || [] }
    }, API_URL, pg, PAGE_SIZE)

    if (pg === 1) console.log(`  Totaal beschikbaar: ${result.total} uitspraken`)
    if (result.items.length === 0) break

    // Filter: alleen items die we nog niet hebben
    const pageNewItems = result.items.filter(item => !existingIds.has(item.id))
    newItems = newItems.concat(pageNewItems)

    console.log(`  Pagina ${pg}: ${result.items.length} items, ${pageNewItems.length} nieuw`)

    // Als een hele pagina geen nieuwe items heeft, stoppen we
    // (items zijn gesorteerd op publicatiedatum, dus oudere items komen later)
    if (pageNewItems.length === 0) {
      consecutiveOldPages++
      if (consecutiveOldPages >= 3) {
        console.log('  3 paginas zonder nieuwe items — stoppen')
        break
      }
    } else {
      consecutiveOldPages = 0
    }

    if (result.items.length < PAGE_SIZE) break
    pg++
    await new Promise(r => setTimeout(r, 200))
  }

  await browser.close()

  if (newItems.length === 0) {
    console.log('\nGeen nieuwe uitspraken gevonden. Database is up-to-date!')
    await prisma.aISource.update({
      where: { id: SOURCE_ID },
      data: { lastSynced: new Date() },
    })
    await prisma.$disconnect()
    return
  }

  console.log(`\n${newItems.length} nieuwe uitspraken gevonden!`)

  // --- Content formatteren ---
  const newContent = newItems.map(item => formatItem(item)).join('\n---\n\n')
  console.log(`Nieuwe content: ${newContent.length.toLocaleString()} tekens`)

  // Update totale content (append)
  const existingContent = source.content || ''
  const updatedContent = existingContent + '\n---\n\n' + newContent

  await prisma.aISource.update({
    where: { id: SOURCE_ID },
    data: {
      content: updatedContent,
      pagesCrawled: (source.pagesCrawled || 0) + newItems.length,
      lastSynced: new Date(),
    },
  })

  // --- Chunks aanmaken voor nieuwe items ---
  console.log('\nChunks aanmaken voor nieuwe items...')

  // Get the highest existing chunk index
  const lastChunk = await prisma.sourceChunk.findFirst({
    where: { sourceId: SOURCE_ID },
    orderBy: { chunkIndex: 'desc' },
    select: { chunkIndex: true },
  })
  let nextChunkIndex = (lastChunk?.chunkIndex || 0) + 1

  const newChunks = []
  let currentChunk = ''
  let currentHeading = null

  for (const item of newItems) {
    const text = formatItem(item)
    if (currentChunk.length + text.length > 4000 && currentChunk.length > 500) {
      newChunks.push({ content: currentChunk.trim(), heading: currentHeading })
      currentChunk = ''
      currentHeading = null
    }
    if (!currentHeading) {
      currentHeading = `${item.id}: ${(item.title || '').slice(0, 150)}`
    }
    currentChunk += text + '\n---\n\n'
  }
  if (currentChunk.trim()) newChunks.push({ content: currentChunk.trim(), heading: currentHeading })

  // Insert new chunks
  for (let i = 0; i < newChunks.length; i += 100) {
    const batch = newChunks.slice(i, i + 100)
    await prisma.sourceChunk.createMany({
      data: batch.map((c, idx) => ({
        sourceId: SOURCE_ID,
        chunkIndex: nextChunkIndex + i + idx,
        content: c.content,
        heading: c.heading || null,
      }))
    })
  }
  console.log(`${newChunks.length} nieuwe chunks aangemaakt`)

  // --- Embeddings genereren ---
  if (process.env.OPENAI_API_KEY) {
    console.log('\nEmbeddings genereren voor nieuwe chunks...')
    const chunkRows = await prisma.sourceChunk.findMany({
      where: { sourceId: SOURCE_ID, chunkIndex: { gte: nextChunkIndex } },
      select: { id: true, content: true, heading: true },
      orderBy: { chunkIndex: 'asc' },
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
        console.log(`  ${embedded}/${chunkRows.length} embeddings`)
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

  console.log(`\n=== UPDATE KLAAR ===`)
  console.log(`Nieuwe uitspraken: ${newItems.length}`)
  console.log(`Nieuwe chunks: ${newChunks.length}`)
  console.log(`Totaal in database: ${existingIds.size + newItems.length} uitspraken`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
