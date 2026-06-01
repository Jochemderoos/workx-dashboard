/**
 * Test de Boom middleware API om alle VAAN uitspraken op te halen
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

  // Intercept the filter POST to see what body is sent
  let filterBody = null
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.url().includes('catalogue/caselaw/filter') && req.method() === 'POST') {
      filterBody = req.postData()
    }
    req.continue()
  })

  // Login
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // Accept cookies
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase(), btn)
    if (text.includes('alle cookies toestaan')) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break }
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
      if (sub) { await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), sub.click()]); await new Promise(r=>setTimeout(r,3000)) }
    }
  }

  if (!page.url().includes('catalogus')) {
    await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  }
  await new Promise(r => setTimeout(r, 5000))

  console.log('Filter body:', filterBody)

  // Now try calling the API directly from the browser context (with cookies)
  console.log('\n=== API TEST ===')

  // First: see what the default response looks like
  const result = await page.evaluate(async () => {
    const body = {
      caseLawUuid: 'a5ebbff4cf394d0b9604c2623896d6cd',
      page: 0,
      size: 5, // Just 5 for testing
      sort: 'DATE_DESC'
    }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    const data = await res.json()
    return {
      totalHits: data.totalHits,
      contentLength: data.content?.length,
      firstItem: data.content?.[0] ? {
        keys: Object.keys(data.content[0]),
        preview: JSON.stringify(data.content[0]).slice(0, 500)
      } : null
    }
  })

  console.log('Total hits:', result.totalHits)
  console.log('Content returned:', result.contentLength)
  console.log('First item keys:', result.firstItem?.keys)
  console.log('First item:', result.firstItem?.preview)

  // Try getting a full page of 100
  const result2 = await page.evaluate(async () => {
    const body = {
      caseLawUuid: 'a5ebbff4cf394d0b9604c2623896d6cd',
      page: 0,
      size: 100,
      sort: 'DATE_DESC'
    }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    const data = await res.json()
    // Get URLs of all items
    const items = (data.content || []).map(item => ({
      id: item.publicationNumber || item.id || item.uuid,
      title: item.caseLawTitle || item.title,
      date: item.addedDate,
      hasUrl: !!item.url || !!item.slug || !!item.publicationNumber,
    }))
    return {
      total: data.totalHits,
      returned: items.length,
      items: items.slice(0, 5),
      fullFirst: data.content?.[0],
    }
  })

  console.log('\n=== 100 ITEMS ===')
  console.log('Total:', result2.total)
  console.log('Returned:', result2.returned)
  console.log('Sample items:', JSON.stringify(result2.items, null, 2))
  console.log('\nFull first item:', JSON.stringify(result2.fullFirst, null, 2).slice(0, 2000))

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
