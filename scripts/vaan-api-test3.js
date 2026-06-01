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
  for (const btn of buttons) { const text = await page.evaluate(el => (el.textContent || '').toLowerCase(), btn); if (text.includes('alle cookies toestaan')) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break } }
  const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (emailInput) {
    await emailInput.type(creds.email, { delay: 20 }); let pw = await page.$('input[type="password"]'); if (!pw) { const btn = await page.$('button[type="submit"]'); if (btn) { await btn.click(); await new Promise(r=>setTimeout(r,3000)) } }
    pw = await page.$('input[type="password"]'); if (pw) { await pw.type(creds.password, { delay: 20 }); const sub = await page.$('button[type="submit"]'); if (sub) { await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), sub.click()]); await new Promise(r=>setTimeout(r,3000)) } }
  }
  if (!page.url().includes('catalogus')) await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  console.log('Ingelogd')

  // Test API with JSON parsing inside browser
  const info = await page.evaluate(async () => {
    const body = { caseLawId: "ar-updates", year: null, page: 0, sort: "publication_date", filter: "", pageSize: 5 }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
    })
    const data = await res.json()
    return {
      totalHits: data.totalHits,
      contentLen: data.content?.length,
      keys: data.content?.[0] ? Object.keys(data.content[0]) : [],
      first: data.content?.[0] ? JSON.stringify(data.content[0]).slice(0, 2000) : null,
    }
  })

  console.log('Total hits:', info.totalHits)
  console.log('Returned:', info.contentLen)
  console.log('Keys:', info.keys)
  console.log('\nFirst item:', info.first)

  // Test pagination
  console.log('\n=== PAGINERING ===')
  for (let pg = 0; pg <= 2; pg++) {
    const r = await page.evaluate(async (p) => {
      const body = { caseLawId: "ar-updates", year: null, page: p, sort: "publication_date", filter: "", pageSize: 100 }
      const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
      })
      const data = await res.json()
      return { page: p, total: data.totalHits, count: data.content?.length, firstNum: data.content?.[0]?.publicationNumber, lastNum: data.content?.slice(-1)[0]?.publicationNumber }
    }, pg)
    console.log(`  Page ${r.page}: ${r.count} items (${r.firstNum} → ${r.lastNum}), total: ${r.total}`)
  }

  // Check how many total pages
  const totalPages = await page.evaluate(async () => {
    const body = { caseLawId: "ar-updates", year: null, page: 0, sort: "publication_date", filter: "", pageSize: 100 }
    const res = await fetch('https://middleware.boomportaal.nl/boom/services/rest/cataloguemanagement/v1/catalogue/caselaw/filter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body)
    })
    const data = await res.json()
    return Math.ceil(data.totalHits / 100)
  })
  console.log(`\nTotaal paginas nodig (100/pagina): ${totalPages}`)

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
