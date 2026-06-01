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
    headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))
  const btns = await page.$$('button')
  for (const btn of btns) { const t = await page.evaluate(el => (el.textContent||'').toLowerCase(), btn); if (t.includes('alle cookies')) { await btn.click(); await new Promise(r=>setTimeout(r,2000)); break } }
  const em = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (em) {
    await em.type(creds.email, { delay: 20 }); let pw = await page.$('input[type="password"]'); if (!pw) { const b = await page.$('button[type="submit"]'); if (b) { await b.click(); await new Promise(r=>setTimeout(r,3000)) } }
    pw = await page.$('input[type="password"]'); if (pw) { await pw.type(creds.password, { delay: 20 }); const s = await page.$('button[type="submit"]'); if (s) { await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), s.click()]); await new Promise(r=>setTimeout(r,3000)) } }
  }
  if (!page.url().includes('catalogus')) await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))

  // Get one item with all fields
  const item = await page.evaluate(async () => {
    const body = { caseLawId: "ar-updates", year: null, page: 1, sort: "publication_date", filter: "", pageSize: 2 }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
    })
    const data = await res.json()
    return { total: data.totalHits, topKeys: Object.keys(data), item: data.content?.[0] }
  })

  console.log('Total hits:', item.total)
  console.log('Response keys:', item.topKeys)
  console.log('\nFull first item:')
  console.log(JSON.stringify(item.item, null, 2))

  // Test getting the article content via its slug/url
  if (item.item) {
    const slug = item.item.slug || item.item.publicationNumber || item.item.id
    console.log('\nTrying to fetch article content...')
    console.log('Slug:', slug)

    // Try fetching the article page
    if (slug) {
      const url = `https://vaan.ar-updates.nl/rechtspraak/ar-updates/${slug}`
      console.log('URL:', url)
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 3000))
      const content = await page.evaluate(() => {
        const selectors = ['article', '.article-content', 'main', '[role="main"]', '.content']
        let el = null
        for (const s of selectors) { el = document.querySelector(s); if (el && el.textContent.trim().length > 200) break }
        if (!el) el = document.body
        const clone = el.cloneNode(true)
        clone.querySelectorAll('script,style,nav,footer,header').forEach(e => e.remove())
        return { title: document.title, length: (clone.textContent||'').replace(/\s+/g,' ').trim().length, preview: (clone.textContent||'').replace(/\s+/g,' ').trim().slice(0, 500) }
      })
      console.log('Content length:', content.length, 'tekens')
      console.log('Preview:', content.preview)
    }
  }

  await browser.close()
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
