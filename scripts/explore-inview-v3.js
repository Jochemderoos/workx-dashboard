/**
 * InView Explorer v3 — Beter login + API discovery
 * Stap voor stap met screenshots voor debugging
 */
const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))
const{PrismaClient}=require('@prisma/client');const prisma=new PrismaClient()
const puppeteer = require('puppeteer-core')

async function main() {
  const inviewSource = await prisma.aISource.findFirst({
    where: { url: { contains: 'inview.nl' } },
    select: { id: true, name: true, url: true, credentials: true }
  })
  const creds = JSON.parse(inviewSource.credentials)
  console.log('Credentials email:', creds.email)

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false, // NIET headless — zo kunnen we zien wat er gebeurt
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--window-size=1920,1080']
  })
  const page = await browser.newPage()
  await page.setViewport({width:1920,height:1080})

  // Intercept ALL requests to find APIs
  const allRequests = []
  page.on('response', async (response) => {
    const url = response.url()
    const status = response.status()
    if (url.includes('/edge/') || url.includes('/api/') || url.includes('search')) {
      let body = ''
      try { body = await response.text() } catch {}
      allRequests.push({ url: url.slice(0, 200), status, bodyPreview: body.slice(0, 500) })
    }
  })

  // === STAP 1: Ga naar InView homepage ===
  console.log('\n=== STAP 1: InView homepage ===')
  await page.goto('https://www.inview.nl/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  console.log('URL:', page.url())

  // Accept cookies via JS
  console.log('Cookies accepteren...')
  await page.evaluate(() => {
    // Try clicking all possible cookie buttons
    const buttons = document.querySelectorAll('button, a')
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase()
      if (text.includes('accepteer alle') || text.includes('accept all') || text.includes('alle cookies')) {
        btn.click()
        return 'clicked: ' + text.trim()
      }
    }
    // Try OneTrust or similar cookie consent
    if (window.OneTrust) {
      window.OneTrust.AllowAll()
      return 'OneTrust.AllowAll()'
    }
    return 'geen cookie button gevonden'
  }).then(r => console.log('  ' + r))
  await new Promise(r => setTimeout(r, 2000))

  // === STAP 2: Klik op Inloggen link ===
  console.log('\n=== STAP 2: Inloggen ===')

  // First try the SSO URL directly
  await page.goto('https://www.inview.nl/.sso/login?redirect_uri=https%3A%2F%2Fwww.inview.nl%2Fzoeken', {
    waitUntil: 'networkidle2', timeout: 30000
  })
  await new Promise(r => setTimeout(r, 3000))
  console.log('SSO pagina:', page.url().slice(0, 120))
  await page.screenshot({ path: 'iv3-step2-sso.png' })

  // Accept cookies on WK login page
  const wkBtns = await page.$$('button, a, div[role="button"]')
  for (const btn of wkBtns) {
    const t = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (t.includes('accepteer') || t.includes('accept') || t.includes('alle cookies') || t.includes('cookie')) {
      try { await btn.click() } catch {}
      await new Promise(r => setTimeout(r, 1500))
      console.log('  WK cookies geklikt:', t.slice(0, 40))
      break
    }
  }

  // Wait for form to load
  await new Promise(r => setTimeout(r, 2000))

  // Check what's on the page
  const loginPageInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name, type: i.type, placeholder: i.placeholder, id: i.id, visible: i.offsetParent !== null
    }))
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      type: b.type, text: (b.textContent || '').trim().slice(0, 50), class: b.className?.slice(0, 80)
    }))
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id, action: f.action?.slice(0, 100), method: f.method
    }))
    return { inputs, buttons, forms, url: window.location.href }
  })
  console.log('  Forms:', JSON.stringify(loginPageInfo.forms))
  console.log('  Inputs:', JSON.stringify(loginPageInfo.inputs))
  console.log('  Buttons:', JSON.stringify(loginPageInfo.buttons))

  // Fill username
  let usernameField = await page.$('input[name="pf.username"]')
  if (!usernameField) usernameField = await page.$('input[type="email"]')
  if (!usernameField) usernameField = await page.$('input[type="text"]')
  if (usernameField) {
    await usernameField.click({ clickCount: 3 }).catch(() => {})
    await usernameField.type(creds.email, { delay: 50 })
    console.log('  Email ingetypt')
  } else {
    console.log('  GEEN username veld!')
  }

  await new Promise(r => setTimeout(r, 1000))
  await page.screenshot({ path: 'iv3-step2-username.png' })

  // Click the "Volgende" / step 1 button
  let step1Clicked = false
  const step1Buttons = await page.$$('button')
  for (const btn of step1Buttons) {
    const info = await page.evaluate(el => ({
      type: el.type, text: (el.textContent || '').trim().toLowerCase(),
      class: el.className || '', visible: el.offsetParent !== null
    }), btn)
    if (info.visible && (info.class.includes('wk-login') || info.text.includes('volgende') || info.text.includes('next') ||
        (info.type === 'button' && info.class.includes('submit')))) {
      await btn.click()
      step1Clicked = true
      console.log(`  Stap 1 geklikt: "${info.text}" (${info.class.slice(0, 30)})`)
      break
    }
  }
  if (!step1Clicked) {
    // Try any submit-like button
    for (const btn of step1Buttons) {
      const info = await page.evaluate(el => ({
        type: el.type, text: (el.textContent || '').trim().toLowerCase(), visible: el.offsetParent !== null
      }), btn)
      if (info.visible && (info.type === 'button' || info.type === 'submit') && !info.text.includes('cookie')) {
        await btn.click()
        console.log(`  Fallback klik: "${info.text}"`)
        break
      }
    }
  }

  await new Promise(r => setTimeout(r, 5000))
  await page.screenshot({ path: 'iv3-step2-afterstep1.png' })
  console.log('  URL na stap 1:', page.url().slice(0, 100))

  // Check for password field
  let pwField = await page.$('input[name="pf.pass"]')
  if (!pwField) pwField = await page.$('input[type="password"]')
  if (pwField) {
    const isVisible = await page.evaluate(el => el.offsetParent !== null, pwField)
    console.log(`  Password veld gevonden (visible: ${isVisible})`)
    if (isVisible) {
      await pwField.click({ clickCount: 3 }).catch(() => {})
      await pwField.type(creds.password, { delay: 50 })
      console.log('  Wachtwoord ingetypt')
    }
  } else {
    console.log('  GEEN wachtwoord veld!')
    // Show what's on the page now
    const afterStep1 = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        name: i.name, type: i.type, visible: i.offsetParent !== null
      }))
      return { inputs, text: document.body.innerText?.slice(0, 500) }
    })
    console.log('  Inputs nu:', JSON.stringify(afterStep1.inputs))
    console.log('  Tekst:', afterStep1.text?.slice(0, 200))
  }

  await new Promise(r => setTimeout(r, 1000))
  await page.screenshot({ path: 'iv3-step2-password.png' })

  // Submit login
  let submitBtn = await page.$('button.wk-login-submit[type="submit"]')
  if (!submitBtn) submitBtn = await page.$('button[type="submit"]')
  if (submitBtn) {
    const isVisible = await page.evaluate(el => el.offsetParent !== null, submitBtn)
    if (isVisible) {
      console.log('  Submit knop klikken...')
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          submitBtn.click()
        ])
      } catch {}
    }
  } else {
    // Try KauriForm approach
    console.log('  Probeer KauriForm submit...')
    await page.evaluate(() => {
      const form = document.getElementById('KauriForm') || document.querySelector('form')
      if (form) {
        const ok = form.querySelector('input[name="$ok"]')
        if (ok) ok.value = 'clicked'
        form.submit()
      }
    })
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  }

  await new Promise(r => setTimeout(r, 8000))
  console.log('\n  NA LOGIN URL:', page.url().slice(0, 120))
  await page.screenshot({ path: 'iv3-step3-afterlogin.png' })

  const isLoggedIn = page.url().includes('inview.nl') && !page.url().includes('login') && !page.url().includes('wolterskluwer')
  console.log(`  INGELOGD: ${isLoggedIn ? 'JA' : 'NEE'}`)

  if (!isLoggedIn) {
    console.log('\n  Login mislukt. Huidige pagina info:')
    const pageText = await page.evaluate(() => document.body.innerText?.slice(0, 500))
    console.log('  ', pageText?.slice(0, 300))

    // Try one more time with the form approach
    console.log('\n  Nieuwe poging: direct naar inloggen pagina...')
    await page.goto('https://www.inview.nl/inloggen', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 5000))
    console.log('  URL:', page.url().slice(0, 100))
    await page.screenshot({ path: 'iv3-retry-login.png' })
  }

  // === Als we ingelogd zijn: verken de site ===
  if (isLoggedIn) {
    // Accept cookies again
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button')
      for (const b of btns) {
        if ((b.textContent || '').toLowerCase().includes('accepteer alle')) {
          b.click(); return
        }
      }
    })
    await new Promise(r => setTimeout(r, 3000))

    console.log('\n=== STAP 3: Site verkennen (ingelogd) ===')

    // Navigate to search page
    await page.goto('https://www.inview.nl/zoeken', { waitUntil: 'networkidle2', timeout: 20000 })
    await new Promise(r => setTimeout(r, 5000))

    // Accept cookies
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button')
      for (const b of btns) {
        if ((b.textContent || '').toLowerCase().includes('accepteer alle')) { b.click(); return }
      }
    })
    await new Promise(r => setTimeout(r, 3000))

    await page.screenshot({ path: 'iv3-search.png' })

    const searchPageInfo = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        name: i.name, type: i.type, placeholder: i.placeholder, visible: i.offsetParent !== null, value: i.value
      }))
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 80) }))
        .filter(l => l.text.length > 3)
      return { textPreview: text.slice(0, 2000), inputs, links: links.slice(0, 30) }
    })
    console.log('Zoekpagina text:', searchPageInfo.textPreview.slice(0, 500))
    console.log('Inputs:', JSON.stringify(searchPageInfo.inputs))

    // Try the search API from the browser
    console.log('\n=== STAP 4: Search API vanuit browser ===')
    const apiTest = await page.evaluate(async () => {
      const results = {}

      // Test 1: clustered search with TvA source
      try {
        const scope = {
          query: "ontslag",
          filterTreeIds: [],
          dateRange: { from: "", until: "" },
          itemsPerPage: 10,
          sort: "date",
          itemsPerCluster: 3,
          fieldedSearchParams: {
            title: "",
            author: "",
            referenceInformation: { source: "Tijdschrift voor Arbeidsrecht", year: "", number: "" },
            ecli: "",
            caseNumber: ""
          }
        }
        const res = await fetch('/edge/clustered-search/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scope: JSON.stringify(scope) })
        })
        const text = await res.text()
        results.clusteredSearch = { status: res.status, isJson: text.startsWith('{') || text.startsWith('['), preview: text.slice(0, 1000) }
      } catch (e) {
        results.clusteredSearch = { error: e.message }
      }

      // Test 2: simple fetch of the TvA page to see rendered content
      try {
        const res = await fetch('/tijdschriften/tijdschrift-voor-arbeidsrecht', { credentials: 'include' })
        const html = await res.text()
        // Extract script tags with data
        const scriptMatch = html.match(/<script[^>]*>window\.__[A-Z_]+=([^<]+)<\/script>/)
        results.tvaPage = {
          size: html.length,
          hasData: !!scriptMatch,
          dataPreview: scriptMatch ? scriptMatch[1].slice(0, 500) : null
        }
      } catch (e) {
        results.tvaPage = { error: e.message }
      }

      // Test 3: check if there's a GraphQL endpoint
      try {
        const res = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query: '{ __schema { types { name } } }' })
        })
        const text = await res.text()
        results.graphql = { status: res.status, preview: text.slice(0, 300) }
      } catch (e) {
        results.graphql = { error: e.message }
      }

      // Test 4: check /edge/user or /edge/me to verify auth
      try {
        const res = await fetch('/edge/user', { credentials: 'include' })
        const text = await res.text()
        results.user = { status: res.status, isJson: text.startsWith('{'), preview: text.slice(0, 300) }
      } catch (e) {
        results.user = { error: e.message }
      }

      return results
    })

    for (const [key, val] of Object.entries(apiTest)) {
      console.log(`\n  ${key}:`, JSON.stringify(val).slice(0, 500))
    }

    // Navigate to TvA page and wait for dynamic content
    console.log('\n=== STAP 5: TvA pagina met volledig laden ===')
    await page.goto('https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht', {
      waitUntil: 'networkidle0', timeout: 30000
    })
    await new Promise(r => setTimeout(r, 8000)) // Extra lang wachten voor SPA

    await page.screenshot({ path: 'iv3-tva-page.png' })

    const tvaContent = await page.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 100) }))
        .filter(l => l.text.length > 3 && l.href.includes('inview.nl'))
      return {
        textLength: text.length,
        textPreview: text.slice(0, 3000),
        navHasInloggen: text.includes('Inloggen'),
        links: links.slice(0, 40),
        docLinks: links.filter(l => l.href.includes('/document/')),
      }
    })

    console.log(`  Text (${tvaContent.textLength} chars)`)
    console.log(`  Nog steeds "Inloggen" in nav: ${tvaContent.navHasInloggen}`)
    console.log(`  Preview: ${tvaContent.textPreview.slice(0, 800)}`)
    console.log(`\n  Document links (${tvaContent.docLinks.length}):`)
    for (const l of tvaContent.docLinks.slice(0, 15)) {
      console.log(`    ${l.text.slice(0, 60)} -> ${l.href.slice(0, 100)}`)
    }
  }

  // Print all intercepted API responses
  console.log('\n=== ALLE INTERCEPTED API RESPONSES ===')
  for (const r of allRequests) {
    console.log(`  [${r.status}] ${r.url}`)
    if (r.bodyPreview && !r.bodyPreview.startsWith('<!doctype')) {
      console.log(`    ${r.bodyPreview.slice(0, 300)}`)
    }
  }

  await browser.close()
  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
