/**
 * InView Articles Explorer — haal artikelen op uit ArbeidsRecht en RAR
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

async function acceptCookies(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button')
    for (const b of btns) { if ((b.textContent || '').toLowerCase().includes('accepteer alle')) { b.click(); return } }
  })
  await new Promise(r => setTimeout(r, 2000))
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

  // Intercept API calls
  const apiResponses = []
  page.on('response', async (resp) => {
    const url = resp.url()
    if (url.includes('/edge/') && !url.includes('google') && !url.includes('pendo')) {
      try {
        const text = await resp.text()
        if (text.startsWith('{') || text.startsWith('[')) {
          apiResponses.push({ url: url.slice(0, 200), data: text.slice(0, 2000) })
        }
      } catch {}
    }
  })

  console.log('Inloggen...')
  const loggedIn = await login(page, creds)
  console.log('Ingelogd:', loggedIn)
  if (!loggedIn) { await browser.close(); process.exit(1) }

  // === 1. Navigate to ArbeidsRecht publication ===
  console.log('\n=== 1. ArbeidsRecht. Maandblad voor de praktijk ===')
  apiResponses.length = 0

  await page.goto('https://www.inview.nl/publication/WKNL_CSL_9', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await acceptCookies(page)
  await new Promise(r => setTimeout(r, 5000))
  await page.screenshot({ path: 'iv-arbeidsrecht-pub.png' })

  const arbContent = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
      .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
    return {
      textLength: text.length,
      textPreview: text.slice(0, 3000),
      links: links.slice(0, 50),
      docLinks: links.filter(l => l.href.includes('/document/')).slice(0, 30),
      pubLinks: links.filter(l => l.href.includes('/publication/')).slice(0, 10),
    }
  })

  console.log(`Text (${arbContent.textLength} chars): ${arbContent.textPreview.slice(0, 1000)}`)
  if (arbContent.docLinks.length > 0) {
    console.log(`\nDocument links (${arbContent.docLinks.length}):`)
    for (const l of arbContent.docLinks.slice(0, 15)) console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }
  if (arbContent.pubLinks.length > 0) {
    console.log(`\nPublication links:`)
    for (const l of arbContent.pubLinks) console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }

  // Print intercepted API calls
  console.log('\nIntercepted API calls:')
  for (const r of apiResponses) {
    console.log(`  ${r.url}`)
    console.log(`    ${r.data.slice(0, 500)}`)
  }

  // === 2. Navigate to RAR publication ===
  console.log('\n\n=== 2. Rechtspraak Arbeidsrecht (RAR) ===')
  apiResponses.length = 0

  await page.goto('https://www.inview.nl/publication/WKNL_CSL_124', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await acceptCookies(page)
  await new Promise(r => setTimeout(r, 5000))
  await page.screenshot({ path: 'iv-rar-pub.png' })

  const rarContent = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
      .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
    return {
      textLength: text.length,
      textPreview: text.slice(0, 3000),
      docLinks: links.filter(l => l.href.includes('/document/')).slice(0, 30),
    }
  })

  console.log(`Text (${rarContent.textLength} chars): ${rarContent.textPreview.slice(0, 1000)}`)
  if (rarContent.docLinks.length > 0) {
    console.log(`\nDocument links (${rarContent.docLinks.length}):`)
    for (const l of rarContent.docLinks.slice(0, 15)) console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }

  console.log('\nIntercepted API calls:')
  for (const r of apiResponses) {
    console.log(`  ${r.url}`)
    console.log(`    ${r.data.slice(0, 500)}`)
  }

  // === 3. Try the search API with source filters ===
  console.log('\n\n=== 3. SEARCH API met publicatie-filters ===')

  const searchTests = [
    { name: 'ArbeidsRecht artikelen', source: 'ArbeidsRecht' },
    { name: 'ArbeidsRecht (volledig)', source: 'ArbeidsRecht. Maandblad voor de praktijk' },
    { name: 'RAR artikelen', source: 'Rechtspraak Arbeidsrecht' },
    { name: 'RAR (kort)', source: 'RAR' },
  ]

  for (const test of searchTests) {
    const result = await page.evaluate(async (sourceName) => {
      const scope = {
        query: "",
        filterTreeIds: [],
        dateRange: { from: "", until: "" },
        itemsPerPage: 10,
        sort: "date",
        fieldedSearchParams: {
          title: "",
          author: "",
          referenceInformation: { source: sourceName, year: "", number: "" },
          ecli: "",
          caseNumber: ""
        }
      }
      try {
        const res = await fetch('/edge/search/search?retrieveItems=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scope: JSON.stringify(scope) })
        })
        const data = await res.json()
        return {
          total: data.totalHits,
          items: (data.resultItems || []).slice(0, 3).map(i => JSON.stringify(i).slice(0, 300)),
          annotations: (data.annotations || []).slice(0, 5).map(a => `${a.title}: ${a.count || a.totalHits}`)
        }
      } catch (e) { return { error: e.message } }
    }, test.source)
    console.log(`\n${test.name} (source="${test.source}"): ${result.total || 0} hits`)
    if (result.annotations?.length > 0) {
      console.log('  Annotations:', result.annotations)
    }
    if (result.items?.length > 0) {
      for (const item of result.items) console.log(`  ${item}`)
    }
  }

  // === 4. Try clustered search for our publications ===
  console.log('\n\n=== 4. CLUSTERED SEARCH met filterTreeIds ===')
  const clusterResult = await page.evaluate(async () => {
    // First try without filters to see what annotations/clusters come back
    const scope = {
      query: "ontslag",
      filterTreeIds: [],
      dateRange: { from: "", until: "" },
      itemsPerPage: 10,
      sort: "date",
      itemsPerCluster: 3,
      fieldedSearchParams: {
        title: "",
        author: "",
        referenceInformation: { source: "", year: "", number: "" },
        ecli: "",
        caseNumber: ""
      }
    }
    const res = await fetch('/edge/clustered-search/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scope: JSON.stringify(scope) })
    })
    const data = await res.json()
    return {
      total: data.totalHits,
      itemCount: data.resultItems?.length || 0,
      firstItems: (data.resultItems || []).slice(0, 5).map(i => ({
        id: i.id || i.documentId,
        title: (i.title || '').slice(0, 100),
        keys: Object.keys(i),
        full: JSON.stringify(i).slice(0, 500)
      })),
      clusters: data.clusters ? Object.entries(data.clusters).map(([k, v]) => ({
        name: k,
        items: Array.isArray(v) ? v.slice(0, 3).map(i => `${i.title || i.id}`) : JSON.stringify(v).slice(0, 200)
      })) : [],
      annotations: (data.annotations || []).slice(0, 10).map(a => ({
        id: a.id, title: a.title, count: a.count, totalHits: a.totalHits, children: a.children?.slice(0, 5)?.map(c => `${c.title}: ${c.count}`)
      })),
    }
  })

  console.log(`Totaal: ${clusterResult.total}`)
  console.log(`Items: ${clusterResult.itemCount}`)
  if (clusterResult.firstItems?.length > 0) {
    console.log('\nEerste items:')
    for (const item of clusterResult.firstItems) {
      console.log(`  ${item.title}`)
      console.log(`    Keys: ${item.keys?.join(', ')}`)
      console.log(`    Data: ${item.full}`)
    }
  }
  if (clusterResult.annotations?.length > 0) {
    console.log('\nAnnotations/Facets:')
    for (const a of clusterResult.annotations) {
      console.log(`  [${a.id}] ${a.title}: ${a.count || a.totalHits}`)
      if (a.children?.length > 0) {
        for (const c of a.children) console.log(`    - ${c}`)
      }
    }
  }
  if (clusterResult.clusters?.length > 0) {
    console.log('\nClusters:')
    for (const c of clusterResult.clusters) {
      console.log(`  ${c.name}: ${JSON.stringify(c.items).slice(0, 200)}`)
    }
  }

  // === 5. Open een specifiek artikel als we er een vinden ===
  if (clusterResult.firstItems?.length > 0) {
    console.log('\n\n=== 5. ARTIKEL CONTENT OPHALEN ===')
    const firstItem = clusterResult.firstItems[0]

    // Try to get document content via API
    const docId = firstItem.id
    if (docId) {
      console.log(`Document ID: ${docId}`)

      // Try various endpoints
      const docEndpoints = await page.evaluate(async (id) => {
        const results = {}
        const eps = [
          `/edge/document/${id}`,
          `/edge/document/content/${id}`,
          `/edge/documents/${id}`,
          `/edge/documents/content/${id}`,
          `/edge/content/${id}`,
        ]
        for (const ep of eps) {
          try {
            const res = await fetch(ep, { credentials: 'include' })
            const text = await res.text()
            results[ep] = { status: res.status, isJson: text.startsWith('{') || text.startsWith('['), size: text.length, preview: text.slice(0, 500) }
          } catch (e) { results[ep] = { error: e.message } }
        }
        return results
      }, docId)

      for (const [ep, r] of Object.entries(docEndpoints)) {
        console.log(`  ${ep} -> [${r.status}] ${r.isJson ? 'JSON' : 'HTML'} (${r.size}b)`)
        if (r.isJson) console.log(`    ${r.preview?.slice(0, 300)}`)
      }

      // Try navigating to the document page
      console.log(`\n  Navigeren naar document pagina...`)
      await page.goto(`https://www.inview.nl/document/${docId}`, { waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 8000))
      await acceptCookies(page)
      await new Promise(r => setTimeout(r, 3000))
      await page.screenshot({ path: 'iv-article.png' })

      const articleContent = await page.evaluate(() => {
        const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
        return {
          title: document.title,
          textLength: text.length,
          textPreview: text.slice(0, 3000),
        }
      })
      console.log(`  Titel: ${articleContent.title}`)
      console.log(`  Text (${articleContent.textLength} chars): ${articleContent.textPreview.slice(0, 1000)}`)
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
