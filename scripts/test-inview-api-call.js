/**
 * Verificatie: InView API calls vanuit browser context met juiste headers
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

  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); process.exit(1) }
  console.log('Ingelogd!\n')

  // Navigate to publication page first (sets up cookies/session)
  await page.goto('https://www.inview.nl/publication/WKNL_CSL_9', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
  await new Promise(r => setTimeout(r, 5000))

  // === TEST 1: loadToc API with Accept: application/json ===
  console.log('=== 1. loadToc met Accept: application/json ===')
  const tocResult = await page.evaluate(async () => {
    const pub = encodeURIComponent('"WKNL_CSL_9"')
    const doc = encodeURIComponent('"id-f4f2f3ddd40c8f10ee1615d6ba5fd915"')
    const path = JSON.stringify([{
      id: "csh-da-filter!WKNL_CSL_9",
      entity: { documentId: null, structureType: "folder", stiType: "unknown" },
      checkable: true, checked: 0,
      title: "ArbeidsRecht. Maandblad voor de praktijk",
      hasChildren: true, expanded: false, modelDocumentId: null
    }])

    const res = await fetch(`/edge/document/loadToc?publication=${pub}&document=${doc}&shouldUseModelDocumentId=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: JSON.stringify(JSON.parse(path)) })
    })
    const text = await res.text()
    if (!text.startsWith('{')) return { error: 'Not JSON', status: res.status, preview: text.slice(0, 200) }
    const data = JSON.parse(text)
    // Extract year nodes from the tree
    const extractNodes = (node, depth = 0) => {
      const result = { id: node.id, title: node.title, hasChildren: node.hasChildren, depth }
      if (node.children?.length) result.childCount = node.children.length
      if (node.children?.length && depth < 2) {
        result.children = node.children.map(c => extractNodes(c, depth + 1))
      }
      return result
    }
    return {
      rootNode: data.rootNodeId,
      currentTitle: data.currentNode?.title,
      tree: data.currentNode ? extractNodes(data.currentNode) : null,
      // Also check if ancestors/siblings have children info
      fullDataKeys: Object.keys(data),
      ancestors: data.ancestors?.map(a => ({ id: a.id, title: a.title })),
    }
  })
  console.log('Root:', tocResult.rootNode)
  console.log('Keys:', tocResult.fullDataKeys)
  console.log('Tree:', JSON.stringify(tocResult.tree, null, 2)?.slice(0, 2000))

  // === TEST 2: loadContent API ===
  console.log('\n\n=== 2. loadContent van een artikel ===')
  const contentResult = await page.evaluate(async () => {
    const params = {
      documentId: "idc6ad59e5bb0d42f2b1425789fda7a720",
      renderOptions: {
        isLawDocument: false,
        renderRelatedTabs: false,
        isSTIView: false,
        isExpandableFragmentsEnabled: false,
        renderAnnotations: true,
        isFreemiumUser: false,
        publicationId: ""
      },
      searchId: null,
      searchTerm: "",
      shouldHidePdfLink: false,
      skipGetHighlights: false,
    }
    const res = await fetch('/edge/document/loadContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ params: JSON.stringify(params) })
    })
    const text = await res.text()
    if (!text.startsWith('{')) return { error: 'Not JSON', status: res.status, preview: text.slice(0, 200) }
    const data = JSON.parse(text)
    // Strip HTML from content to get plain text
    const div = document.createElement('div')
    div.innerHTML = data.content || ''
    const plainText = div.textContent?.replace(/\s+/g, ' ').trim() || ''
    return {
      title: data.title,
      contentSize: (data.content || '').length,
      plainTextSize: plainText.length,
      plainTextPreview: plainText.slice(0, 1000),
      keys: Object.keys(data),
    }
  })
  console.log('Titel:', contentResult.title)
  console.log('HTML content:', contentResult.contentSize, 'tekens')
  console.log('Plain text:', contentResult.plainTextSize, 'tekens')
  console.log('Keys:', contentResult.keys)
  console.log('Preview:', contentResult.plainTextPreview?.slice(0, 500))

  // === TEST 3: getJournalDocuments voor meerdere afleveringen ===
  console.log('\n\n=== 3. getJournalDocuments — artikellijsten ophalen ===')

  // First: get TOC to find all year nodes and issue nodes
  // For now, let's extract them from the rendered page
  const tocLinks = await page.evaluate(() => {
    // The page rendered shows all years: 2026, 2025, ..., 1994
    // And for the current year shows issues
    // Let's try to get the loadToc data that has the full tree
    const text = (document.body.innerText || '')
    // Extract year numbers
    const years = []
    for (let y = 2026; y >= 1994; y--) {
      if (text.includes(String(y))) years.push(y)
    }
    return { years }
  })
  console.log('Beschikbare jaargangen:', tocLinks.years.join(', '))

  // Try getting the full tree from loadToc
  const fullTree = await page.evaluate(async () => {
    const pub = encodeURIComponent('"WKNL_CSL_9"')
    const doc = encodeURIComponent('"id-f4f2f3ddd40c8f10ee1615d6ba5fd915"')
    const pathData = [{
      id: "csh-da-filter!WKNL_CSL_9",
      entity: { documentId: null, structureType: "folder", stiType: "unknown" },
      checkable: true, checked: 0,
      title: "ArbeidsRecht. Maandblad voor de praktijk",
      hasChildren: true, expanded: false, modelDocumentId: null
    }]

    const res = await fetch(`/edge/document/loadToc?publication=${pub}&document=${doc}&shouldUseModelDocumentId=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: JSON.stringify(pathData) })
    })
    const data = await res.json()

    // The tree might have yearNodes and issueNodes
    // Let's extract the whole structure recursively
    const extractAll = (node, result = [], depth = 0) => {
      if (!node) return result
      result.push({
        id: node.id,
        title: node.title,
        hasChildren: node.hasChildren,
        docId: node.entity?.documentId,
        type: node.entity?.treeNodeType || node.entity?.structureType,
        depth,
      })
      if (node.children) {
        for (const child of node.children) {
          extractAll(child, result, depth + 1)
        }
      }
      return result
    }

    // Check if the tree data includes siblings (which would have the year nodes)
    const nodes = extractAll(data.currentNode)

    // Also check rootChildren if available
    let rootSiblings = []
    if (data.currentNode?.parentId) {
      // The parent might have siblings info
    }

    return {
      allNodes: nodes.slice(0, 50),
      dataSnapshot: JSON.stringify(data).slice(0, 3000),
    }
  })

  console.log('\nTree nodes:', JSON.stringify(fullTree.allNodes, null, 2)?.slice(0, 2000))
  console.log('\nData snapshot:', fullTree.dataSnapshot?.slice(0, 1000))

  // === TEST 4: Try calling getJournalDocuments for latest issue ===
  console.log('\n\n=== 4. Alle artikelen in een issue ophalen ===')
  const journalDocs = await page.evaluate(async () => {
    const nodeId = 'csh-da-filter!WKNL_CSL_9--WKNL_LTR_9#id-f4f2f3ddd40c8f10ee1615d6ba5fd915'
    const searchParams = { query: "*", filterTreeIds: [], itemsPerPage: 100, page: 1 }
    const res = await fetch(`/edge/document/getJournalDocuments?nodeId=${encodeURIComponent(JSON.stringify(nodeId))}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ searchParams: JSON.stringify(searchParams) })
    })
    return await res.json()
  })

  console.log(`Artikelen in issue: ${journalDocs.totalHits}`)
  for (const item of (journalDocs.resultItems || [])) {
    console.log(`\n  ${item.title?.prefix}: ${item.title?.main?.slice(0, 80)}`)
    console.log(`    ID: ${item.id}`)
    console.log(`    Metadata keys: ${Object.keys(item.metadata || {})}`)
    console.log(`    Full metadata: ${JSON.stringify(item.metadata).slice(0, 300)}`)
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
