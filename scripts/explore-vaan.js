/**
 * Verken de VAAN catalogus structuur: paginering, categorieën, totaal artikelen
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

  // Login
  console.log('Inloggen...')
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]')
  if (emailInput) {
    await emailInput.type(creds.email, { delay: 30 })
    const pwInput = await page.$('input[type="password"]')
    if (!pwInput) {
      const btn = await page.$('button[type="submit"]')
      if (btn) { await btn.click(); await new Promise(r=>setTimeout(r,3000)) }
    }
    const pw = await page.$('input[type="password"]')
    if (pw) {
      await pw.type(creds.password, { delay: 30 })
      const sub = await page.$('button[type="submit"]')
      if (sub) {
        await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:15000}).catch(()=>{}), sub.click()])
        await new Promise(r=>setTimeout(r,3000))
      }
    }
  }

  if (!page.url().includes('catalogus')) {
    await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log('URL:', page.url())
  console.log('\n=== PAGINA ANALYSE ===\n')

  // Get ALL links and their structure
  const analysis = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
    const categories = {}
    const articleLinks = []
    const navLinks = []
    const otherLinks = []

    for (const a of allLinks) {
      const href = a.href
      const text = (a.textContent || '').trim()
      if (!href || href.includes('#')) continue

      if (href.includes('/ar-updates/') && !href.endsWith('/catalogus') && !href.includes('redactie') && !href.includes('hoe') && !href.includes('contact') && !href.includes('annotatoren') && !href.includes('podcasts')) {
        articleLinks.push({ url: href, text: text.slice(0, 100) })
      } else if (href.includes('vaan.ar-updates.nl')) {
        navLinks.push({ url: href, text: text.slice(0, 100) })
      }
    }

    // Check for pagination elements
    const paginationInfo = []
    const allElements = document.querySelectorAll('*')
    for (const el of allElements) {
      const cls = el.className || ''
      if (typeof cls === 'string' && (cls.includes('paginat') || cls.includes('pager') || cls.includes('page-nav'))) {
        paginationInfo.push({ tag: el.tagName, class: cls, text: el.textContent.slice(0, 200) })
      }
    }

    // Check for select/dropdown elements (year selector, etc.)
    const selects = Array.from(document.querySelectorAll('select'))
    const selectInfo = selects.map(s => ({
      name: s.name || s.id,
      options: Array.from(s.options).map(o => ({ value: o.value, text: o.textContent.trim() }))
    }))

    // Look for numbers that might indicate total pages/articles
    const bodyText = document.body.textContent || ''
    const numbers = bodyText.match(/\d+ (resultaten|uitspraken|items|artikelen|updates)/gi) || []

    // Check the navigation menu structure
    const menuItems = Array.from(document.querySelectorAll('nav a, [class*="menu"] a, [class*="nav"] a')).map(a => ({
      url: a.href, text: (a.textContent || '').trim().slice(0, 80)
    }))

    return {
      articleLinks: articleLinks.slice(0, 30),
      articleCount: articleLinks.length,
      navLinks,
      paginationInfo,
      selectInfo,
      numbers,
      menuItems: menuItems.slice(0, 50),
      pageTitle: document.title,
      bodyTextPreview: bodyText.replace(/\s+/g, ' ').trim().slice(0, 1000),
    }
  })

  console.log('Titel:', analysis.pageTitle)
  console.log('Artikel links op pagina:', analysis.articleCount)
  console.log('\n--- Nav links ---')
  for (const l of analysis.navLinks) console.log(`  ${l.text} → ${l.url}`)
  console.log('\n--- Menu items ---')
  for (const m of analysis.menuItems) console.log(`  ${m.text} → ${m.url}`)
  console.log('\n--- Paginering ---')
  for (const p of analysis.paginationInfo) console.log(`  <${p.tag} class="${p.class}"> ${p.text}`)
  console.log('\n--- Dropdowns ---')
  for (const s of analysis.selectInfo) {
    console.log(`  Select "${s.name}":`)
    for (const o of s.options) console.log(`    ${o.value} = ${o.text}`)
  }
  console.log('\n--- Getallen in tekst ---')
  for (const n of analysis.numbers) console.log(`  ${n}`)
  console.log('\n--- Body preview ---')
  console.log(analysis.bodyTextPreview)

  // Now try navigating to different sections
  console.log('\n\n=== SECTIES VERKENNEN ===\n')
  const sectionUrls = [
    'https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus',
    'https://vaan.ar-updates.nl/rechtspraak/tr-updates/catalogus',
    'https://vaan.ar-updates.nl/rechtspraak/sr-updates/catalogus',
  ]
  for (const url of sectionUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 2000))
      const count = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).filter(a =>
          a.href.includes('/updates/') && !a.href.endsWith('/catalogus') &&
          !a.href.includes('redactie') && !a.href.includes('contact')
        ).length
      })
      console.log(`  ${url.split('/').slice(-2).join('/')}: ${count} links`)
    } catch {}
  }

  // Try to find if there are page numbers or total count
  await page.goto('https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  // Screenshot
  await page.screenshot({ path: path.join(__dirname, '..', 'crawl-vaan-explore.png'), fullPage: true }).catch(()=>{})
  console.log('\nScreenshot opgeslagen als crawl-vaan-explore.png')

  // Get full HTML for analysis
  const html = await page.content()
  fs.writeFileSync(path.join(__dirname, '..', 'crawl-vaan-page.html'), html)
  console.log('HTML opgeslagen als crawl-vaan-page.html')

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
