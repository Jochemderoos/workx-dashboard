/**
 * InView Update — Haal nieuwe ArbeidsRecht + RAR artikelen op
 * Checkt het huidige en vorige jaar, en voegt alleen nieuwe artikelen toe.
 *
 * Gebruik: node scripts/update-inview.js
 * Draai maandelijks via Task Scheduler of cron.
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const puppeteer = require('puppeteer-core')

const PUBLICATIONS = [
  { id: 'WKNL_CSL_9', name: 'ArbeidsRecht', fullName: 'ArbeidsRecht. Maandblad voor de praktijk' },
  { id: 'WKNL_CSL_124', name: 'RAR', fullName: 'Rechtspraak Arbeidsrecht (RAR)' },
]

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

async function login(page, creds) {
  const ssoUrl = `https://www.inview.nl/.sso/login?redirect_uri=${encodeURIComponent('https://www.inview.nl/zoeken')}`
  await page.goto(ssoUrl, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  let uf = await page.$('input[name="pf.username"]')
  if (uf) { await uf.click({ clickCount: 3 }).catch(() => {}); await uf.type(creds.email, { delay: 30 }) }
  await new Promise(r => setTimeout(r, 500))
  const btns = await page.$$('button.wk-login-submit')
  for (const btn of btns) { const type = await page.evaluate(el => el.type, btn); if (type === 'button') { await btn.click(); break } }
  await new Promise(r => setTimeout(r, 5000))
  let pw = await page.$('input[name="pf.pass"]')
  if (!pw) pw = await page.$('input[type="password"]')
  if (pw) { const vis = await page.evaluate(el => el.offsetParent !== null, pw); if (vis) { await pw.click({ clickCount: 3 }).catch(() => {}); await pw.type(creds.password, { delay: 30 }) } }
  await new Promise(r => setTimeout(r, 500))
  await page.evaluate(() => { const f = document.getElementById('KauriForm'); if (f) { const ok = f.querySelector('input[name="$ok"]'); if (ok) ok.value = 'clicked'; f.submit() } })
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 5000))
  return page.url().includes('inview.nl') && !page.url().includes('login')
}

async function getYearNodes(page, pubId) {
  let tocResolve
  const tocPromise = new Promise(resolve => { tocResolve = resolve })
  let resolved = false
  const handler = async res => {
    if (resolved) return
    if (res.url().includes('loadToc') && res.status() === 200) {
      try { const text = await res.text(); if (text.startsWith('{')) { resolved = true; tocResolve(JSON.parse(text)) } } catch {}
    }
  }
  page.on('response', handler)
  await page.goto(`https://www.inview.nl/publication/${pubId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
  await new Promise(r => setTimeout(r, 2000))
  const tocData = await Promise.race([tocPromise, new Promise(r => setTimeout(() => r(null), 10000))])
  page.off('response', handler)
  if (!tocData?.nodesRecord) return []
  return Object.entries(tocData.nodesRecord)
    .filter(([id, node]) => /^\d{4}$/.test(node.title))
    .map(([id, node]) => ({ id, year: parseInt(node.title) }))
    .sort((a, b) => b.year - a.year)
}

async function getAllArticleIds(page, yearNodeId) {
  const allIds = []
  let currentPage = 1
  while (true) {
    const result = await page.evaluate(async (nodeId, pg) => {
      try {
        const searchParams = { query: "*", filterTreeIds: [], itemsPerPage: 100, page: pg }
        const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include', body: JSON.stringify({ searchParams: JSON.stringify(searchParams) })
        })
        const text = await res.text()
        if (!text.startsWith('{')) return { error: 'Not JSON' }
        const data = JSON.parse(text)
        return {
          total: data.totalHits || 0,
          items: (data.resultItems || []).map(item => ({
            id: item.id, prefix: item.title?.prefix || '', title: item.title?.main || '',
            reference: item.metadata?.PublicationReference || '', author: item.metadata?.Author || '',
            date: item.metadata?.RevisionDate || '', abstract: item.metadata?.Abstract || '',
            ecli: item.metadata?.EcliNumber || '', court: item.metadata?.CourtName || '',
          }))
        }
      } catch (e) { return { error: e.message } }
    }, yearNodeId, currentPage)
    if (result.error) break
    allIds.push(...result.items)
    if (allIds.length >= result.total || result.items.length === 0) break
    currentPage++
    await new Promise(r => setTimeout(r, 300))
  }
  return allIds
}

async function getArticleContent(page, documentId) {
  return await page.evaluate(async (docId) => {
    try {
      const params = {
        documentId: docId,
        renderOptions: { isLawDocument: false, renderRelatedTabs: false, isSTIView: false,
          isExpandableFragmentsEnabled: false, renderAnnotations: true, isFreemiumUser: false, publicationId: "" },
        searchId: null, searchTerm: "", shouldHidePdfLink: false, skipGetHighlights: false,
      }
      const res = await fetch('/edge/document/loadContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include', body: JSON.stringify({ params: JSON.stringify(params) })
      })
      const text = await res.text()
      if (!text.startsWith('{')) return ''
      const data = JSON.parse(text)
      const div = document.createElement('div')
      div.innerHTML = data.content || ''
      return (div.textContent || '').replace(/\s+/g, ' ').trim()
    } catch { return '' }
  }, documentId)
}

async function main() {
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { id: true, credentials: true, content: true }
  })
  if (!inviewSource) { console.error('Geen InView bron!'); process.exit(1) }
  const creds = JSON.parse(inviewSource.credentials)
  const sourceId = inviewSource.id

  // Get existing article references to avoid duplicates
  const existingChunks = await prisma.sourceChunk.findMany({
    where: { sourceId }, select: { heading: true }
  })
  const existingRefs = new Set()
  for (const chunk of existingChunks) {
    // Extract reference from heading like "ArbeidsRecht — 2025/12: titel"
    const match = chunk.heading?.match(/— ([^:]+):/)
    if (match) existingRefs.add(match[1].trim())
  }
  console.log(`${existingRefs.size} bestaande referenties gevonden`)

  const lastChunk = await prisma.sourceChunk.findFirst({
    where: { sourceId }, orderBy: { chunkIndex: 'desc' }, select: { chunkIndex: true }
  })
  let nextChunkIndex = (lastChunk?.chunkIndex ?? -1) + 1

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  console.log('=== InView Update ===\n')
  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); await browser.close(); process.exit(1) }
  console.log('Ingelogd!\n')

  const currentYear = new Date().getFullYear()
  const checkYears = [currentYear, currentYear - 1] // Check current + previous year
  const newArticleTexts = []

  for (const pub of PUBLICATIONS) {
    console.log(`\n=== ${pub.name} ===`)
    const yearNodes = await getYearNodes(page, pub.id)

    for (const yearNode of yearNodes.filter(y => checkYears.includes(y.year))) {
      console.log(`\n${yearNode.year}:`)
      const articles = await getAllArticleIds(page, yearNode.id)
      console.log(`  ${articles.length} artikelen totaal`)

      // Filter out already existing articles
      const newArticles = articles.filter(a => {
        const ref = a.reference || a.prefix
        return ref && !existingRefs.has(ref)
      })

      if (newArticles.length === 0) {
        console.log('  Geen nieuwe artikelen')
        continue
      }

      console.log(`  ${newArticles.length} NIEUWE artikelen, content ophalen...`)

      for (const article of newArticles) {
        try {
          const content = await getArticleContent(page, article.id)
          if (content && content.length > 50) {
            let text = `[${article.reference || article.prefix}] ${article.title}\n`
            text += `Bron: ${pub.name}\n`
            if (article.author) text += `Auteur: ${article.author}\n`
            if (article.date) text += `Datum: ${article.date}\n`
            if (article.ecli) text += `ECLI: ${article.ecli}\n`
            if (article.court) text += `Instantie: ${article.court}\n`
            if (article.abstract) text += `Samenvatting: ${article.abstract}\n`
            text += `\n${content}\n`
            newArticleTexts.push({ text, reference: article.reference || article.prefix, title: article.title, pubName: pub.name })
          }
        } catch (err) {
          console.error(`    Fout: ${err.message?.slice(0, 60)}`)
        }
        await new Promise(r => setTimeout(r, 200))
      }
      console.log(`  ${newArticleTexts.length} nieuwe artikelen opgehaald`)
    }
  }

  if (newArticleTexts.length === 0) {
    console.log('\nGeen nieuwe artikelen gevonden. Klaar!')
    await browser.close()
    await prisma.$disconnect()
    return
  }

  // Append content
  console.log(`\n${newArticleTexts.length} nieuwe artikelen toevoegen...`)
  const newContent = newArticleTexts.map(a => a.text).join('\n---\n\n')
  const existing = inviewSource.content || ''
  await prisma.aISource.update({
    where: { id: sourceId },
    data: {
      content: existing ? existing + '\n---\n\n' + newContent : newContent,
      pagesCrawled: { increment: newArticleTexts.length },
      lastSynced: new Date(),
    }
  })

  // Create new chunks
  const chunks = []
  for (const article of newArticleTexts) {
    const text = article.text
    if (text.length > 5000) {
      const words = text.split(' ')
      let currentChunk = '', partNum = 1
      for (const word of words) {
        if (currentChunk.length + word.length > 4000 && currentChunk.length > 500) {
          chunks.push({ content: currentChunk.trim(), heading: `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}${partNum > 1 ? ` (deel ${partNum})` : ''}` })
          currentChunk = ''
          partNum++
        }
        currentChunk += word + ' '
      }
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), heading: `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}${partNum > 1 ? ` (deel ${partNum})` : ''}` })
      }
    } else {
      chunks.push({ content: text.trim(), heading: `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}` })
    }
  }

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    await prisma.sourceChunk.createMany({
      data: batch.map((c, idx) => ({ sourceId, chunkIndex: nextChunkIndex + i + idx, content: c.content, heading: c.heading }))
    })
  }
  console.log(`${chunks.length} nieuwe chunks`)

  // Generate embeddings
  if (process.env.OPENAI_API_KEY) {
    console.log('Embeddings genereren...')
    const newChunks = await prisma.sourceChunk.findMany({
      where: { sourceId, chunkIndex: { gte: nextChunkIndex } },
      select: { id: true, content: true, heading: true }, orderBy: { chunkIndex: 'asc' }
    })
    let embedded = 0
    for (let i = 0; i < newChunks.length; i += 25) {
      const batch = newChunks.slice(i, i + 25)
      const texts = batch.map(c => c.heading ? `${c.heading}\n\n${c.content}` : c.content)
      try {
        const embeddings = await generateEmbeddingsBatch(texts)
        for (let j = 0; j < batch.length; j++) {
          const embStr = `[${embeddings[j].join(',')}]`
          await prisma.$executeRawUnsafe(`UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`, embStr, batch[j].id)
        }
        embedded += batch.length
        if (embedded % 50 === 0 || embedded === newChunks.length) console.log(`  ${embedded}/${newChunks.length}`)
      } catch (err) {
        if (err.message.includes('429')) { console.log('  Rate limit...'); await new Promise(r => setTimeout(r, 30000)); i -= 25; continue }
        console.error(`  Fout: ${err.message}`)
      }
      if (i + 25 < newChunks.length) await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`\n=== KLAAR ===`)
  console.log(`Nieuwe artikelen: ${newArticleTexts.length}`)
  console.log(`Nieuwe chunks: ${chunks.length}`)

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
