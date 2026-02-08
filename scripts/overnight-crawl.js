/**
 * Overnight Crawl Agent
 * Crawls VAAN AR Updates, InView Arbeidsrecht, and InView RAR
 * Uses the browser agent API to authenticate and fetch articles
 * Then processes everything with Claude
 *
 * Run: node scripts/overnight-crawl.js
 */

const fs = require('fs')
const http = require('http')

// Load env
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
const USER_ID = 'cml1u6k0700034ehqar3klcr5'

const KNOWLEDGE_PROMPT = `Je bent een juridisch kennissysteem voor Workx Advocaten (arbeidsrecht, Amsterdam).

Verwerk de volgende tekst tot een gestructureerde kennissamenvatting. Gebruik deze structuur:

## Wetsartikelen & Regelgeving
- Exacte artikelnummers en inhoud

## Rechtspraak
- ECLI-nummers, datum, rechtsregel, kernbeslissing

## Juridische Principes
- Vuistregels, berekeningswijzen, termijnen

## Praktijktips
- Concrete tips voor arbeidsrechtadvocaten

Schrijf in het Nederlands. Wees uitgebreid maar gestructureerd. Focus op arbeidsrecht.`

async function crawlWithBrowser(source) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`CRAWL: ${source.name}`)
  console.log(`URL: ${source.url}`)
  console.log(`${'='.repeat(60)}`)

  const creds = source.credentials ? JSON.parse(source.credentials) : null
  if (!creds || !creds.email) {
    console.log('  Geen credentials — skip')
    return
  }

  // Use puppeteer-core directly (since we're a script, not going through the API)
  const puppeteer = require('puppeteer-core')

  const chromePath = process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome'

  console.log('  Chrome starten...')
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  try {
    const isInView = source.url.includes('inview.nl')

    // Navigate to URL
    console.log(`  Navigeren naar ${source.url}...`)
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000)) // Wait for SPA to render

    // Try to find login
    console.log('  Login zoeken...')

    if (isInView) {
      // InView login via Wolters Kluwer PingFederate SSO
      // The flow: accept cookies → SSO URL → username → step1 button → password → submit → redirect
      console.log('  InView gedetecteerd — Wolters Kluwer SSO login flow...')

      // Helper: accept cookie banner using Puppeteer native clicks (not evaluate)
      async function acceptCookies() {
        try {
          const allBtns = await page.$$('button, a')
          for (const btn of allBtns) {
            const text = await page.evaluate(el => (el.textContent || '').toLowerCase().trim(), btn)
            if (text.includes('accepteer alle') || text === 'accept all cookies') {
              await btn.click().catch(() => {})
              console.log(`  Cookies geaccepteerd: "${text}"`)
              await new Promise(r => setTimeout(r, 2000))
              return true
            }
          }
        } catch {}
        return false
      }

      // Step 1: Go to InView homepage first to accept cookies (needed for session)
      console.log('  Stap 1: Cookies accepteren op InView...')
      await page.goto('https://www.inview.nl/', { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise(r => setTimeout(r, 2000))
      await acceptCookies()

      // Step 2: Use direct SSO login URL (more reliable than clicking SPA buttons)
      const redirectUrl = encodeURIComponent(source.url)
      const ssoUrl = `https://www.inview.nl/.sso/login?redirect_uri=${redirectUrl}`
      console.log(`  Stap 2: SSO login URL...`)
      await page.goto(ssoUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise(r => setTimeout(r, 3000))
      console.log(`  Huidige URL: ${page.url().substring(0, 100)}...`)

      const isOnSSO = page.url().includes('login.wolterskluwer')
      if (isOnSSO) {
        console.log('  Op Wolters Kluwer SSO pagina')

        // Step 3: Type username (password field is hidden in step 1)
        const usernameField = await page.$('input[name="pf.username"]')
        if (usernameField) {
          await usernameField.click({ clickCount: 3 }).catch(() => {})
          await usernameField.type(creds.email, { delay: 30 })
          console.log(`  Username getypt: ${creds.email}`)
        } else {
          console.log('  FOUT: Geen pf.username veld!')
        }

        // Step 4: Click first "Inloggen" button (type=button) to reveal password
        console.log('  Stap 4: Username submitten...')
        const step1Btn = await page.$('button.wk-login-submit[type="button"]')
        if (step1Btn) {
          await step1Btn.click()
          console.log('  Step 1 button geklikt')
        } else {
          // Fallback: press Enter
          await page.keyboard.press('Enter')
          console.log('  Enter gedrukt als fallback')
        }

        // Wait for password field to become visible
        await new Promise(r => setTimeout(r, 3000))
        const pwVisible = await page.evaluate(() => {
          const pw = document.querySelector('input[name="pf.pass"]')
          return pw ? pw.offsetParent !== null : false
        })
        console.log(`  Wachtwoord veld zichtbaar: ${pwVisible}`)

        // Step 5: Type password
        if (pwVisible) {
          const passwordField = await page.$('input[name="pf.pass"]')
          if (passwordField) {
            await passwordField.click().catch(() => {})
            await passwordField.type(creds.password, { delay: 30 })
            console.log('  Password getypt')
          }

          await new Promise(r => setTimeout(r, 500))

          // Step 6: Click actual submit button (NOT form.submit() — that skips JS handlers)
          console.log('  Stap 6: Login submitten...')
          const submitBtn = await page.$('button.wk-login-submit[type="submit"]')
          if (submitBtn) {
            // Use Promise.all to wait for navigation triggered by click
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              submitBtn.click()
            ])
            console.log('  Submit button geklikt')
          } else {
            // Fallback: press Enter in password field
            console.log('  Geen submit button, Enter drukken...')
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              page.keyboard.press('Enter')
            ])
          }

          await new Promise(r => setTimeout(r, 5000))
          console.log(`  URL na login: ${page.url().substring(0, 100)}`)

          // Take screenshot
          try {
            await page.screenshot({ path: 'crawl-debug-sso-after.png', fullPage: false })
          } catch {}
        } else {
          console.log('  FOUT: Wachtwoord veld niet zichtbaar na stap 1')
          try { await page.screenshot({ path: 'crawl-debug-sso-nopw.png', fullPage: false }) } catch {}
        }

        // Check login success
        if (page.url().includes('inview.nl')) {
          console.log('  LOGIN GESLAAGD!')
          await acceptCookies()
        } else {
          console.log('  LOGIN MISLUKT — nog op SSO pagina')
        }
      } else if (page.url().includes('inview.nl')) {
        console.log('  Al ingelogd of direct doorgestuurd naar InView')
        await acceptCookies()
      } else {
        console.log(`  Onverwachte URL: ${page.url()}`)
      }

      // Step 7: Navigate to content page
      // If source URL is a dead document link, try the homepage instead
      const contentUrl = page.url().includes('inview.nl') && !page.url().includes('inloggen')
        ? page.url()  // Already on a content page (redirect worked)
        : source.url
      if (contentUrl !== page.url()) {
        console.log(`  Navigeren naar content: ${contentUrl.substring(0, 80)}...`)
        await page.goto(contentUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        await new Promise(r => setTimeout(r, 3000))
      }

      // Check if the page exists
      const pageExists = await page.evaluate(() => {
        const text = document.body?.textContent || ''
        return !text.includes('bestaat niet (meer)') && !text.includes('not found')
      })

      if (!pageExists) {
        console.log('  Pagina bestaat niet meer, fallback naar homepage...')
        // Use InView homepage to find recent arbeidsrecht content
        const isArbeidsrecht = source.name.toLowerCase().includes('arbeidsrecht') || source.name.toLowerCase().includes('rar')
        const fallbackUrl = isArbeidsrecht
          ? 'https://www.inview.nl/uitspraken'
          : 'https://www.inview.nl/'
        await page.goto(fallbackUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        await new Promise(r => setTimeout(r, 3000))
        await acceptCookies()
        console.log(`  Fallback pagina: ${page.url()}`)
      }

      console.log(`  Huidige URL: ${page.url()}`)
    } else {
      // Generic login flow for other sites
      const loginLink = await page.$('a[href*="login"], a[href*="signin"], a[href*="inloggen"]')
      if (loginLink) {
        console.log('  Login link gevonden, klikken...')
        await loginLink.click()
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 3000))
      }

      // Fill email
      const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], input[id="username"]')
      if (emailInput) {
        console.log(`  Email invoeren: ${creds.email}`)
        await emailInput.click({ clickCount: 3 })
        await emailInput.type(creds.email, { delay: 50 })

        const nextBtn = await page.$('button[type="submit"], input[type="submit"]')
        const pwInput = await page.$('input[type="password"]')
        if (nextBtn && !pwInput) {
          await nextBtn.click()
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      // Fill password
      const pwInput = await page.$('input[type="password"]')
      if (pwInput) {
        console.log('  Wachtwoord invoeren...')
        await pwInput.click({ clickCount: 3 })
        await pwInput.type(creds.password, { delay: 50 })

        const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
        if (submitBtn) {
          console.log('  Inloggen...')
          await submitBtn.click()
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      console.log(`  Huidige URL na login: ${page.url()}`)

      if (page.url() !== source.url) {
        console.log(`  Terug naar ${source.url}...`)
        await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 })
      }
    }

    // Extract article links
    console.log('  Artikelen zoeken...')

    // Take a screenshot for debugging if headless
    try {
      await page.screenshot({ path: `crawl-debug-${source.id}.png`, fullPage: false })
      console.log(`  Debug screenshot opgeslagen: crawl-debug-${source.id}.png`)
    } catch { /* ignore */ }

    // Log page title and some content for debugging
    const pageTitle = await page.title()
    const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 200) || '')
    console.log(`  Pagina titel: ${pageTitle}`)
    console.log(`  Eerste tekst: ${bodyText.substring(0, 100)}...`)

    const links = await page.evaluate((isInViewSite) => {
      const found = []
      const seen = new Set()
      const allLinks = Array.from(document.querySelectorAll('a[href]'))

      for (const link of allLinks) {
        const href = link.href
        const text = (link.textContent || '').trim()
        if (!href || seen.has(href)) continue
        if (href.includes('login') || href.includes('account') || href.includes('#')) continue
        if (href.match(/\.(css|js|png|jpg|gif|svg|ico|pdf|zip)$/i)) continue

        if (isInViewSite) {
          // InView-specific: look for document/content links
          if (text.length > 10 && (
            href.includes('/document/') || href.includes('/tijdschrift') ||
            href.includes('/rechtspraak') || href.includes('/annotatie') ||
            href.includes('/artikel') || href.includes('/publicatie') ||
            href.includes('/aflevering') || href.includes('/rar-') ||
            href.includes('/ar-') || href.includes('/id') ||
            text.length > 25
          )) {
            seen.add(href)
            found.push({ url: href, title: text.substring(0, 200) })
          }
        } else {
          // Generic article detection
          if (text.length > 15 && (
            href.includes('artikel') || href.includes('document') || href.includes('content') ||
            href.includes('detail') || href.includes('update') || href.includes('uitspraak') ||
            href.includes('/ar-') || href.includes('annotatie') || href.includes('publicatie') ||
            text.length > 30
          )) {
            seen.add(href)
            found.push({ url: href, title: text.substring(0, 200) })
          }
        }
      }
      return found
    }, isInView)

    console.log(`  ${links.length} artikelen gevonden`)

    // Visit each article
    const articles = []
    const maxArticles = 20

    for (let i = 0; i < Math.min(links.length, maxArticles); i++) {
      const link = links[i]
      console.log(`  [${i + 1}/${Math.min(links.length, maxArticles)}] ${link.title.substring(0, 60)}...`)

      try {
        await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 20000 })

        const content = await page.evaluate(() => {
          const selectors = ['article', '[role="article"]', '.article-content', '.content-body', 'main', '.content']
          let el = null
          for (const s of selectors) {
            el = document.querySelector(s)
            if (el && el.textContent && el.textContent.trim().length > 200) break
          }
          if (!el) el = document.body

          const clone = el.cloneNode(true)
          const remove = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.sidebar', '.menu']
          for (const sel of remove) {
            clone.querySelectorAll(sel).forEach(e => e.remove())
          }

          return {
            title: document.title,
            content: (clone.textContent || '').replace(/\s+/g, ' ').trim()
          }
        })

        if (content.content.length > 200) {
          articles.push({
            url: link.url,
            title: content.title || link.title,
            content: content.content.substring(0, 30000)
          })
        }
      } catch (e) {
        console.log(`    Fout: ${e.message}`)
      }
    }

    await browser.close()

    console.log(`\n  ${articles.length} artikelen opgehaald`)
    const totalChars = articles.reduce((s, a) => s + a.content.length, 0)
    console.log(`  ${totalChars} tekens totaal`)

    if (articles.length === 0) {
      console.log('  Geen artikelen gevonden — mogelijk login mislukt')
      return
    }

    // Save raw content
    const rawContent = articles
      .map(a => `[${a.title}]\nURL: ${a.url}\n\n${a.content}`)
      .join('\n\n---\n\n')
      .substring(0, 500000)

    await prisma.aISource.update({
      where: { id: source.id },
      data: {
        content: rawContent,
        pagesCrawled: articles.length,
        lastSynced: new Date(),
      }
    })

    console.log('  Content opgeslagen in database')

    // Process with Claude
    console.log('  Claude verwerkt de kennis...')
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Split into chunks
    const chunks = []
    let remaining = rawContent
    while (remaining.length > 0) {
      if (remaining.length <= 80000) { chunks.push(remaining); break }
      let split = remaining.lastIndexOf('\n\n', 80000)
      if (split < 40000) split = remaining.lastIndexOf('. ', 80000)
      if (split < 40000) split = 80000
      chunks.push(remaining.substring(0, split))
      remaining = remaining.substring(split).trim()
    }

    const summaries = []
    for (let i = 0; i < chunks.length; i++) {
      console.log(`  Claude deel ${i + 1}/${chunks.length}...`)

      let retries = 0
      while (retries < 5) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            system: KNOWLEDGE_PROMPT,
            messages: [{ role: 'user', content: `Verwerk tekst uit "${source.name}":\n\n${chunks[i]}` }]
          })
          const text = response.content.find(b => b.type === 'text')
          if (text) {
            summaries.push(text.text)
            console.log(`    -> ${text.text.length} tekens`)
          }
          break
        } catch (e) {
          if (e.status === 429) {
            retries++
            const wait = 90 * retries
            console.log(`    Rate limit, wacht ${wait}s...`)
            await new Promise(r => setTimeout(r, wait * 1000))
          } else throw e
        }
      }

      if (i < chunks.length - 1) {
        console.log('    Wacht 75s...')
        await new Promise(r => setTimeout(r, 75000))
      }
    }

    const finalSummary = summaries.join('\n\n---\n\n')

    await prisma.aISource.update({
      where: { id: source.id },
      data: {
        summary: finalSummary,
        isProcessed: true,
        processedAt: new Date(),
      }
    })

    console.log(`  KLAAR! ${finalSummary.length} tekens kennis opgeslagen.`)

  } catch (error) {
    console.error(`  FOUT: ${error.message}`)
    await browser.close().catch(() => {})
  }
}

async function main() {
  console.log('=== OVERNIGHT CRAWL AGENT ===')
  console.log(`Start: ${new Date().toLocaleString('nl-NL')}`)
  console.log('')

  const sources = await prisma.aISource.findMany({
    where: {
      userId: USER_ID,
      type: 'website',
      isProcessed: false,
      isActive: true,
    }
  })

  console.log(`${sources.length} onverwerkte website-bronnen gevonden`)

  for (const source of sources) {
    await crawlWithBrowser(source)

    // Wait between sources for rate limits
    if (sources.indexOf(source) < sources.length - 1) {
      console.log('\nWachten 2 minuten voor volgende bron...')
      await new Promise(r => setTimeout(r, 120000))
    }
  }

  console.log(`\n=== OVERNIGHT CRAWL VOLTOOID ===`)
  console.log(`Einde: ${new Date().toLocaleString('nl-NL')}`)

  // Final status
  const allSources = await prisma.aISource.findMany({
    where: { userId: USER_ID },
    select: { name: true, isProcessed: true, summary: true }
  })
  console.log('\nStatus:')
  for (const s of allSources) {
    console.log(`  ${s.isProcessed ? '[OK]' : '[--]'} ${s.name} ${s.summary ? `(${s.summary.length} tekens)` : ''}`)
  }
}

main()
  .catch(e => console.error('FATAL:', e))
  .finally(() => prisma[String.fromCharCode(36) + 'disconnect']())
