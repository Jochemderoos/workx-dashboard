/**
 * Verken InView — Tijdschrift voor Arbeidsrecht
 * Doel: ontdekken hoeveel artikelen er zijn, of er een API is, en hoe we content kunnen ophalen
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const puppeteer = require('puppeteer-core')

async function main() {
  // Find the Tijdschrift Arbeidsrecht source
  const source = await prisma.aISource.findFirst({ where: { name: { contains: 'Tijdschrift' } } })
  if (!source) {
    // Try RAR
    const rar = await prisma.aISource.findFirst({ where: { name: { contains: 'RAR' } } })
    if (!rar) { console.error('Geen InView bron gevonden!'); process.exit(1) }
  }

  // Get any InView source with credentials
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { id: true, name: true, url: true, credentials: true }
  })
  if (!inviewSource) { console.error('Geen InView bron gevonden!'); process.exit(1) }

  const creds = JSON.parse(inviewSource.credentials)
  console.log(`Bron: ${inviewSource.name}`)
  console.log(`URL: ${inviewSource.url}\n`)

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // === STAP 1: INLOGGEN ===
  console.log('=== STAP 1: Inloggen bij InView ===')

  // Intercept network requests to discover APIs
  const apiCalls = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.includes('api') || url.includes('search') || url.includes('filter') || url.includes('query') || url.includes('graphql')) {
      apiCalls.push({ method: req.method(), url: url.slice(0, 200), postData: req.postData()?.slice(0, 500) })
    }
    req.continue()
  })

  await page.goto('https://www.inview.nl/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // Accept cookies
  const allBtns = await page.$$('button, a')
  for (const btn of allBtns) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (text.includes('accepteer') || text.includes('alle cookies')) {
      await btn.click()
      console.log('  Cookies geaccepteerd')
      await new Promise(r => setTimeout(r, 1500))
      break
    }
  }

  // Navigate to SSO login
  const ssoUrl = `https://www.inview.nl/.sso/login?redirect_uri=${encodeURIComponent('https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht')}`
  console.log('  SSO URL:', ssoUrl.slice(0, 80))
  await page.goto(ssoUrl, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  console.log('  Login pagina:', page.url().slice(0, 80))

  // Fill username
  let usernameField = await page.$('input[name="pf.username"]')
  if (!usernameField) usernameField = await page.$('input[type="email"], input[name="username"]')
  if (usernameField) {
    await usernameField.click({ clickCount: 3 }).catch(() => {})
    await usernameField.type(creds.email, { delay: 30 })
    console.log('  Username ingevuld')
  } else {
    console.log('  GEEN username veld gevonden!')
    await page.screenshot({ path: 'inview-debug-login.png' })
  }
  await new Promise(r => setTimeout(r, 500))

  // Click step 1 (reveals password field)
  let step1 = await page.$('button.wk-login-submit[type="button"]')
  if (!step1) step1 = await page.$('button[type="button"].wk-login-submit, button.ping-button')
  if (step1) {
    await step1.click()
    console.log('  Stap 1 geklikt')
  }
  await new Promise(r => setTimeout(r, 4000))

  // Fill password
  let pwField = await page.$('input[name="pf.pass"]')
  if (!pwField) pwField = await page.$('input[type="password"]')
  if (pwField) {
    await pwField.click({ clickCount: 3 }).catch(() => {})
    await pwField.type(creds.password, { delay: 30 })
    console.log('  Wachtwoord ingevuld')
  } else {
    console.log('  GEEN wachtwoord veld gevonden!')
    await page.screenshot({ path: 'inview-debug-password.png' })
  }
  await new Promise(r => setTimeout(r, 500))

  // Submit
  let submitBtn = await page.$('button.wk-login-submit[type="submit"]')
  if (!submitBtn) submitBtn = await page.$('button[type="submit"]')
  if (submitBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      submitBtn.click()
    ])
    console.log('  Formulier verstuurd')
  } else {
    // Fallback: form submit
    await page.evaluate(() => {
      const form = document.getElementById('KauriForm') || document.querySelector('form')
      if (form) form.submit()
    })
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  }
  await new Promise(r => setTimeout(r, 5000))

  const afterLoginUrl = page.url()
  console.log('  Na login:', afterLoginUrl.slice(0, 100))
  const isLoggedIn = afterLoginUrl.includes('inview.nl') && !afterLoginUrl.includes('login') && !afterLoginUrl.includes('inloggen')
  console.log(`  Ingelogd: ${isLoggedIn ? 'JA' : 'NEE'}`)

  if (!isLoggedIn) {
    await page.screenshot({ path: 'inview-debug-afterlogin.png' })
    console.log('  Screenshot opgeslagen: inview-debug-afterlogin.png')
    // Try to continue anyway
  }

  // Accept cookies again after login
  const btns2 = await page.$$('button, a')
  for (const btn of btns2) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (text.includes('accepteer') || text.includes('alle cookies')) {
      await btn.click()
      await new Promise(r => setTimeout(r, 1000))
      break
    }
  }

  // === STAP 2: TIJDSCHRIFT VOOR ARBEIDSRECHT VERKENNEN ===
  console.log('\n=== STAP 2: Tijdschrift voor Arbeidsrecht verkennen ===')

  const tvaUrls = [
    'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht',
    'https://www.inview.nl/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c/tijdschrift-arbeidsrecht',
    'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht/afleveringen',
  ]

  for (const url of tvaUrls) {
    console.log(`\n  --- ${url.split('/').pop()} ---`)
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 3000))
      console.log(`  Titel: ${await page.title()}`)
      console.log(`  URL: ${page.url().slice(0, 100)}`)

      // Get page content summary
      const info = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
          .filter(l => l.text.length > 5 && l.href.includes('inview.nl'))

        // Look for article-like links
        const articleLinks = links.filter(l =>
          l.href.includes('/document/') || l.href.includes('/artikel') ||
          l.href.includes('/aflevering') || l.href.includes('/publicatie')
        )

        // Look for pagination
        const paginationEl = document.querySelector('[class*="paginat"], [class*="pager"], nav[aria-label*="pagina"]')

        // Look for counts/totals
        const countMatch = text.match(/(\d+)\s*(resultaten|artikelen|items|documenten|publicaties)/i)

        return {
          textPreview: text.slice(0, 1000),
          totalLinks: links.length,
          articleLinks: articleLinks.slice(0, 20),
          allLinksPreview: links.slice(0, 30),
          hasPagination: !!paginationEl,
          paginationText: paginationEl?.textContent?.trim()?.slice(0, 200),
          countInfo: countMatch ? countMatch[0] : null,
        }
      })

      console.log(`  Links totaal: ${info.totalLinks}`)
      console.log(`  Artikel-links: ${info.articleLinks.length}`)
      if (info.countInfo) console.log(`  Aantal gevonden: ${info.countInfo}`)
      if (info.hasPagination) console.log(`  Paginering: ${info.paginationText}`)

      if (info.articleLinks.length > 0) {
        console.log('  Eerste artikel-links:')
        for (const l of info.articleLinks.slice(0, 10)) {
          console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
        }
      } else {
        console.log('  Alle links:')
        for (const l of info.allLinksPreview.slice(0, 15)) {
          console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
        }
      }

      console.log(`  Text preview: ${info.textPreview.slice(0, 300).replace(/\s+/g, ' ')}`)
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  // === STAP 3: ZOEK NAAR APIS ===
  console.log('\n=== STAP 3: API Discovery ===')

  // Try search
  console.log('\n  --- Zoekfunctie testen ---')
  await page.goto('https://www.inview.nl/zoeken?q=arbeidsovereenkomst&bronnen=tijdschrift-voor-arbeidsrecht', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 3000))
  console.log(`  URL: ${page.url().slice(0, 120)}`)

  const searchInfo = await page.evaluate(() => {
    const text = document.body.innerText || ''
    const countMatch = text.match(/(\d+[\.\d]*)\s*(resultaten|resultaat|artikelen|items|documenten|treffer)/i)
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
      .filter(l => l.text.length > 10 && l.href.includes('inview.nl'))
    return {
      title: document.title,
      count: countMatch ? countMatch[0] : null,
      textPreview: text.slice(0, 500).replace(/\s+/g, ' '),
      resultLinks: links.filter(l => l.href.includes('/document/')).slice(0, 10),
      allLinks: links.slice(0, 20),
    }
  })
  console.log(`  Titel: ${searchInfo.title}`)
  if (searchInfo.count) console.log(`  Resultaten: ${searchInfo.count}`)
  console.log(`  Text: ${searchInfo.textPreview.slice(0, 300)}`)
  if (searchInfo.resultLinks.length > 0) {
    console.log('  Document links:')
    for (const l of searchInfo.resultLinks) console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
  }

  // Try different search URLs
  const searchUrls = [
    'https://www.inview.nl/zoeken?q=*&bronnen=tijdschrift-voor-arbeidsrecht',
    'https://www.inview.nl/zoeken?q=&bronnen=tijdschrift-voor-arbeidsrecht&sorteer=datum',
  ]
  for (const sUrl of searchUrls) {
    console.log(`\n  --- ${sUrl.split('?').pop().slice(0, 60)} ---`)
    try {
      await page.goto(sUrl, { waitUntil: 'networkidle2', timeout: 15000 })
      await new Promise(r => setTimeout(r, 3000))
      const si = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const cm = text.match(/(\d+[\.\d]*)\s*(resultaten|resultaat|artikelen|items)/i)
        return { count: cm?.[0], preview: text.slice(0, 300).replace(/\s+/g, ' ') }
      })
      if (si.count) console.log(`  Resultaten: ${si.count}`)
      console.log(`  Preview: ${si.preview.slice(0, 200)}`)
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  // === STAP 4: CHECK INTERCEPTED API CALLS ===
  console.log('\n=== STAP 4: Onderschepte API calls ===')
  console.log(`  ${apiCalls.length} API calls gevonden:`)
  for (const call of apiCalls) {
    console.log(`  ${call.method} ${call.url}`)
    if (call.postData) console.log(`    Body: ${call.postData.slice(0, 200)}`)
  }

  // === STAP 5: PROBEER EEN ARTIKEL TE OPENEN ===
  console.log('\n=== STAP 5: Artikel content testen ===')

  // First collect any article links we found
  const allArticleLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/document/"]'))
      .map(a => a.href)
      .filter(h => h.includes('inview.nl'))
      .slice(0, 5)
  })

  if (allArticleLinks.length > 0) {
    const testUrl = allArticleLinks[0]
    console.log(`  Test artikel: ${testUrl.slice(0, 100)}`)
    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 20000 })
    await new Promise(r => setTimeout(r, 3000))

    const articleInfo = await page.evaluate(() => {
      const article = document.querySelector('article, .article-content, main, [role="main"], .document-content, .content')
      const el = article || document.body
      const clone = el.cloneNode(true)
      clone.querySelectorAll('script,style,nav,footer,header').forEach(e => e.remove())
      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim()

      // Check for PDF links/embeds
      const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], embed[src*=".pdf"], iframe[src*=".pdf"], object[data*=".pdf"]'))
        .map(el => el.href || el.src || el.getAttribute('data') || '')

      // Check for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'))
        .map(f => ({ src: f.src, width: f.width, height: f.height }))

      return {
        title: document.title,
        textLength: text.length,
        textPreview: text.slice(0, 1000),
        pdfLinks,
        iframes,
        url: window.location.href,
      }
    })

    console.log(`  Titel: ${articleInfo.title}`)
    console.log(`  Text lengte: ${articleInfo.textLength} tekens`)
    console.log(`  PDF links: ${articleInfo.pdfLinks.length}`)
    if (articleInfo.pdfLinks.length > 0) {
      for (const pdf of articleInfo.pdfLinks) console.log(`    PDF: ${pdf.slice(0, 100)}`)
    }
    if (articleInfo.iframes.length > 0) {
      console.log(`  Iframes: ${articleInfo.iframes.length}`)
      for (const f of articleInfo.iframes) console.log(`    ${f.src?.slice(0, 100)} (${f.width}x${f.height})`)
    }
    console.log(`  Text preview: ${articleInfo.textPreview.slice(0, 500)}`)
  } else {
    console.log('  Geen artikel-links gevonden om te testen')
  }

  // === STAP 6: CHECK AFLEVERINGEN (ISSUES) ===
  console.log('\n=== STAP 6: Afleveringen/edities zoeken ===')
  const issueUrls = [
    'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht/afleveringen',
    'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht/archief',
    'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht/jaargangen',
    'https://www.inview.nl/publicaties/tijdschrift-voor-arbeidsrecht',
  ]

  for (const iUrl of issueUrls) {
    console.log(`\n  --- ${iUrl.split('/').slice(-2).join('/')} ---`)
    try {
      await page.goto(iUrl, { waitUntil: 'networkidle2', timeout: 15000 })
      await new Promise(r => setTimeout(r, 3000))
      const iInfo = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
          .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
        return {
          title: document.title,
          url: window.location.href,
          textPreview: text.slice(0, 500).replace(/\s+/g, ' '),
          links: links.slice(0, 20),
          articleLinks: links.filter(l => l.href.includes('/document/') || l.href.includes('/aflevering')).slice(0, 20),
        }
      })
      console.log(`  Titel: ${iInfo.title}`)
      console.log(`  URL: ${iInfo.url.slice(0, 100)}`)
      console.log(`  Text: ${iInfo.textPreview.slice(0, 200)}`)
      if (iInfo.articleLinks.length > 0) {
        console.log(`  ${iInfo.articleLinks.length} aflevering/document links:`)
        for (const l of iInfo.articleLinks.slice(0, 10)) {
          console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
        }
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  // Print all intercepted API calls again (may have more now)
  console.log('\n=== ALLE API CALLS ===')
  const uniqueApis = [...new Map(apiCalls.map(c => [c.url, c])).values()]
  for (const call of uniqueApis) {
    console.log(`  ${call.method} ${call.url}`)
    if (call.postData) console.log(`    Body: ${call.postData.slice(0, 300)}`)
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
