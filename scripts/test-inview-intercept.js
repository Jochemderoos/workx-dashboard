/**
 * InView — intercept API calls om het exacte request formaat te leren
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

  // Intercept ALL /edge/ requests with full details
  const edgeRequests = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.includes('/edge/document/')) {
      edgeRequests.push({
        method: req.method(),
        url: url,
        headers: req.headers(),
        postData: req.postData(),
      })
    }
    req.continue()
  })

  console.log('Inloggen...')
  if (!await login(page, creds)) { console.error('Login mislukt!'); process.exit(1) }
  console.log('Ingelogd!\n')

  // Navigate to ArbeidsRecht publication to trigger API calls
  console.log('=== Navigeren naar ArbeidsRecht publicatie ===')
  edgeRequests.length = 0

  await page.goto('https://www.inview.nl/publication/WKNL_CSL_9', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  // Accept cookies
  await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
  await new Promise(r => setTimeout(r, 5000))

  console.log(`\n${edgeRequests.length} /edge/document/ requests gevonden:\n`)
  for (const req of edgeRequests) {
    console.log(`  ${req.method} ${req.url.slice(0, 150)}`)
    // Show relevant headers
    const contentType = req.headers['content-type']
    const accept = req.headers['accept']
    if (contentType) console.log(`    Content-Type: ${contentType}`)
    if (accept) console.log(`    Accept: ${accept}`)
    if (req.postData) console.log(`    Body: ${req.postData.slice(0, 500)}`)
    console.log('')
  }

  // Now click on 2025 year to trigger more API calls
  console.log('\n=== Klik op 2025 jaargang ===')
  edgeRequests.length = 0

  // Find the 2025 link in the TOC
  const clicked = await page.evaluate(() => {
    const links = document.querySelectorAll('a, button, [role="treeitem"], [class*="toc"] *')
    for (const el of links) {
      const text = (el.textContent || '').trim()
      if (text === '2025') {
        el.click()
        return true
      }
    }
    // Try finding it differently
    const allEls = document.querySelectorAll('*')
    for (const el of allEls) {
      if (el.children.length === 0 && (el.textContent || '').trim() === '2025') {
        el.click()
        return 'clicked leaf: ' + el.tagName
      }
    }
    return false
  })
  console.log('Clicked 2025:', clicked)
  await new Promise(r => setTimeout(r, 5000))

  console.log(`\n${edgeRequests.length} nieuwe requests:\n`)
  for (const req of edgeRequests) {
    console.log(`  ${req.method} ${req.url.slice(0, 150)}`)
    if (req.postData) console.log(`    Body: ${req.postData.slice(0, 500)}`)
    console.log('')
  }

  // Now click on a specific issue
  console.log('\n=== Klik op eerste aflevering ===')
  edgeRequests.length = 0

  const issueClicked = await page.evaluate(() => {
    const allEls = document.querySelectorAll('a, button, [role="treeitem"], span')
    for (const el of allEls) {
      const text = (el.textContent || '').trim()
      if (text.includes('Aflevering') && text.includes('2025')) {
        el.click()
        return text
      }
    }
    // Try any Aflevering link
    for (const el of allEls) {
      const text = (el.textContent || '').trim()
      if (text.startsWith('Aflevering')) {
        el.click()
        return text
      }
    }
    return false
  })
  console.log('Clicked issue:', issueClicked)
  await new Promise(r => setTimeout(r, 5000))

  console.log(`\n${edgeRequests.length} nieuwe requests:\n`)
  for (const req of edgeRequests) {
    console.log(`  ${req.method} ${req.url.slice(0, 150)}`)
    if (req.postData) console.log(`    Body: ${req.postData.slice(0, 500)}`)
    console.log('')
  }

  // Navigate to a specific article
  console.log('\n=== Navigeer naar een artikel ===')
  edgeRequests.length = 0

  // Get the first article link
  const articleUrl = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/document/id"]')
    for (const a of links) {
      const text = (a.textContent || '').trim()
      if (text.length > 20 && !text.includes('cookie') && !text.includes('Privacy')) {
        return { href: a.href, text: text.slice(0, 100) }
      }
    }
    return null
  })

  if (articleUrl) {
    console.log(`Artikel: ${articleUrl.text}`)
    console.log(`URL: ${articleUrl.href}`)

    await page.goto(articleUrl.href, { waitUntil: 'networkidle2', timeout: 20000 })
    await new Promise(r => setTimeout(r, 8000))
    await page.evaluate(() => { const b = document.querySelectorAll('button'); for (const btn of b) { if ((btn.textContent||'').toLowerCase().includes('accepteer alle')) { btn.click(); return } } })
    await new Promise(r => setTimeout(r, 3000))

    console.log(`\n${edgeRequests.length} requests voor artikel:\n`)
    for (const req of edgeRequests) {
      console.log(`  ${req.method} ${req.url.slice(0, 150)}`)
      if (req.postData) console.log(`    Body: ${req.postData.slice(0, 500)}`)
      console.log('')
    }

    // Get rendered content
    const content = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      return {
        title: document.title,
        textLength: text.length,
        textPreview: text.slice(0, 3000),
      }
    })
    console.log(`\nTitel: ${content.title}`)
    console.log(`Text (${content.textLength} chars): ${content.textPreview.slice(0, 2000)}`)
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
