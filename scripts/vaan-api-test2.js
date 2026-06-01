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

  // Login
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase(), btn)
    if (text.includes('alle cookies toestaan')) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break }
  }
  const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (emailInput) {
    await emailInput.type(creds.email, { delay: 20 })
    let pw = await page.$('input[type="password"]')
    if (!pw) { const btn = await page.$('button[type="submit"]'); if (btn) { await btn.click(); await new Promise(r=>setTimeout(r,3000)) } }
    pw = await page.$('input[type="password"]')
    if (pw) { await pw.type(creds.password, { delay: 20 }); const sub = await page.$('button[type="submit"]'); if (sub) { await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), sub.click()]); await new Promise(r=>setTimeout(r,3000)) } }
  }
  if (!page.url().includes('catalogus')) {
    await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  }
  await new Promise(r => setTimeout(r, 5000))
  console.log('Ingelogd. URL:', page.url())

  // Use the EXACT same API format as the intercepted request
  const result = await page.evaluate(async () => {
    const body = {
      caseLawId: "ar-updates",
      year: null,
      page: null,
      sort: "publication_date",
      filter: "",
      pageSize: 100
    }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    const text = await res.text()
    return { status: res.status, size: text.length, preview: text.slice(0, 2000) }
  })

  console.log('\nStatus:', result.status)
  console.log('Size:', result.size)

  const data = JSON.parse(result.preview.length === result.size ? result.preview : result.preview + '...(truncated)')
  if (data.totalHits !== undefined) {
    console.log('Total hits:', data.totalHits)
  }

  // Parse the full response
  const fullResult = await page.evaluate(async () => {
    const body = { caseLawId: "ar-updates", year: null, page: null, sort: "publication_date", filter: "", pageSize: 50 }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
    })
    const data = await res.json()
    return {
      totalHits: data.totalHits,
      contentCount: data.content?.length || 0,
      firstKeys: data.content?.[0] ? Object.keys(data.content[0]) : [],
      first3: (data.content || []).slice(0, 3).map(item => ({
        pubNum: item.publicationNumber,
        title: (item.caseLawTitle || item.title || '').slice(0, 100),
        date: item.addedDate,
        slug: item.slug,
        ecli: item.ecli,
        keywords: (item.keywords || []).slice(0, 3).map(k => k.keyword || k),
      }))
    }
  })

  console.log('\n=== RESULTAAT ===')
  console.log('Total hits:', fullResult.totalHits)
  console.log('Returned:', fullResult.contentCount)
  console.log('Keys per item:', fullResult.firstKeys)
  console.log('Eerste 3 items:', JSON.stringify(fullResult.first3, null, 2))

  // Now test pagination
  console.log('\n=== PAGINERING TEST ===')
  for (let pg = 0; pg < 3; pg++) {
    const pgResult = await page.evaluate(async (pageNum) => {
      const body = { caseLawId: "ar-updates", year: null, page: pageNum, sort: "publication_date", filter: "", pageSize: 100 }
      const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
      })
      const data = await res.json()
      const items = data.content || []
      return {
        page: pageNum,
        total: data.totalHits,
        count: items.length,
        firstPub: items[0]?.publicationNumber,
        lastPub: items[items.length - 1]?.publicationNumber,
      }
    }, pg)
    console.log(`  Page ${pgResult.page}: ${pgResult.count} items (${pgResult.firstPub} ... ${pgResult.lastPub}), total: ${pgResult.total}`)
  }

  // Check article content URL
  const articleTest = await page.evaluate(async () => {
    const body = { caseLawId: "ar-updates", year: null, page: null, sort: "publication_date", filter: "", pageSize: 1 }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
    })
    const data = await res.json()
    return data.content?.[0] || null
  })

  console.log('\n=== VOLLEDIG EERSTE ITEM ===')
  console.log(JSON.stringify(articleTest, null, 2).slice(0, 3000))

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
