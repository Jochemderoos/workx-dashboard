/**
 * Test: haal een individueel InView artikel op via de edge API
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const puppeteer = require('puppeteer-core')

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

async function main() {
  const inviewSource = await prisma.aISource.findFirst({ where: { url: { contains: 'inview.nl' } }, select: { credentials: true } })
  const creds = JSON.parse(inviewSource.credentials)

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // Intercept loadContent calls
  const loadContentCalls = []
  page.on('request', req => {
    if (req.url().includes('loadContent') && req.method() === 'POST') {
      loadContentCalls.push({ url: req.url(), body: req.postData() })
    }
  })

  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); process.exit(1) }
  console.log('Ingelogd!\n')

  // === TEST 1: Get TOC tree for ArbeidsRecht ===
  console.log('=== 1. TOC Tree ophalen voor ArbeidsRecht ===')

  // Navigate to publication page to trigger API calls
  await page.goto('https://www.inview.nl/publication/WKNL_CSL_9', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  // Accept cookies
  await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
  await new Promise(r => setTimeout(r, 3000))

  // Get TOC tree via API - use encodeURIComponent for proper encoding
  const tocData = await page.evaluate(async () => {
    const pub = encodeURIComponent('"WKNL_CSL_9"')
    const doc = encodeURIComponent('"id-f4f2f3ddd40c8f10ee1615d6ba5fd915"')
    const res = await fetch(`/edge/document/loadToc?publication=${pub}&document=${doc}&shouldUseModelDocumentId=true`, {
      credentials: 'include'
    })
    const text = await res.text()
    if (!text.startsWith('{')) return { error: 'Not JSON', preview: text.slice(0, 200) }
    return JSON.parse(text)
  })
  console.log('Root:', tocData.rootNodeId)
  console.log('Current:', tocData.currentNode?.title)
  console.log('Siblings:', tocData.currentNode?.siblings?.length || 'none')

  // Try to get all children of root node
  console.log('\n=== 2. Kinderen van root node (jaargangen) ===')
  const rootChildren = await page.evaluate(async () => {
    const nodeId = encodeURIComponent('"csh-da-filter!WKNL_CSL_9"')
    const pub = encodeURIComponent('"WKNL_CSL_9"')
    const endpoints = [
      `/edge/document/loadTocChildren?nodeId=${nodeId}&publication=${pub}`,
      `/edge/document/expandTocNode?nodeId=${nodeId}&publication=${pub}`,
      `/edge/document/getTocChildren?nodeId=${nodeId}&publication=${pub}`,
    ]
    const results = {}
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { credentials: 'include' })
        const text = await res.text()
        const name = ep.split('?')[0].split('/').pop()
        results[name] = {
          status: res.status,
          isJson: text.startsWith('{') || text.startsWith('['),
          size: text.length,
          preview: text.slice(0, 1000)
        }
      } catch (e) {
        const name = ep.split('?')[0].split('/').pop()
        results[name] = { error: e.message }
      }
    }
    return results
  })

  for (const [name, r] of Object.entries(rootChildren)) {
    console.log(`  ${name}: [${r.status}] ${r.isJson ? 'JSON' : 'HTML'} (${r.size}b)`)
    if (r.isJson) console.log(`    ${r.preview?.slice(0, 500)}`)
  }

  // === 3. Get articles from latest issue ===
  console.log('\n=== 3. Artikelen uit laatste aflevering ArbeidsRecht ===')
  const articles = await page.evaluate(async () => {
    const nodeId = 'csh-da-filter!WKNL_CSL_9--WKNL_LTR_9#id-f4f2f3ddd40c8f10ee1615d6ba5fd915'
    const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}`, {
      credentials: 'include'
    })
    return await res.json()
  })

  console.log(`Artikelen: ${articles.totalHits}`)
  for (const item of (articles.resultItems || [])) {
    console.log(`\n  ${item.title?.prefix} — ${item.title?.main?.slice(0, 80)}`)
    console.log(`    Auteur: ${item.metadata?.Author}`)
    console.log(`    Datum: ${item.metadata?.RevisionDate}`)
    console.log(`    Abstract: ${item.metadata?.Abstract?.slice(0, 200)}`)
    console.log(`    ID: ${item.id}`)
  }

  // === 4. Fetch content of first article ===
  if (articles.resultItems?.length > 0) {
    console.log('\n=== 4. Content ophalen van eerste artikel ===')
    const articleId = articles.resultItems[0].id

    // Navigate to article to see how loadContent is called
    loadContentCalls.length = 0
    await page.goto(`https://www.inview.nl/document/${articleId}?ctx=WKNL_CSL_9`, {
      waitUntil: 'networkidle2', timeout: 20000
    })
    await new Promise(r => setTimeout(r, 8000))
    await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
    await new Promise(r => setTimeout(r, 3000))

    // Check intercepted loadContent calls
    console.log(`loadContent calls: ${loadContentCalls.length}`)
    for (const call of loadContentCalls) {
      console.log(`  URL: ${call.url}`)
      console.log(`  Body: ${call.body?.slice(0, 500)}`)
    }

    // Get rendered content from the page
    const pageContent = await page.evaluate(() => {
      // Try article/document selectors
      const selectors = ['.wk-atlas-document', '.wk-document', 'article', '.document-content', '.article-content', 'main']
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el && el.textContent.trim().length > 100) {
          return {
            selector: sel,
            textLength: el.textContent.replace(/\s+/g, ' ').trim().length,
            text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 3000),
            html: el.innerHTML.slice(0, 1000),
          }
        }
      }
      // Fallback: just get body text
      const text = document.body.innerText?.replace(/\s+/g, ' ').trim() || ''
      return { selector: 'body', textLength: text.length, text: text.slice(0, 3000) }
    })

    console.log(`\nSelector: ${pageContent.selector}`)
    console.log(`Text lengte: ${pageContent.textLength} tekens`)
    console.log(`\nContent preview:\n${pageContent.text.slice(0, 2000)}`)

    // Also try the loadContent API directly
    console.log('\n=== 5. loadContent API direct aanroepen ===')
    const directContent = await page.evaluate(async (docId) => {
      // Try different POST body formats
      const bodies = [
        { document: docId, publication: 'WKNL_CSL_9' },
        { documentId: docId, publicationId: 'WKNL_CSL_9' },
        JSON.stringify({ document: docId }),
      ]
      const results = []
      for (const body of bodies) {
        try {
          const res = await fetch('/edge/document/loadContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: typeof body === 'string' ? body : JSON.stringify(body),
          })
          const text = await res.text()
          results.push({
            body: typeof body === 'string' ? body : JSON.stringify(body),
            status: res.status,
            isJson: text.startsWith('{'),
            size: text.length,
            preview: text.slice(0, 500),
          })
        } catch (e) {
          results.push({ body: JSON.stringify(body), error: e.message })
        }
      }
      return results
    }, articleId)

    for (const r of directContent) {
      console.log(`\n  Body: ${r.body?.slice(0, 100)}`)
      console.log(`  Status: ${r.status}, JSON: ${r.isJson}, Size: ${r.size}`)
      if (r.isJson) console.log(`  Content: ${r.preview}`)
    }
  }

  // === 6. Test RAR too ===
  console.log('\n\n=== 6. RAR — artikelen uit laatste aflevering ===')
  const rarArticles = await page.evaluate(async () => {
    const nodeId = 'csh-da-filter!WKNL_CSL_124--WKNL_LTR_124#id-fb3efa8d27c41eeb0e59f82890e1f229'
    const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}`, {
      credentials: 'include'
    })
    return await res.json()
  })

  console.log(`RAR artikelen: ${rarArticles.totalHits}`)
  for (const item of (rarArticles.resultItems || []).slice(0, 3)) {
    console.log(`\n  ${item.title?.prefix} — ${item.title?.main?.slice(0, 100)}`)
    console.log(`    ECLI: ${item.metadata?.EcliNumber}`)
    console.log(`    Instantie: ${item.metadata?.CourtName}`)
    console.log(`    Datum: ${item.metadata?.RevisionDate}`)
    console.log(`    Abstract: ${item.metadata?.Abstract?.slice(0, 200)}`)
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
