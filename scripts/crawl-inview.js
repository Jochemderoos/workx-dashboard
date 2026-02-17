/**
 * InView Crawler — Haal ArbeidsRecht + RAR artikelen op via pure API calls
 * Start met de meest recente jaargangen (2026 → 2020)
 *
 * Aanpak:
 * 1. Login via Puppeteer (PingFederate SSO)
 * 2. Per publicatie: loadToc → year node IDs → getJournalDocuments per jaar → loadContent per artikel
 * 3. Opslaan in DB, chunken, embeddings genereren
 *
 * Gebruik: node scripts/crawl-inview.js
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

const START_YEAR = 2026
const END_YEAR = 2020

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

/**
 * Get year node IDs from loadToc response (intercepted during page navigation)
 */
async function getYearNodes(page, pubId) {
  // Intercept the loadToc response when navigating to publication page
  let tocResolve
  const tocPromise = new Promise(resolve => { tocResolve = resolve })
  let resolved = false

  const handler = async res => {
    if (resolved) return
    if (res.url().includes('loadToc') && res.status() === 200) {
      try {
        const text = await res.text()
        if (text.startsWith('{')) {
          resolved = true
          tocResolve(JSON.parse(text))
        }
      } catch {}
    }
  }
  page.on('response', handler)

  // Navigate to publication page — this triggers loadToc automatically
  await page.goto(`https://www.inview.nl/publication/${pubId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))

  // Accept cookies
  await page.evaluate(() => {
    const b = document.querySelectorAll('button')
    for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } }
  })
  await new Promise(r => setTimeout(r, 2000))

  // Wait for loadToc response (with timeout)
  const tocData = await Promise.race([tocPromise, new Promise(r => setTimeout(() => r(null), 10000))])
  page.off('response', handler)

  if (!tocData || !tocData.nodesRecord) {
    console.error('  Geen loadToc data ontvangen!')
    return []
  }

  // Extract year nodes from nodesRecord (nodes with 4-digit year titles)
  const yearNodes = Object.entries(tocData.nodesRecord)
    .filter(([id, node]) => /^\d{4}$/.test(node.title))
    .map(([id, node]) => ({ id, year: parseInt(node.title), title: node.title }))
    .sort((a, b) => b.year - a.year)

  return yearNodes
}

/**
 * Get all articles for a year via getJournalDocuments API (with pagination)
 */
async function getArticlesForYear(page, yearNodeId) {
  const allItems = []
  let currentPage = 1

  while (true) {
    const result = await page.evaluate(async (nodeId, pg) => {
      try {
        const searchParams = { query: "*", filterTreeIds: [], itemsPerPage: 100, page: pg }
        const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ searchParams: JSON.stringify(searchParams) })
        })
        const text = await res.text()
        if (!text.startsWith('{')) return { error: 'Not JSON', status: res.status }
        const data = JSON.parse(text)
        return {
          total: data.totalHits || 0,
          items: (data.resultItems || []).map(item => ({
            id: item.id,
            prefix: item.title?.prefix || '',
            title: item.title?.main || '',
            suffix: item.title?.suffix || '',
            reference: item.metadata?.PublicationReference || '',
            author: item.metadata?.Author || '',
            date: item.metadata?.RevisionDate || item.metadata?.PublicationDate || '',
            abstract: item.metadata?.Abstract || '',
            ecli: item.metadata?.EcliNumber || '',
            court: item.metadata?.CourtName || '',
          }))
        }
      } catch (e) {
        return { error: e.message }
      }
    }, yearNodeId, currentPage)

    if (result.error) {
      console.error(`    API fout: ${result.error}`)
      break
    }

    allItems.push(...result.items)

    if (currentPage === 1 && result.total > 100) {
      console.log(`    (${result.total} items, meerdere pagina's)`)
    }

    if (allItems.length >= result.total || result.items.length === 0) break
    currentPage++
    await new Promise(r => setTimeout(r, 300))
  }

  return allItems
}

/**
 * Get article content via loadContent API
 */
async function getArticleContent(page, documentId) {
  return await page.evaluate(async (docId) => {
    try {
      const params = {
        documentId: docId,
        renderOptions: {
          isLawDocument: false, renderRelatedTabs: false, isSTIView: false,
          isExpandableFragmentsEnabled: false, renderAnnotations: true,
          isFreemiumUser: false, publicationId: ""
        },
        searchId: null, searchTerm: "", shouldHidePdfLink: false, skipGetHighlights: false,
      }
      const res = await fetch('/edge/document/loadContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ params: JSON.stringify(params) })
      })
      const text = await res.text()
      if (!text.startsWith('{')) return ''
      const data = JSON.parse(text)
      const div = document.createElement('div')
      div.innerHTML = data.content || ''
      return (div.textContent || '').replace(/\s+/g, ' ').trim()
    } catch {
      return ''
    }
  }, documentId)
}

async function main() {
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { id: true, credentials: true, name: true }
  })
  if (!inviewSource) { console.error('Geen InView bron gevonden!'); process.exit(1) }
  const creds = JSON.parse(inviewSource.credentials)
  const sourceId = inviewSource.id

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  console.log('=== InView Crawler ===\n')
  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); await browser.close(); process.exit(1) }
  console.log('Ingelogd!\n')

  const allArticleTexts = []
  let totalChars = 0

  for (const pub of PUBLICATIONS) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`=== ${pub.fullName} ===`)
    console.log(`${'='.repeat(50)}\n`)

    // Step 1: Get year node IDs from loadToc
    console.log('Jaargangen ophalen via loadToc...')
    const yearNodes = await getYearNodes(page, pub.id)
    console.log(`${yearNodes.length} jaargangen gevonden: ${yearNodes.map(y => y.year).join(', ')}`)

    // Step 2: Filter years 2026-2020
    const targetYears = yearNodes.filter(y => y.year >= END_YEAR && y.year <= START_YEAR)
    console.log(`Verwerken: ${targetYears.map(y => y.year).join(', ')}\n`)

    let pubArticles = 0
    let pubChars = 0

    // Step 3: For each year, get articles via getJournalDocuments
    for (const yearNode of targetYears) {
      console.log(`--- ${yearNode.year} ---`)

      const articles = await getArticlesForYear(page, yearNode.id)

      if (articles.length === 0) {
        console.log(`  Geen artikelen gevonden`)
        continue
      }

      console.log(`  ${articles.length} artikelen, content ophalen...`)

      // Step 4: For each article, get content via loadContent
      let yearChars = 0
      let fetched = 0

      for (const article of articles) {
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

            allArticleTexts.push({
              text,
              reference: article.reference || article.prefix,
              title: article.title,
              pubName: pub.name,
            })

            yearChars += text.length
            fetched++
          }
        } catch (err) {
          console.error(`    Fout bij ${article.reference || article.id}: ${err.message?.slice(0, 60)}`)
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 200))

        // Progress update every 10 articles
        if (fetched > 0 && fetched % 10 === 0) {
          process.stdout.write(`  ${fetched}/${articles.length}...`)
        }
      }

      if (fetched > 0 && fetched >= 10) console.log('')
      console.log(`  ${fetched} artikelen opgehaald (${(yearChars / 1000).toFixed(0)}K tekens)`)

      pubArticles += fetched
      pubChars += yearChars
    }

    console.log(`\n${pub.name}: ${pubArticles} artikelen, ${(pubChars / 1000).toFixed(0)}K tekens`)
    totalChars += pubChars
  }

  console.log(`\n\n${'='.repeat(50)}`)
  console.log(`Totaal: ${allArticleTexts.length} artikelen, ${(totalChars / 1000).toFixed(0)}K tekens`)

  if (allArticleTexts.length === 0) {
    console.log('Geen artikelen gevonden!')
    await browser.close()
    await prisma.$disconnect()
    return
  }

  // === OPSLAAN ===
  console.log('\nContent opslaan in database...')
  const rawContent = allArticleTexts.map(a => a.text).join('\n---\n\n')
  console.log(`${rawContent.length.toLocaleString()} tekens totaal`)

  await prisma.aISource.update({
    where: { id: sourceId },
    data: {
      content: rawContent,
      pagesCrawled: allArticleTexts.length,
      lastSynced: new Date(),
      isProcessed: true,
      processedAt: new Date(),
    },
  })
  console.log('Database bijgewerkt!')

  // === CHUNKS ===
  console.log('\nChunks aanmaken...')
  await prisma.sourceChunk.deleteMany({ where: { sourceId } })

  const chunks = []
  for (const article of allArticleTexts) {
    const text = article.text
    if (text.length > 5000) {
      const words = text.split(' ')
      let currentChunk = ''
      let partNum = 1
      for (const word of words) {
        if (currentChunk.length + word.length > 4000 && currentChunk.length > 500) {
          chunks.push({
            content: currentChunk.trim(),
            heading: partNum === 1
              ? `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}`
              : `${article.pubName} — ${article.reference}: ${article.title.slice(0, 90)} (deel ${partNum})`
          })
          currentChunk = ''
          partNum++
        }
        currentChunk += word + ' '
      }
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          heading: partNum === 1
            ? `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}`
            : `${article.pubName} — ${article.reference}: ${article.title.slice(0, 90)} (deel ${partNum})`
        })
      }
    } else {
      chunks.push({
        content: text.trim(),
        heading: `${article.pubName} — ${article.reference}: ${article.title.slice(0, 120)}`
      })
    }
  }

  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100)
    await prisma.sourceChunk.createMany({
      data: batch.map((c, idx) => ({ sourceId, chunkIndex: i + idx, content: c.content, heading: c.heading }))
    })
  }
  console.log(`${chunks.length} chunks aangemaakt`)

  // === EMBEDDINGS ===
  if (process.env.OPENAI_API_KEY) {
    console.log('\nEmbeddings genereren...')
    const chunkRows = await prisma.sourceChunk.findMany({
      where: { sourceId }, select: { id: true, content: true, heading: true }, orderBy: { chunkIndex: 'asc' }
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
        if (embedded % 50 === 0 || embedded === chunkRows.length) {
          console.log(`  ${embedded}/${chunkRows.length} embeddings`)
        }
      } catch (err) {
        if (err.message.includes('429')) {
          console.log('  Rate limit — 30s wachten...')
          await new Promise(r => setTimeout(r, 30000))
          i -= 25
          continue
        }
        console.error(`  Fout: ${err.message}`)
      }
      if (i + 25 < chunkRows.length) await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`=== KLAAR ===`)
  console.log(`Artikelen: ${allArticleTexts.length}`)
  console.log(`Content: ${rawContent.length.toLocaleString()} tekens`)
  console.log(`Chunks: ${chunks.length}`)
  console.log(`ArbeidsRecht: ${allArticleTexts.filter(a => a.pubName === 'ArbeidsRecht').length}`)
  console.log(`RAR: ${allArticleTexts.filter(a => a.pubName === 'RAR').length}`)

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
