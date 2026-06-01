/**
 * VAAN AR Updates — Deep Crawler
 * Haalt ALLE uitspraken op uit de VAAN catalogus
 *
 * Gebruik: node scripts/crawl-vaan-deep.js
 *
 * Stappen:
 * 1. Log in bij VAAN
 * 2. Navigeer naar catalogus
 * 3. Ontdek alle artikellinks (paginering/scroll/load more)
 * 4. Bezoek elk artikel en extraheer content
 * 5. Sla alles op als chunks + embeddings
 */

const fs = require('fs')
const path = require('path')

function loadEnv(f) {
  try {
    for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = l.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'")) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}
loadEnv(path.join(__dirname, '..', '.env.local'))
loadEnv(path.join(__dirname, '..', '.env'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SOURCE_ID = 'cmlcq12aj0001jmy15c7x98if'
const VAAN_URL = 'https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus'

async function generateEmbeddingsBatch(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts.map(t => t.slice(0, 32000)),
      dimensions: 1536,
    }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI fout (${response.status}): ${error}`)
  }
  const data = await response.json()
  return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding)
}

async function main() {
  const source = await prisma.aISource.findUnique({ where: { id: SOURCE_ID } })
  if (!source) { console.error('VAAN bron niet gevonden'); process.exit(1) }

  const creds = JSON.parse(source.credentials || '{}')
  if (!creds.email || !creds.password) { console.error('Geen credentials'); process.exit(1) }

  console.log('=== VAAN Deep Crawler ===\n')

  const puppeteer = require('puppeteer-core')
  const chromePath = process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome'

  console.log('Chrome starten...')
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    // === STAP 1: LOGIN ===
    console.log('Stap 1: Navigeren naar VAAN...')
    await page.goto(VAAN_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 3000))

    // Check if we need to login
    const needsLogin = await page.evaluate(() => {
      const text = (document.body.textContent || '').toLowerCase()
      const hasLoginInput = !!document.querySelector('a[href*="login"], input[type="email"], input[type="password"]')
      const hasLoginText = text.includes('inloggen') || text.includes('log in') || text.includes('login')
      return hasLoginInput || hasLoginText
    })

    if (needsLogin) {
      console.log('Login nodig...')

      // Look for login link/button
      const loginLink = await page.$('a[href*="login"], a[href*="inloggen"]')
      if (loginLink) {
        await loginLink.click()
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 3000))
      }

      // Fill email
      const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], input[id="username"]')
      if (emailInput) {
        await emailInput.click({ clickCount: 3 })
        await emailInput.type(creds.email, { delay: 30 })
        console.log(`  Email: ${creds.email}`)

        // Check if multi-step (no password visible yet)
        const pwVisible = await page.$('input[type="password"]')
        if (!pwVisible) {
          const nextBtn = await page.$('button[type="submit"], input[type="submit"]')
          if (nextBtn) {
            await nextBtn.click()
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
            await new Promise(r => setTimeout(r, 3000))
          }
        }
      }

      // Fill password
      const pwInput = await page.$('input[type="password"]')
      if (pwInput) {
        await pwInput.click({ clickCount: 3 })
        await pwInput.type(creds.password, { delay: 30 })
        console.log('  Wachtwoord ingevuld')

        const submitBtn = await page.$('button[type="submit"], input[type="submit"]')
        if (submitBtn) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
            submitBtn.click(),
          ])
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      console.log(`  URL na login: ${page.url()}`)
    }

    // Navigate back to catalogus if needed
    if (!page.url().includes('catalogus')) {
      await page.goto(VAAN_URL, { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise(r => setTimeout(r, 3000))
    }

    // === STAP 2: ONTDEK ALLE ARTIKELLINKS ===
    console.log('\nStap 2: Artikelen ontdekken...')

    // Take screenshot for debugging
    await page.screenshot({ path: path.join(__dirname, '..', 'crawl-vaan-catalogus.png'), fullPage: false }).catch(() => {})

    // Log what we see
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      bodyLength: document.body.textContent.length,
      linkCount: document.querySelectorAll('a[href]').length,
      hasNextBtn: !!document.querySelector('[class*="next"], [class*="volgende"], [aria-label*="next"]'),
      hasLoadMore: !!document.querySelector('[class*="load-more"], [class*="loadmore"]'),
    }))
    console.log(`  Pagina: ${pageInfo.title}`)
    console.log(`  Links op pagina: ${pageInfo.linkCount}`)
    console.log(`  Heeft "volgende" knop: ${pageInfo.hasNextBtn}`)
    console.log(`  Heeft "meer laden" knop: ${pageInfo.hasLoadMore}`)

    // Collect all article links — scroll and paginate until we find no new links
    const allLinks = new Map() // url -> title

    async function collectLinks() {
      const links = await page.evaluate(() => {
        const found = []
        const allA = Array.from(document.querySelectorAll('a[href]'))
        for (const a of allA) {
          const href = a.href
          const text = (a.textContent || '').trim()
          if (!href || href.includes('#') || href.includes('login')) continue
          if (href.match(/\.(css|js|png|jpg|gif|svg|ico|pdf|zip)$/i)) continue

          // VAAN article patterns
          const isArticle =
            href.includes('/ar-updates/') && !href.includes('/catalogus') && !href.includes('/redactie') && !href.includes('/hoe') && !href.includes('/contact') && !href.includes('/annotatoren') && !href.includes('/podcasts') ||
            href.includes('/rechtspraak/') && href.match(/\/[a-z]+-\d+/) ||
            href.match(/ar-updates\/[a-f0-9-]{20,}/) ||
            (text.length > 15 && (href.includes('update') || href.includes('uitspraak') || href.includes('annotatie')))

          if (isArticle && text.length > 5) {
            found.push({ url: href, title: text.substring(0, 250) })
          }
        }
        return found
      })
      let newCount = 0
      for (const link of links) {
        if (!allLinks.has(link.url)) {
          allLinks.set(link.url, link.title)
          newCount++
        }
      }
      return newCount
    }

    // First collection
    let newLinks = await collectLinks()
    console.log(`  Eerste scan: ${allLinks.size} artikelen gevonden`)

    // Try scrolling to load more content
    let scrollAttempts = 0
    let prevSize = 0
    while (scrollAttempts < 50) {
      prevSize = allLinks.size

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await new Promise(r => setTimeout(r, 2000))

      // Try clicking "load more" or "next" buttons
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'))
        for (const btn of btns) {
          const text = (btn.textContent || '').toLowerCase().trim()
          if (text.includes('meer laden') || text.includes('load more') || text.includes('toon meer') ||
              text.includes('volgende') || text.includes('next') || text === '>' || text === '→') {
            btn.click()
            return text
          }
        }
        // Also try numbered pagination
        const pageLinks = document.querySelectorAll('[class*="pagination"] a, [class*="pager"] a, nav a')
        for (const pl of pageLinks) {
          const num = parseInt(pl.textContent)
          if (num > 1 && !pl.classList.contains('active') && !pl.getAttribute('aria-current')) {
            pl.click()
            return `pagina ${num}`
          }
        }
        return null
      })

      if (clicked) {
        console.log(`  Klik: "${clicked}" — wachten...`)
        await new Promise(r => setTimeout(r, 3000))
      }

      newLinks = await collectLinks()

      if (allLinks.size === prevSize) {
        scrollAttempts++
        if (scrollAttempts > 5 && allLinks.size === prevSize) break // No new content after 5 attempts
      } else {
        scrollAttempts = 0 // Reset counter when we find new links
        console.log(`  ${allLinks.size} artikelen gevonden (+${allLinks.size - prevSize})`)
      }
    }

    // Also try navigating to different sections/pages
    // Check for category filters or year selectors
    const filterLinks = await page.evaluate(() => {
      const links = []
      const allA = Array.from(document.querySelectorAll('a[href]'))
      for (const a of allA) {
        const href = a.href
        if (href.includes('catalogus') && href !== location.href && !href.includes('#')) {
          links.push(href)
        }
        // Year-based or category filters
        if (href.match(/20\d{2}/) || href.includes('jaar=') || href.includes('year=') || href.includes('page=')) {
          links.push(href)
        }
      }
      return [...new Set(links)]
    })

    if (filterLinks.length > 0) {
      console.log(`  ${filterLinks.length} filter/pagina links gevonden, doorlopen...`)
      for (const fLink of filterLinks) {
        try {
          await page.goto(fLink, { waitUntil: 'networkidle2', timeout: 20000 })
          await new Promise(r => setTimeout(r, 2000))
          const found = await collectLinks()
          if (found > 0) console.log(`  ${fLink.slice(-40)}: +${found} artikelen (totaal: ${allLinks.size})`)
        } catch {}
      }
    }

    console.log(`\n  TOTAAL: ${allLinks.size} unieke artikelen gevonden`)

    if (allLinks.size === 0) {
      console.log('\n  Geen artikelen gevonden! Debug info:')
      const html = await page.content()
      fs.writeFileSync(path.join(__dirname, '..', 'crawl-vaan-debug.html'), html)
      console.log('  HTML opgeslagen als crawl-vaan-debug.html')
      await browser.close()
      await prisma.$disconnect()
      return
    }

    // === STAP 3: BEZOEK ALLE ARTIKELEN ===
    console.log('\nStap 3: Artikelen ophalen...')
    const articles = []
    const linkList = Array.from(allLinks.entries())

    for (let i = 0; i < linkList.length; i++) {
      const [url, title] = linkList[i]
      if (i % 10 === 0 || i === linkList.length - 1) {
        console.log(`  ${i + 1}/${linkList.length}: ${title.slice(0, 60)}...`)
      }

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
        await new Promise(r => setTimeout(r, 1000))

        const content = await page.evaluate(() => {
          const selectors = ['article', '[role="article"]', '.article-content', '.content-body', '.document-content', 'main', '[role="main"]', '.content']
          let el = null
          for (const s of selectors) {
            el = document.querySelector(s)
            if (el && el.textContent && el.textContent.trim().length > 200) break
          }
          if (!el) el = document.body

          const clone = el.cloneNode(true)
          const remove = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.sidebar', '.menu', '.navigation', '.cookie', '.ad']
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
            url,
            title: content.title || title,
            content: content.content.slice(0, 50000), // Max 50K per article
          })
        }
      } catch {
        // Skip failed articles
      }

      // Small delay to not overload the server
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 500))
    }

    await browser.close()

    console.log(`\n  ${articles.length} artikelen opgehaald`)
    const totalChars = articles.reduce((s, a) => s + a.content.length, 0)
    console.log(`  ${totalChars.toLocaleString()} tekens totaal`)

    if (articles.length === 0) {
      console.log('Geen artikelen opgehaald')
      await prisma.$disconnect()
      return
    }

    // === STAP 4: OPSLAAN ===
    console.log('\nStap 4: Content opslaan...')
    const rawContent = articles
      .map(a => `[${a.title}]\nURL: ${a.url}\n\n${a.content}`)
      .join('\n\n---\n\n')

    await prisma.aISource.update({
      where: { id: SOURCE_ID },
      data: {
        content: rawContent,
        pagesCrawled: articles.length,
        lastSynced: new Date(),
        isProcessed: true,
        processedAt: new Date(),
      },
    })
    console.log(`  ${rawContent.length.toLocaleString()} tekens opgeslagen`)

    // === STAP 5: CHUNKEN ===
    console.log('\nStap 5: Chunks aanmaken...')
    await prisma.sourceChunk.deleteMany({ where: { sourceId: SOURCE_ID } })

    const CHUNK_SIZE = 5000
    const headingPattern = /^(#{1,4}\s|Artikel\s+\d|Art\.\s*\d|\[.{5,}\]$|AR-\d{4}-\d+|ECLI:|URL:)/
    const chunks = []
    const lines = rawContent.split('\n')
    let cur = '', heading = null

    for (const line of lines) {
      const isH = headingPattern.test(line.trim())
      if (isH && cur.length > CHUNK_SIZE * 0.3) {
        if (cur.trim()) chunks.push({ content: cur.trim(), heading })
        cur = line + '\n'; heading = line.trim().slice(0, 200); continue
      }
      cur += line + '\n'
      if (cur.length >= CHUNK_SIZE) {
        const lp = cur.lastIndexOf('\n\n', CHUNK_SIZE)
        const ls = cur.lastIndexOf('. ', CHUNK_SIZE)
        const sp = lp > CHUNK_SIZE * 0.5 ? lp : ls > CHUNK_SIZE * 0.5 ? ls + 2 : CHUNK_SIZE
        chunks.push({ content: cur.slice(0, sp).trim(), heading })
        cur = cur.slice(sp).trim() + '\n'
      }
    }
    if (cur.trim()) chunks.push({ content: cur.trim(), heading })

    // Batch insert
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100)
      await prisma.sourceChunk.createMany({
        data: batch.map((c, idx) => ({
          sourceId: SOURCE_ID,
          chunkIndex: i + idx,
          content: c.content,
          heading: c.heading || null,
        }))
      })
    }
    console.log(`  ${chunks.length} chunks aangemaakt`)

    // === STAP 6: EMBEDDINGS ===
    if (process.env.OPENAI_API_KEY) {
      console.log('\nStap 6: Embeddings genereren...')
      const chunkRows = await prisma.sourceChunk.findMany({
        where: { sourceId: SOURCE_ID },
        select: { id: true, content: true, heading: true },
        orderBy: { chunkIndex: 'asc' },
      })

      let embedded = 0
      for (let i = 0; i < chunkRows.length; i += 50) {
        const batch = chunkRows.slice(i, i + 50)
        const texts = batch.map(c => c.heading ? `${c.heading}\n\n${c.content}` : c.content)

        try {
          const embeddings = await generateEmbeddingsBatch(texts)
          for (let j = 0; j < batch.length; j++) {
            const embStr = `[${embeddings[j].join(',')}]`
            await prisma.$executeRawUnsafe(
              `UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`,
              embStr, batch[j].id
            )
          }
          embedded += batch.length
          console.log(`  ${embedded}/${chunkRows.length} embeddings`)
        } catch (err) {
          if (err.message.includes('429')) {
            console.log('  Rate limit — 30s wachten...')
            await new Promise(r => setTimeout(r, 30000))
            i -= 50
            continue
          }
          console.error(`  Fout: ${err.message}`)
        }

        if (i + 50 < chunkRows.length) await new Promise(r => setTimeout(r, 500))
      }
      console.log(`  ${embedded} embeddings klaar`)
    }

    console.log(`\n=== KLAAR ===`)
    console.log(`Artikelen: ${articles.length}`)
    console.log(`Content: ${rawContent.length.toLocaleString()} tekens`)
    console.log(`Chunks: ${chunks.length}`)
    console.log(`Klaar voor semantic search in de AI Assistent`)

  } catch (err) {
    console.error('FOUT:', err)
    await browser.close().catch(() => {})
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
