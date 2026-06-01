/**
 * Intercepteer network requests op VAAN om de API te vinden
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()

async function main() {
  const source = await prisma.aISource.findUnique({ where: { id: 'cmlcq12aj0001jmy15c7x98if' } })
  const creds = JSON.parse(source.credentials)
  const puppeteer = require('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // Intercept XHR/fetch requests
  const apiCalls = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    const type = req.resourceType()
    if (type === 'xhr' || type === 'fetch' || (type === 'document' && url.includes('api'))) {
      apiCalls.push({ method: req.method(), url, type, headers: req.headers() })
    }
    req.continue()
  })

  // Also intercept responses to see API data
  const apiResponses = []
  page.on('response', async (res) => {
    const url = res.url()
    if (url.includes('/api/') || url.includes('graphql') || url.includes('/caselaw') || url.includes('/catalog') || url.includes('/search') || url.includes('/articles') || url.includes('/publications')) {
      try {
        const body = await res.text().catch(() => '')
        apiResponses.push({ url, status: res.status(), size: body.length, preview: body.slice(0, 500) })
      } catch {}
    }
  })

  // Login
  console.log('Inloggen...')
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // Accept cookies
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase(), btn)
    if (text.includes('alle cookies toestaan') || text.includes('accepteer')) {
      await btn.click(); await new Promise(r => setTimeout(r, 2000)); break
    }
  }

  const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (emailInput) {
    await emailInput.type(creds.email, { delay: 20 })
    const pw = await page.$('input[type="password"]')
    if (!pw) {
      const btn = await page.$('button[type="submit"]')
      if (btn) { await btn.click(); await new Promise(r=>setTimeout(r,3000)) }
    }
    const pw2 = await page.$('input[type="password"]')
    if (pw2) {
      await pw2.type(creds.password, { delay: 20 })
      const sub = await page.$('button[type="submit"]')
      if (sub) {
        await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), sub.click()])
        await new Promise(r=>setTimeout(r,3000))
      }
    }
  }

  // Navigate to catalogus
  if (!page.url().includes('catalogus')) {
    await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  }
  await new Promise(r => setTimeout(r, 5000))

  console.log('URL:', page.url())
  console.log('\n=== API CALLS ===')
  for (const c of apiCalls) {
    if (!c.url.includes('.js') && !c.url.includes('.css') && !c.url.includes('fonts') && !c.url.includes('cookiehub') && !c.url.includes('google')) {
      console.log(`  ${c.method} ${c.url.slice(0, 150)}`)
    }
  }

  console.log('\n=== API RESPONSES ===')
  for (const r of apiResponses) {
    console.log(`  [${r.status}] ${r.url.slice(0, 120)} (${r.size} bytes)`)
    console.log(`    ${r.preview.slice(0, 200)}`)
  }

  // Now scroll down and interact to trigger more API calls
  console.log('\n=== SCROLLING & INTERACTING ===')
  apiCalls.length = 0
  apiResponses.length = 0

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await new Promise(r => setTimeout(r, 3000))

  // Look for and click any "next" or pagination elements
  const nextClicked = await page.evaluate(() => {
    const allEl = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    for (const el of allEl) {
      const text = (el.textContent || '').trim()
      const cls = el.className || ''
      if (text === '>' || text === '→' || text === 'Volgende' || text === 'Next' ||
          text === 'Meer' || text === 'Meer laden' || text === 'Load more' ||
          cls.includes('next') || cls.includes('forward') || cls.includes('arrow-right')) {
        el.click()
        return `Clicked: "${text}" (class: ${cls.toString().slice(0, 50)})`
      }
    }
    // Try SVG arrow buttons
    const svgs = document.querySelectorAll('svg')
    for (const svg of svgs) {
      const parent = svg.parentElement
      if (parent && (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button')) {
        const cls = parent.className || ''
        if (cls.includes('next') || cls.includes('forward') || cls.includes('right')) {
          parent.click()
          return `Clicked SVG parent: class=${cls.toString().slice(0, 50)}`
        }
      }
    }
    return null
  })
  if (nextClicked) console.log('  ' + nextClicked)
  await new Promise(r => setTimeout(r, 3000))

  for (const c of apiCalls) {
    if (!c.url.includes('.js') && !c.url.includes('.css') && !c.url.includes('fonts') && !c.url.includes('cookiehub') && !c.url.includes('google')) {
      console.log(`  ${c.method} ${c.url.slice(0, 150)}`)
    }
  }
  for (const r of apiResponses) {
    console.log(`  [${r.status}] ${r.url.slice(0, 120)} (${r.size} bytes)`)
    console.log(`    ${r.preview.slice(0, 300)}`)
  }

  // Also try direct API calls that Boom portals typically use
  console.log('\n=== DIRECTE API POGINGEN ===')
  const testUrls = [
    'https://vaan.ar-updates.nl/api/caselaw/ar-updates?page=1&size=50',
    'https://vaan.ar-updates.nl/api/catalog?caseLawUuid=a5ebbff4cf394d0b9604c2623896d6cd&page=1&size=50',
    'https://vaan.ar-updates.nl/api/publications?caseLawUuid=a5ebbff4cf394d0b9604c2623896d6cd',
    'https://vaan.ar-updates.nl/api/search?type=caselaw&page=1&size=100',
  ]
  for (const url of testUrls) {
    try {
      const cookies = await page.cookies()
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      const res = await page.evaluate(async (u) => {
        const r = await fetch(u, { credentials: 'include' })
        const text = await r.text()
        return { status: r.status, size: text.length, preview: text.slice(0, 300) }
      }, url)
      console.log(`  ${url}`)
      console.log(`    [${res.status}] ${res.size} bytes: ${res.preview.slice(0, 200)}`)
    } catch (e) {
      console.log(`  ${url}: FOUT`)
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
