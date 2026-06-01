/**
 * Verken InView API — zoek naar Tijdschrift voor Arbeidsrecht artikelen
 * Focus op de /edge/ search API die we ontdekt hebben
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const puppeteer = require('puppeteer-core')

async function main() {
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { id: true, name: true, url: true, credentials: true }
  })
  const creds = JSON.parse(inviewSource.credentials)

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // === LOGIN ===
  console.log('Inloggen...')
  const ssoUrl = `https://www.inview.nl/.sso/login?redirect_uri=${encodeURIComponent('https://www.inview.nl/')}`
  await page.goto(ssoUrl, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  // Cookie banner op login pagina
  const btns = await page.$$('button, a')
  for (const btn of btns) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('alle cookies') || t.includes('accept all')) {
      await btn.click(); await new Promise(r => setTimeout(r, 1500)); break
    }
  }

  let uf = await page.$('input[name="pf.username"]')
  if (!uf) uf = await page.$('input[type="email"]')
  if (uf) {
    await uf.click({ clickCount: 3 }).catch(() => {})
    await uf.type(creds.email, { delay: 30 })
  }
  await new Promise(r => setTimeout(r, 500))

  let s1 = await page.$('button.wk-login-submit[type="button"]')
  if (s1) await s1.click()
  await new Promise(r => setTimeout(r, 4000))

  let pw = await page.$('input[name="pf.pass"]')
  if (!pw) pw = await page.$('input[type="password"]')
  if (pw) {
    await pw.click({ clickCount: 3 }).catch(() => {})
    await pw.type(creds.password, { delay: 30 })
  }
  await new Promise(r => setTimeout(r, 500))

  let sb = await page.$('button.wk-login-submit[type="submit"]')
  if (!sb) sb = await page.$('button[type="submit"]')
  if (sb) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      sb.click()
    ])
  }
  await new Promise(r => setTimeout(r, 5000))
  console.log('Na login:', page.url().slice(0, 80))

  // Cookie banner na login
  const btns2 = await page.$$('button, a')
  for (const btn of btns2) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('alle cookies')) {
      await btn.click(); await new Promise(r => setTimeout(r, 1500)); break
    }
  }

  // Wait for SPA to fully load
  await new Promise(r => setTimeout(r, 3000))

  // === TEST 1: Direct search API call from browser context ===
  console.log('\n=== TEST 1: Search API — alle TvA artikelen ===')

  const test1 = await page.evaluate(async () => {
    // First, try to find filterTreeIds for Tijdschrift voor Arbeidsrecht
    // Try the clustered search with a query
    const scope = {
      query: "*",
      filterTreeIds: [],
      dateRange: { from: "", until: "" },
      itemsPerPage: 25,
      sort: "date",
      itemsPerCluster: 3,
      fieldedSearchParams: {
        title: "",
        author: "",
        referenceInformation: { source: "Tijdschrift voor Arbeidsrecht", year: "", number: "" },
        ecli: "",
        caseNumber: ""
      }
    }
    try {
      const res = await fetch('/edge/clustered-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope: JSON.stringify(scope) })
      })
      const data = await res.json()
      return { status: res.status, data: JSON.stringify(data).slice(0, 3000) }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('Clustered search:', test1.data?.slice(0, 1500) || test1.error)

  // === TEST 2: Non-clustered search ===
  console.log('\n=== TEST 2: Direct search API ===')
  const test2 = await page.evaluate(async () => {
    const scope = {
      query: "arbeidsovereenkomst",
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
    try {
      const res = await fetch('/edge/search/search?retrieveItems=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope: JSON.stringify(scope) })
      })
      const data = await res.json()
      return { status: res.status, keys: Object.keys(data), total: data.totalResults || data.total || data.count, data: JSON.stringify(data).slice(0, 3000) }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('Total:', test2.total)
  console.log('Keys:', test2.keys)
  console.log('Data:', test2.data?.slice(0, 2000) || test2.error)

  // === TEST 3: Try /edge/search/search met TvA filter ===
  console.log('\n=== TEST 3: Search met TvA bron-filter ===')
  const test3 = await page.evaluate(async () => {
    const scope = {
      query: "",
      filterTreeIds: [],
      dateRange: { from: "", until: "" },
      itemsPerPage: 10,
      sort: "date",
      itemsPerCluster: 3,
      fieldedSearchParams: {
        title: "",
        author: "",
        referenceInformation: { source: "TvA", year: "", number: "" },
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
      return { status: res.status, data: JSON.stringify(await res.json()).slice(0, 3000) }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('TvA search:', test3.data?.slice(0, 2000) || test3.error)

  // === TEST 4: Navigate to uitgaven page and look for content ===
  console.log('\n=== TEST 4: Uitgaven pagina ===')
  await page.goto('https://www.inview.nl/uitgaven', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 5000))

  // Accept cookies if needed
  const btns3 = await page.$$('button')
  for (const btn of btns3) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('alle cookies')) {
      await btn.click(); await new Promise(r => setTimeout(r, 2000)); break
    }
  }
  await new Promise(r => setTimeout(r, 3000))

  await page.screenshot({ path: 'inview-uitgaven.png' })

  const uitgavenInfo = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
      .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
    return {
      textLength: text.length,
      textPreview: text.slice(0, 2000),
      links: links.slice(0, 40),
      documentLinks: links.filter(l => l.href.includes('/document/')),
    }
  })
  console.log(`Text lengte: ${uitgavenInfo.textLength}`)
  console.log(`Text: ${uitgavenInfo.textPreview.slice(0, 500)}`)
  console.log(`\nLinks (${uitgavenInfo.links.length}):`)
  for (const l of uitgavenInfo.links.slice(0, 20)) {
    console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }
  if (uitgavenInfo.documentLinks.length > 0) {
    console.log(`\nDocument links (${uitgavenInfo.documentLinks.length}):`)
    for (const l of uitgavenInfo.documentLinks.slice(0, 10)) {
      console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
    }
  }

  // === TEST 5: Try navigating to a specific TvA issue from InView ===
  console.log('\n=== TEST 5: TvA zoekpagina ===')
  await page.goto('https://www.inview.nl/zoeken', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 5000))

  // Accept cookies
  const btns4 = await page.$$('button')
  for (const btn of btns4) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('alle cookies')) {
      await btn.click(); await new Promise(r => setTimeout(r, 2000)); break
    }
  }
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: 'inview-zoeken.png' })

  const zoekInfo = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    // Look for filter/facet elements
    const filterEls = document.querySelectorAll('[class*="filter"], [class*="facet"], [class*="refine"], select, [class*="checkbox"]')
    const filters = Array.from(filterEls).map(el => ({
      tag: el.tagName,
      class: el.className?.toString().slice(0, 80),
      text: (el.textContent || '').trim().slice(0, 200),
    }))
    // Look for search input
    const searchInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[name*="query"], input[placeholder*="zoek"]'))
      .map(i => ({ name: i.name, placeholder: i.placeholder, type: i.type }))
    return {
      textPreview: text.slice(0, 1500),
      filters: filters.slice(0, 10),
      searchInputs,
    }
  })
  console.log(`Text: ${zoekInfo.textPreview.slice(0, 500)}`)
  if (zoekInfo.searchInputs.length > 0) {
    console.log('Search inputs:', JSON.stringify(zoekInfo.searchInputs))
  }
  if (zoekInfo.filters.length > 0) {
    console.log('Filters:')
    for (const f of zoekInfo.filters.slice(0, 5)) {
      console.log(`  <${f.tag}> class="${f.class}" : ${f.text.slice(0, 100)}`)
    }
  }

  // === TEST 6: Use page.evaluate to explore what JS variables are available ===
  console.log('\n=== TEST 6: JS context verkennen ===')
  const jsInfo = await page.evaluate(() => {
    // Check for common SPA state stores
    const info = {}
    if (window.__NEXT_DATA__) info.nextData = JSON.stringify(window.__NEXT_DATA__).slice(0, 500)
    if (window.__NUXT__) info.nuxt = 'found'
    if (window.__INITIAL_STATE__) info.initialState = JSON.stringify(window.__INITIAL_STATE__).slice(0, 500)
    if (window.Backbone) info.backbone = 'found'
    if (window.angular) info.angular = 'found'
    if (window.React) info.react = 'found'
    if (window.Vue) info.vue = 'found'
    if (window.__APP_CONFIG__) info.appConfig = JSON.stringify(window.__APP_CONFIG__).slice(0, 500)

    // Check meta tags for API info
    const metas = Array.from(document.querySelectorAll('meta')).map(m => ({
      name: m.name || m.getAttribute('property'),
      content: (m.content || '').slice(0, 200),
    })).filter(m => m.name)

    // Check for service worker / API base URLs in scripts
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src).slice(0, 10)

    return { info, metas: metas.slice(0, 15), scripts }
  })
  console.log('JS frameworks:', JSON.stringify(jsInfo.info))
  console.log('Meta tags:', JSON.stringify(jsInfo.metas.slice(0, 5)))
  console.log('Scripts:', jsInfo.scripts.slice(0, 5))

  // === TEST 7: Try the /edge/ API with different endpoints ===
  console.log('\n=== TEST 7: Edge API endpoints verkennen ===')
  const endpoints = [
    { url: '/edge/toc/tijdschrift-voor-arbeidsrecht', method: 'GET' },
    { url: '/edge/toc/tree/tijdschrift-voor-arbeidsrecht', method: 'GET' },
    { url: '/edge/publication/tijdschrift-voor-arbeidsrecht', method: 'GET' },
    { url: '/edge/publication/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c', method: 'GET' },
    { url: '/edge/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c', method: 'GET' },
    { url: '/edge/editions/tijdschrift-voor-arbeidsrecht', method: 'GET' },
    { url: '/edge/issues/tijdschrift-voor-arbeidsrecht', method: 'GET' },
    { url: '/edge/content/tijdschrift-voor-arbeidsrecht', method: 'GET' },
  ]

  for (const ep of endpoints) {
    const result = await page.evaluate(async (url, method) => {
      try {
        const res = await fetch(url, { method, credentials: 'include' })
        const text = await res.text()
        return { status: res.status, size: text.length, preview: text.slice(0, 500) }
      } catch (e) {
        return { error: e.message }
      }
    }, ep.url, ep.method)
    const status = result.error ? 'ERROR' : result.status
    console.log(`  ${ep.method} ${ep.url} -> ${status} (${result.size || 0} bytes)`)
    if (result.status === 200 && result.size > 10) {
      console.log(`    ${result.preview.slice(0, 200)}`)
    }
  }

  // === TEST 8: Intercept XHR on search page action ===
  console.log('\n=== TEST 8: Zoek "ontslag" via de UI ===')
  await page.goto('https://www.inview.nl/zoeken', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 5000))

  // Accept cookies
  const btns5 = await page.$$('button')
  for (const btn of btns5) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('alle cookies')) {
      await btn.click(); await new Promise(r => setTimeout(r, 3000)); break
    }
  }
  await new Promise(r => setTimeout(r, 3000))

  // Try typing in search
  const searchInput = await page.$('input[type="text"], input[type="search"], input[placeholder*="oek"]')
  if (searchInput) {
    console.log('  Zoekbalk gevonden, typ "ontslag"...')
    await searchInput.type('ontslag', { delay: 50 })
    await new Promise(r => setTimeout(r, 1000))

    // Press enter or click search
    await page.keyboard.press('Enter')
    await new Promise(r => setTimeout(r, 5000))

    const searchResult = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      const countMatch = text.match(/(\d+[\.\d]*)\s*(resultaten|resultaat|items|treffer)/i)
      const links = Array.from(document.querySelectorAll('a[href*="/document/"]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
        .filter(l => l.text.length > 5)
      return {
        count: countMatch?.[0],
        resultLinks: links.slice(0, 10),
        textPreview: text.slice(0, 1000),
      }
    })
    if (searchResult.count) console.log(`  Resultaten: ${searchResult.count}`)
    console.log(`  Document links: ${searchResult.resultLinks.length}`)
    for (const l of searchResult.resultLinks.slice(0, 5)) {
      console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 80)}`)
    }
    console.log(`  Text: ${searchResult.textPreview.slice(0, 500)}`)
    await page.screenshot({ path: 'inview-search-ontslag.png' })
  } else {
    console.log('  Geen zoekbalk gevonden')
    // List all inputs
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input'))
        .map(i => ({ type: i.type, name: i.name, placeholder: i.placeholder, id: i.id, class: i.className?.slice(0, 50) }))
    })
    console.log('  Inputs:', JSON.stringify(inputs))
  }

  // === TEST 9: Try opening a known document URL ===
  console.log('\n=== TEST 9: Bekende document URLs testen ===')
  const docUrls = [
    'https://www.inview.nl/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c',
    'https://www.inview.nl/document/id6c72ee8e-3714-42c3-9728-6f11af23e0de',
  ]
  for (const dUrl of docUrls) {
    console.log(`\n  ${dUrl.split('/').pop()}`)
    await page.goto(dUrl, { waitUntil: 'networkidle2', timeout: 15000 })
    await new Promise(r => setTimeout(r, 5000))

    // Accept cookies
    const cbtns = await page.$$('button')
    for (const btn of cbtns) {
      const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
      if (t.includes('accepteer') || t.includes('alle cookies')) {
        await btn.click(); await new Promise(r => setTimeout(r, 2000)); break
      }
    }
    await new Promise(r => setTimeout(r, 3000))

    const docInfo = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
        .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
      return {
        title: document.title,
        url: window.location.href,
        textLength: text.length,
        textPreview: text.slice(0, 2000),
        links: links.slice(0, 30),
        docLinks: links.filter(l => l.href.includes('/document/')),
      }
    })
    console.log(`  Titel: ${docInfo.title}`)
    console.log(`  Text (${docInfo.textLength} chars): ${docInfo.textPreview.slice(0, 500)}`)
    if (docInfo.docLinks.length > 0) {
      console.log(`  Document links (${docInfo.docLinks.length}):`)
      for (const l of docInfo.docLinks.slice(0, 15)) {
        console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
      }
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
