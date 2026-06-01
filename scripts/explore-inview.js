/**
 * Quick script to explore InView after login and find correct content URLs
 */
const fs = require('fs')
function loadEnv(fp) {
  try {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx === -1) continue
      const key = line.substring(0, idx).trim()
      let val = line.substring(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1)
      if (key) process.env[key] = val
    }
  } catch {}
}
loadEnv('.env')
loadEnv('.env.local')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const puppeteer = require('puppeteer-core')

async function explore() {
  const source = await prisma.aISource.findFirst({ where: { name: { contains: 'Tijdschrift' } } })
  const creds = JSON.parse(source.credentials)

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  // Go to login
  console.log('Navigating to InView login...')
  await page.goto('https://www.inview.nl/inloggen', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  // Accept cookies using Puppeteer click
  const cookieBtn = await page.$('button')
  const allBtns = await page.$$('button, a')
  for (const btn of allBtns) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (text.includes('accepteer alle')) {
      await btn.click()
      console.log('Cookies accepted')
      await new Promise(r => setTimeout(r, 1000))
      break
    }
  }

  // Click Inloggen button
  const loginBtns = await page.$$('a, button')
  for (const btn of loginBtns) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (text === 'inloggen') {
      await btn.click()
      console.log('Clicked Inloggen')
      break
    }
  }
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 3000))
  console.log('SSO page:', page.url().substring(0, 80))

  // Type username
  const usernameField = await page.$('input[name="pf.username"]')
  if (usernameField) {
    await usernameField.click({ clickCount: 3 }).catch(() => {})
    await usernameField.type(creds.email, { delay: 30 })
    console.log('Username typed')
  }
  await new Promise(r => setTimeout(r, 500))

  // Click step 1 button
  const step1Btn = await page.$('button.wk-login-submit[type="button"]')
  if (step1Btn) {
    await step1Btn.click()
    console.log('Step 1 clicked')
  }
  await new Promise(r => setTimeout(r, 3000))

  // Type password
  const pwField = await page.$('input[name="pf.pass"]')
  if (pwField) {
    await pwField.click({ clickCount: 3 }).catch(() => {})
    await pwField.type(creds.password, { delay: 30 })
    console.log('Password typed')
  }
  await new Promise(r => setTimeout(r, 500))

  // Submit via form
  await page.evaluate(() => {
    const form = document.getElementById('KauriForm')
    if (form) {
      const ok = form.querySelector('input[name="$ok"]')
      if (ok) ok.value = 'clicked'
      form.submit()
    }
  })
  console.log('Form submitted')

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 5000))
  console.log('After login:', page.url().substring(0, 80))

  // Accept cookies again
  const cookieBtns2 = await page.$$('button, a')
  for (const btn of cookieBtns2) {
    const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
    if (text.includes('accepteer alle')) {
      await btn.click()
      console.log('Cookies accepted again')
      await new Promise(r => setTimeout(r, 1000))
      break
    }
  }

  // Navigate to homepage
  console.log('\n--- HOMEPAGE ---')
  await page.goto('https://www.inview.nl/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  console.log('Title:', await page.title())
  await page.screenshot({ path: 'crawl-explore-home.png', fullPage: false })

  // Get all links
  const homeLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 100) }))
      .filter(l => l.text.length > 3 && l.href.includes('inview.nl') && !l.href.includes('#'))
  })
  console.log(`${homeLinks.length} links found:`)
  for (const l of homeLinks.slice(0, 30)) {
    console.log(`  ${l.text.substring(0, 50)} -> ${l.href}`)
  }

  // Try specific paths
  const paths = ['/browse', '/tijdschriften', '/publicaties', '/search', '/collectie', '/content']
  for (const path of paths) {
    try {
      console.log(`\n--- ${path} ---`)
      await page.goto('https://www.inview.nl' + path, { waitUntil: 'networkidle2', timeout: 15000 })
      await new Promise(r => setTimeout(r, 2000))
      const title = await page.title()
      const url = page.url()
      console.log(`Title: ${title}`)
      console.log(`URL: ${url}`)

      if (url.includes('inview.nl')) {
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]'))
            .slice(0, 15)
            .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }))
            .filter(l => l.text.length > 5)
        })
        for (const l of links) console.log(`  ${l.text.substring(0, 50)} -> ${l.href}`)
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
    }
  }

  // Try searching for "arbeidsrecht"
  console.log('\n--- SEARCH: arbeidsrecht ---')
  try {
    await page.goto('https://www.inview.nl/search?q=arbeidsrecht', { waitUntil: 'networkidle2', timeout: 15000 })
    await new Promise(r => setTimeout(r, 3000))
    console.log('Title:', await page.title())
    console.log('URL:', page.url())
    await page.screenshot({ path: 'crawl-explore-search.png', fullPage: false })

    const searchLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 100) }))
        .filter(l => l.text.length > 10 && l.href.includes('inview.nl'))
    })
    console.log(`${searchLinks.length} search results:`)
    for (const l of searchLinks.slice(0, 20)) {
      console.log(`  ${l.text.substring(0, 60)} -> ${l.href}`)
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`)
  }

  // Try the nav items
  console.log('\n--- NAV ITEMS ---')
  const navLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav a, header a, [class*="nav"] a, [class*="menu"] a'))
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }))
      .filter(l => l.text.length > 2)
  })
  for (const l of navLinks) {
    console.log(`  ${l.text} -> ${l.href}`)
  }

  await browser.close()
  await prisma[String.fromCharCode(36) + 'disconnect']()
}

explore().catch(e => console.error('FATAL:', e.message))
