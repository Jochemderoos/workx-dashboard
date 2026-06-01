/**
 * Diagnose: InView TOC expansie — hoe komen we aan issue node IDs?
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

  // Capture ALL /edge/ responses
  const edgeResponses = []
  page.on('response', async res => {
    if (res.url().includes('/edge/document/')) {
      try {
        const text = await res.text()
        edgeResponses.push({
          url: res.url().replace('https://www.inview.nl', ''),
          status: res.status(),
          size: text.length,
          data: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null,
        })
      } catch {}
    }
  })

  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); process.exit(1) }
  console.log('Ingelogd!\n')

  // Navigate to ArbeidsRecht
  console.log('=== 1. Navigeer naar ArbeidsRecht publicatie ===')
  edgeResponses.length = 0
  await page.goto('https://www.inview.nl/publication/WKNL_CSL_9', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
  await new Promise(r => setTimeout(r, 3000))

  console.log(`\n${edgeResponses.length} /edge/document/ responses ontvangen:`)
  for (const resp of edgeResponses) {
    console.log(`  ${resp.url.slice(0, 120)} [${resp.status}] ${resp.size}b`)
  }

  // Find the loadToc response
  const tocResp = edgeResponses.find(r => r.url.includes('loadToc') && r.data)
  if (tocResp) {
    console.log('\n=== 2. loadToc response analyse ===')
    const d = tocResp.data
    console.log('Keys:', Object.keys(d))
    console.log('rootNodeId:', d.rootNodeId)
    console.log('currentNode.title:', d.currentNode?.title)
    console.log('currentNode.id:', d.currentNode?.id)

    // nodesRecord: flat map of all nodes
    if (d.nodesRecord) {
      const nodes = Object.values(d.nodesRecord)
      console.log(`\nnodesRecord: ${nodes.length} nodes`)
      for (const node of nodes.slice(0, 30)) {
        const childs = node.childIdentifiers?.length || 0
        console.log(`  [${node.id?.slice(0, 60)}] "${node.title}" hasChildren=${node.hasChildren} childs=${childs} type=${node.entity?.structureType || node.entity?.treeNodeType || '?'}`)
        if (childs > 0 && childs <= 5) {
          for (const childId of node.childIdentifiers) {
            const childNode = d.nodesRecord[childId]
            console.log(`    -> [${childId.slice(0, 60)}] "${childNode?.title}" childs=${childNode?.childIdentifiers?.length || 0}`)
          }
        }
      }
    }

    // ancestors
    if (d.ancestors?.length) {
      console.log('\nAncestors:')
      for (const a of d.ancestors) console.log(`  ${a.id} = "${a.title}"`)
    }
  }

  // === 3. Click 2025 year and capture the loadToc response ===
  console.log('\n\n=== 3. Klik op 2025 en capture response ===')
  edgeResponses.length = 0

  const clicked = await page.evaluate(() => {
    const allEls = document.querySelectorAll('span, a, button, div, li')
    for (const el of allEls) {
      const text = (el.textContent || '').trim()
      if (text === '2025' && el.children.length === 0) {
        console.log('Found 2025:', el.tagName, el.className)
        el.click()
        return { tag: el.tagName, cls: el.className, parent: el.parentElement?.tagName }
      }
    }
    return false
  })
  console.log('Clicked:', JSON.stringify(clicked))
  await new Promise(r => setTimeout(r, 5000))

  console.log(`\n${edgeResponses.length} nieuwe responses na klik:`)
  for (const resp of edgeResponses) {
    console.log(`  ${resp.url.slice(0, 120)} [${resp.status}] ${resp.size}b`)
  }

  const tocResp2 = edgeResponses.find(r => r.url.includes('loadToc') && r.data)
  if (tocResp2) {
    console.log('\nloadToc na 2025 klik:')
    const d = tocResp2.data
    if (d.nodesRecord) {
      const nodes = Object.values(d.nodesRecord)
      console.log(`nodesRecord: ${nodes.length} nodes`)
      // Find nodes with "2025" in title or with "Aflevering" in title
      for (const node of nodes) {
        if (node.title?.includes('2025') || node.title?.includes('Aflevering') || node.title?.includes('aflevering')) {
          const childs = node.childIdentifiers?.length || 0
          console.log(`  [${node.id?.slice(0, 80)}]`)
          console.log(`    title="${node.title}" hasChildren=${node.hasChildren} childs=${childs}`)
          console.log(`    entity=${JSON.stringify(node.entity || {}).slice(0, 200)}`)
          if (childs > 0) {
            for (const childId of node.childIdentifiers.slice(0, 5)) {
              const childNode = d.nodesRecord[childId]
              console.log(`    -> "${childNode?.title}" [${childId.slice(0, 60)}]`)
            }
          }
        }
      }
    }
  }

  // === 4. Check DOM for issue elements ===
  console.log('\n\n=== 4. DOM check na 2025 expand ===')
  const domInfo = await page.evaluate(() => {
    // Find elements containing "Aflevering"
    const results = []
    const allEls = document.querySelectorAll('*')
    for (const el of allEls) {
      const text = (el.textContent || '').trim()
      if (el.children.length === 0 && text.includes('Aflevering') && text.length < 100) {
        results.push({
          tag: el.tagName,
          text: text,
          href: el.href || el.closest('a')?.href || '',
          cls: el.className?.slice?.(0, 80) || '',
          dataId: el.getAttribute('data-id') || el.getAttribute('id') || '',
          parentTag: el.parentElement?.tagName || '',
          parentCls: el.parentElement?.className?.slice?.(0, 80) || '',
        })
      }
    }

    // Also find any links with /document/ in href
    const docLinks = []
    for (const a of document.querySelectorAll('a[href*="/document/"]')) {
      const text = (a.textContent || '').trim()
      if (text.length > 3 && text.length < 200) {
        docLinks.push({ href: a.href, text: text.slice(0, 100) })
      }
    }

    return { issueElements: results.slice(0, 20), docLinks: docLinks.slice(0, 20) }
  })

  console.log('Aflevering elementen:', domInfo.issueElements.length)
  for (const el of domInfo.issueElements) {
    console.log(`  <${el.tag} class="${el.cls}"> "${el.text}" href="${el.href}" data-id="${el.dataId}"`)
    console.log(`    parent: <${el.parentTag} class="${el.parentCls}">`)
  }

  console.log('\n/document/ links:', domInfo.docLinks.length)
  for (const l of domInfo.docLinks) {
    console.log(`  "${l.text.slice(0, 80)}" -> ${l.href}`)
  }

  // === 5. Try getJournalDocuments with root node ===
  console.log('\n\n=== 5. getJournalDocuments met verschillende nodeIds ===')
  const testNodeIds = [
    'csh-da-filter!WKNL_CSL_9',
    'csh-da-filter!WKNL_CSL_9--WKNL_LTR_9',
  ]

  // Add year node IDs from the TOC data if available
  if (tocResp?.data?.nodesRecord) {
    for (const node of Object.values(tocResp.data.nodesRecord)) {
      if (node.title === '2025' || node.title === '2024') {
        testNodeIds.push(node.id)
      }
    }
  }
  // Also from tocResp2
  if (tocResp2?.data?.nodesRecord) {
    for (const node of Object.values(tocResp2.data.nodesRecord)) {
      if (node.title?.includes('Aflevering')) {
        testNodeIds.push(node.id)
        break // just first one
      }
    }
  }

  for (const nodeId of testNodeIds) {
    const result = await page.evaluate(async (nId) => {
      try {
        const searchParams = { query: "*", filterTreeIds: [], itemsPerPage: 10, page: 1 }
        const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nId))}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ searchParams: JSON.stringify(searchParams) })
        })
        const text = await res.text()
        if (!text.startsWith('{')) return { nodeId: nId, error: 'Not JSON', status: res.status, preview: text.slice(0, 100) }
        const data = JSON.parse(text)
        return {
          nodeId: nId,
          total: data.totalHits || 0,
          items: (data.resultItems || []).slice(0, 2).map(i => i.title?.main?.slice(0, 60)),
          filterItems: data.filterItems?.map(f => f.title)?.slice(0, 5),
        }
      } catch (e) {
        return { nodeId: nId, error: e.message }
      }
    }, nodeId)
    console.log(`  ${result.nodeId.slice(0, 70)}:`)
    if (result.error) console.log(`    ERROR: ${result.error} (${result.status || ''})`)
    else {
      console.log(`    ${result.total} hits`)
      if (result.items?.length) console.log(`    Eerste: ${result.items.join(' | ')}`)
      if (result.filterItems?.length) console.log(`    Filters: ${result.filterItems.join(', ')}`)
    }
  }

  // === 6. Try search API ===
  console.log('\n\n=== 6. Search API test ===')
  const searchResult = await page.evaluate(async () => {
    const results = {}

    // Try /edge/search/search
    try {
      const res = await fetch('/edge/search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          searchTerm: '*',
          publicationIds: ['WKNL_CSL_9'],
          page: 1,
          itemsPerPage: 5,
        })
      })
      const text = await res.text()
      results.search1 = {
        status: res.status,
        isJson: text.startsWith('{') || text.startsWith('['),
        preview: text.slice(0, 500),
      }
    } catch (e) { results.search1 = { error: e.message } }

    // Try /edge/clustered-search/search
    try {
      const res = await fetch('/edge/clustered-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          searchTerm: 'arbeidsrecht',
          publicationIds: ['WKNL_CSL_9'],
          page: 1,
          itemsPerPage: 5,
        })
      })
      const text = await res.text()
      if (text.startsWith('{') || text.startsWith('[')) {
        const data = JSON.parse(text)
        results.search2 = {
          status: res.status,
          total: data.totalHits || data.total || data.resultCount || '?',
          keys: Object.keys(data),
          items: (data.resultItems || data.results || []).slice(0, 2).map(i => ({
            id: i.id,
            title: (i.title?.main || i.title || '').slice(0, 60),
            pub: i.metadata?.PublicationReference || '',
          })),
        }
      } else {
        results.search2 = { status: res.status, isJson: false, preview: text.slice(0, 200) }
      }
    } catch (e) { results.search2 = { error: e.message } }

    return results
  })

  for (const [name, r] of Object.entries(searchResult)) {
    console.log(`  ${name}: [${r.status}]`)
    if (r.error) console.log(`    ERROR: ${r.error}`)
    else if (r.total) {
      console.log(`    Total: ${r.total}`)
      console.log(`    Keys: ${r.keys?.join(', ')}`)
      if (r.items?.length) {
        for (const i of r.items) console.log(`    -> [${i.id?.slice(0, 30)}] "${i.title}" (${i.pub})`)
      }
    } else {
      console.log(`    ${r.isJson ? 'JSON' : 'HTML'}: ${r.preview?.slice(0, 300)}`)
    }
  }

  // === 7. Try expandTocNode / loadTocChildren endpoints ===
  console.log('\n\n=== 7. expandTocNode test ===')
  if (tocResp?.data?.nodesRecord) {
    // Find a year node
    const yearNode = Object.values(tocResp.data.nodesRecord).find(n => n.title === '2025')
    if (yearNode) {
      console.log(`Year node 2025: ${yearNode.id}`)

      const expandResult = await page.evaluate(async (nodeId, pubId) => {
        const endpoints = [
          { name: 'expandTocNode', url: `/edge/document/expandTocNode?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}&publication=${encodeURIComponent(JSON.stringify(pubId))}` },
          { name: 'loadTocChildren', url: `/edge/document/loadTocChildren?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}&publication=${encodeURIComponent(JSON.stringify(pubId))}` },
          { name: 'getTocChildren', url: `/edge/document/getTocChildren?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}&publication=${encodeURIComponent(JSON.stringify(pubId))}` },
        ]
        const results = {}
        for (const ep of endpoints) {
          try {
            // Try both GET and POST
            for (const method of ['GET', 'POST']) {
              const opts = { method, headers: { 'Accept': 'application/json' }, credentials: 'include' }
              if (method === 'POST') opts.headers['Content-Type'] = 'application/json'
              const res = await fetch(ep.url, opts)
              const text = await res.text()
              const key = `${ep.name}_${method}`
              if (text.startsWith('{') || text.startsWith('[')) {
                const data = JSON.parse(text)
                results[key] = {
                  status: res.status,
                  keys: Array.isArray(data) ? `array[${data.length}]` : Object.keys(data).join(','),
                  preview: JSON.stringify(data).slice(0, 500),
                }
              } else {
                results[key] = { status: res.status, isHtml: true, size: text.length }
              }
            }
          } catch (e) { results[ep.name] = { error: e.message } }
        }
        return results
      }, yearNode.id, 'WKNL_CSL_9')

      for (const [name, r] of Object.entries(expandResult)) {
        console.log(`  ${name}: [${r.status}]`)
        if (r.error) console.log(`    ERROR: ${r.error}`)
        else if (r.isHtml) console.log(`    HTML ${r.size}b`)
        else console.log(`    ${r.keys} — ${r.preview?.slice(0, 300)}`)
      }
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
