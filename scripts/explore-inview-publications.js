/**
 * InView Publications Explorer — ontdek de TvA artikelen via de /edge/ API
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
  if (uf) {
    await uf.click({ clickCount: 3 }).catch(() => {})
    await uf.type(creds.email, { delay: 30 })
  }
  await new Promise(r => setTimeout(r, 500))

  // Click "Inloggen" button (type="button", first step)
  const btns = await page.$$('button.wk-login-submit')
  for (const btn of btns) {
    const type = await page.evaluate(el => el.type, btn)
    if (type === 'button') { await btn.click(); break }
  }
  await new Promise(r => setTimeout(r, 5000))

  let pw = await page.$('input[name="pf.pass"]')
  if (!pw) pw = await page.$('input[type="password"]')
  if (pw) {
    const vis = await page.evaluate(el => el.offsetParent !== null, pw)
    if (vis) {
      await pw.click({ clickCount: 3 }).catch(() => {})
      await pw.type(creds.password, { delay: 30 })
    }
  }
  await new Promise(r => setTimeout(r, 500))

  // Submit via KauriForm
  await page.evaluate(() => {
    const form = document.getElementById('KauriForm')
    if (form) {
      const ok = form.querySelector('input[name="$ok"]')
      if (ok) ok.value = 'clicked'
      form.submit()
    }
  })
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 5000))

  const url = page.url()
  return url.includes('inview.nl') && !url.includes('login') && !url.includes('wolterskluwer')
}

async function main() {
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { credentials: true }
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

  console.log('Inloggen...')
  const loggedIn = await login(page, creds)
  console.log('Ingelogd:', loggedIn)
  if (!loggedIn) { console.error('Login mislukt!'); await browser.close(); process.exit(1) }

  // === 1. GET PUBLICATIONS LIST ===
  console.log('\n=== 1. ALLE PUBLICATIES ===')
  const pubs = await page.evaluate(async () => {
    const res = await fetch('/edge/browse/publications', { credentials: 'include' })
    return await res.json()
  })
  console.log(`${pubs.publications?.length || 0} publicaties gevonden:`)
  for (const pub of (pubs.publications || [])) {
    console.log(`  [${pub.id}] ${pub.title} (module: ${pub.moduleId})`)
    if (pub.children?.length > 0) {
      for (const child of pub.children.slice(0, 5)) {
        console.log(`    - [${child.id}] ${child.title}`)
      }
    }
  }

  // === 2. ZOEK TvA SPECIFIEK ===
  console.log('\n=== 2. ZOEK Tijdschrift voor Arbeidsrecht ===')
  const tvaPublications = (pubs.publications || []).filter(p =>
    p.title.toLowerCase().includes('arbeid') || p.title.toLowerCase().includes('tva')
  )
  if (tvaPublications.length > 0) {
    console.log('Arbeidsrecht publicaties:')
    for (const p of tvaPublications) {
      console.log(`  [${p.id}] ${p.title}`)
      console.log(`    Module: ${p.moduleId}`)
      console.log(`    Children: ${p.children?.length || 0}`)
      console.log(`    Full data: ${JSON.stringify(p).slice(0, 500)}`)
    }
  } else {
    console.log('Geen directe TvA match in publicaties.')
    // Show all publication titles for debugging
    console.log('Alle titels:')
    for (const p of (pubs.publications || [])) {
      console.log(`  ${p.title}`)
    }
  }

  // === 3. PROBEER DE BROWSE/TOC API VOOR EEN PUBLICATIE ===
  console.log('\n=== 3. BROWSE/TOC API VOOR PUBLICATIES ===')
  const pubIds = (pubs.publications || [])
    .filter(p => p.title.toLowerCase().includes('arbeid') || p.title.toLowerCase().includes('rar'))
    .map(p => p.id)
    .slice(0, 3)

  // Also try the known TvA IDs
  const testIds = [...pubIds, 'WKNL_CSL_TvA', 'idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c']

  for (const id of testIds) {
    console.log(`\n  --- TOC voor ${id} ---`)
    const tocResult = await page.evaluate(async (pubId) => {
      const endpoints = [
        `/edge/toc/${pubId}`,
        `/edge/toc/tree/${pubId}`,
        `/edge/browse/publication/${pubId}`,
        `/edge/browse/publication/${pubId}/issues`,
        `/edge/browse/publication/${pubId}/editions`,
        `/edge/browse/publication/${pubId}/tree`,
      ]
      const results = {}
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { credentials: 'include' })
          const text = await res.text()
          const isJson = text.startsWith('{') || text.startsWith('[')
          results[ep] = { status: res.status, isJson, preview: text.slice(0, 500), size: text.length }
        } catch (e) {
          results[ep] = { error: e.message }
        }
      }
      return results
    }, id)

    for (const [ep, result] of Object.entries(tocResult)) {
      if (result.isJson) {
        console.log(`  ${ep} -> [${result.status}] JSON (${result.size} bytes): ${result.preview.slice(0, 300)}`)
      } else {
        console.log(`  ${ep} -> [${result.status}] HTML (${result.size} bytes)`)
      }
    }
  }

  // === 4. ZOEK IN LITERATUUR MET DE SEARCH API ===
  console.log('\n=== 4. SEARCH API — Literatuur filter ===')

  // The search showed "Literatuur (1.923)" — let's try that
  const searchTests = [
    { name: 'Alle literatuur', query: '', filterTreeIds: [], type: 'Literatuur' },
    { name: 'TvA zoek', query: 'arbeidsovereenkomst', filterTreeIds: [], sourceFilter: 'TvA' },
    { name: 'Ontslag in TvA', query: 'ontslag', filterTreeIds: [], sourceFilter: 'Tijdschrift voor Arbeidsrecht' },
  ]

  for (const test of searchTests) {
    console.log(`\n  --- ${test.name} ---`)
    const result = await page.evaluate(async (t) => {
      const scope = {
        query: t.query || "",
        filterTreeIds: t.filterTreeIds || [],
        dateRange: { from: "", until: "" },
        itemsPerPage: 10,
        sort: "date",
        fieldedSearchParams: {
          title: "",
          author: "",
          referenceInformation: {
            source: t.sourceFilter || "",
            year: "",
            number: ""
          },
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
          totalHits: data.totalHits,
          totalPaged: data.totalHitsPaged,
          resultCount: data.resultItems?.length || 0,
          firstItems: (data.resultItems || []).slice(0, 5).map(item => ({
            id: item.id || item.documentId,
            title: item.title?.slice(0, 100),
            type: item.type || item.documentType,
            source: item.source,
            date: item.date || item.publicationDate,
            keys: Object.keys(item).slice(0, 15),
            preview: JSON.stringify(item).slice(0, 300),
          })),
          annotations: (data.annotations || []).slice(0, 5).map(a => ({
            id: a.id, title: a.title, count: a.count || a.totalHits
          })),
        }
      } catch (e) {
        return { error: e.message }
      }
    }, test)

    console.log(`  Totaal: ${result.totalHits}`)
    console.log(`  Paginated: ${result.totalPaged}`)
    console.log(`  Resultaten: ${result.resultCount}`)
    if (result.annotations?.length > 0) {
      console.log(`  Annotations/filters:`)
      for (const a of result.annotations) console.log(`    [${a.id}] ${a.title}: ${a.count}`)
    }
    if (result.firstItems?.length > 0) {
      console.log(`  Eerste items:`)
      for (const item of result.firstItems) {
        console.log(`    ${item.title} (${item.type || 'type?'}, ${item.date || 'date?'})`)
        console.log(`    Keys: ${item.keys?.join(', ')}`)
        console.log(`    Data: ${item.preview}`)
      }
    }
  }

  // === 5. BROWSE UITGAVEN PAGINA ===
  console.log('\n=== 5. UITGAVEN PAGINA ===')
  await page.goto('https://www.inview.nl/uitgaven', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 8000))

  // Accept cookies
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button')
    for (const b of btns) {
      if ((b.textContent || '').toLowerCase().includes('accepteer alle')) { b.click(); return }
    }
  })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: 'iv3-uitgaven.png' })

  const uitgavenContent = await page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
      .filter(l => l.text.length > 3)
    return {
      textLength: text.length,
      textPreview: text.slice(0, 3000),
      links: links.slice(0, 50),
    }
  })
  console.log(`Text (${uitgavenContent.textLength} chars): ${uitgavenContent.textPreview.slice(0, 1000)}`)
  console.log(`\nLinks:`)
  for (const l of uitgavenContent.links.filter(l => l.href.includes('inview'))) {
    console.log(`  ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }

  // === 6. PROBEER EEN DOCUMENT OP TE HALEN ===
  console.log('\n=== 6. DOCUMENT API ===')
  // Try fetching a known document via the edge API
  const docTests = [
    '/edge/document/content/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c',
    '/edge/document/metadata/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c',
    '/edge/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c/content',
    '/edge/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c/metadata',
  ]
  for (const ep of docTests) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'include' })
        const text = await res.text()
        return { status: res.status, isJson: text.startsWith('{') || text.startsWith('['), size: text.length, preview: text.slice(0, 500) }
      } catch (e) {
        return { error: e.message }
      }
    }, ep)
    const isJson = result.isJson ? 'JSON' : 'HTML'
    console.log(`  ${ep} -> [${result.status}] ${isJson} (${result.size}b)`)
    if (result.isJson) console.log(`    ${result.preview?.slice(0, 300)}`)
  }

  // === 7. PROBEER DOCUMENT VIA TOC NAVIGATIE ===
  console.log('\n=== 7. TOC TREE NAVIGATIE ===')
  // The publications API returned IDs like WKNL_CSL_9. Try to browse those.
  const arbPubs = (pubs.publications || []).filter(p =>
    p.title.toLowerCase().includes('arbeid') || p.title.toLowerCase().includes('rar')
  )

  for (const pub of arbPubs.slice(0, 3)) {
    console.log(`\n  --- ${pub.title} (${pub.id}) ---`)
    const treeResult = await page.evaluate(async (pubId) => {
      const endpoints = [
        `/edge/toc/children/${pubId}`,
        `/edge/toc/children?parentId=${pubId}`,
        `/edge/browse/toc/${pubId}`,
        `/edge/browse/toc/${pubId}/children`,
        `/edge/browse/issues/${pubId}`,
        `/edge/browse/${pubId}/issues`,
      ]
      const results = {}
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { credentials: 'include' })
          const text = await res.text()
          results[ep] = { status: res.status, isJson: text.startsWith('{') || text.startsWith('['), size: text.length, preview: text.slice(0, 500) }
        } catch (e) {
          results[ep] = { error: e.message }
        }
      }
      return results
    }, pub.id)

    for (const [ep, r] of Object.entries(treeResult)) {
      if (r.isJson) {
        console.log(`  ${ep.split(pub.id).pop() || ep} -> [${r.status}] JSON (${r.size}b): ${r.preview?.slice(0, 300)}`)
      } else {
        console.log(`  ${ep.split(pub.id).pop() || ep} -> [${r.status}] (${r.size}b)`)
      }
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
