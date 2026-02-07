import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Browser Agent — Crawl websites requiring authentication
 *
 * Uses Puppeteer (headless Chrome) to:
 * 1. Navigate to a login page and authenticate
 * 2. Navigate to the source URL
 * 3. Extract article links
 * 4. Visit each article and extract content
 * 5. Process everything with Claude
 *
 * POST body: { sourceId: string, maxArticles?: number }
 */

const KNOWLEDGE_PROMPT = `Je bent een juridisch kennissysteem. Verwerk de volgende tekst tot een gestructureerde kennissamenvatting.

Focus op:
1. Wetsartikelen met exacte nummers (art. 7:669 BW, etc.)
2. Rechtspraak: ECLI-nummers, rechtsregels, kernbeslissingen
3. Juridische principes en vuistregels
4. Berekeningen en termijnen
5. Praktijktips voor arbeidsrechtadvocaten

Schrijf in het Nederlands. Wees uitgebreid maar gestructureerd.`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { sourceId, maxArticles = 20 } = await req.json()

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is verplicht' }, { status: 400 })
  }

  const source = await prisma.aISource.findFirst({
    where: { id: sourceId, userId: session.user.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  if (!source.url) {
    return NextResponse.json({ error: 'Bron heeft geen URL' }, { status: 400 })
  }

  const creds = source.credentials ? JSON.parse(source.credentials) : null

  // Stream response as SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }

      try {
        send('status', 'Browser agent starten...')

        // Dynamic require to prevent webpack bundling
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const puppeteer = require(/* webpackIgnore: true */ 'puppeteer-core') as typeof import('puppeteer-core')

        // Find Chrome
        const chromePath = process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/google-chrome'

        send('status', 'Chrome openen...')
        const launch = puppeteer.default?.launch || puppeteer.launch
        const browser = await launch.call(puppeteer.default || puppeteer, {
          executablePath: chromePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080',
          ],
        })

        const page = await browser.newPage()
        await page.setViewport({ width: 1920, height: 1080 })
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        try {
          // Step 1: Navigate to source URL
          send('status', `Navigeren naar ${source.name}...`)
          await page.goto(source.url!, { waitUntil: 'networkidle2', timeout: 30000 })

          // Step 2: Handle authentication if credentials are provided
          if (creds?.email && creds?.password) {
            send('status', 'Inloggen...')
            const loggedIn = await attemptLogin(page, creds, send)

            if (!loggedIn) {
              send('status', 'Inloggen mislukt — probeer het opnieuw met andere gegevens')
              // Continue anyway, may still get some public content
            } else {
              send('status', 'Succesvol ingelogd!')
              // Navigate back to source URL after login
              await page.goto(source.url!, { waitUntil: 'networkidle2', timeout: 30000 })
            }
          }

          // Step 3: Extract article links from the page
          send('status', 'Artikelen zoeken...')
          const articleLinks = await extractArticleLinks(page, source.url!, maxArticles)
          send('status', `${articleLinks.length} artikelen gevonden`)

          if (articleLinks.length === 0) {
            // Try getting content from the current page itself
            const pageContent = await extractPageContent(page)
            if (pageContent.content.length > 200) {
              articleLinks.push({ url: source.url!, title: pageContent.title })
            }
          }

          // Step 4: Visit each article and extract content
          const articles: Array<{ url: string; title: string; content: string }> = []
          const limit = Math.min(articleLinks.length, maxArticles)

          for (let i = 0; i < limit; i++) {
            const link = articleLinks[i]
            send('status', `Artikel ${i + 1}/${limit}: ${link.title?.slice(0, 50) || link.url.slice(0, 50)}...`)

            try {
              await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 20000 })
              const { title, content } = await extractPageContent(page)

              if (content.length > 200) {
                articles.push({
                  url: link.url,
                  title: title || link.title || link.url,
                  content: content.slice(0, 30000),
                })
              }
            } catch {
              // Skip failed articles
            }
          }

          send('status', `${articles.length} artikelen opgehaald (${articles.reduce((s, a) => s + a.content.length, 0)} tekens)`)

          // Close browser
          await browser.close()

          if (articles.length === 0) {
            send('error', 'Geen artikelen gevonden. Mogelijk zijn de inloggegevens onjuist of de website structuur gewijzigd.')
            controller.close()
            return
          }

          // Step 5: Save raw content
          const rawContent = articles
            .map(a => `[${a.title}]\nURL: ${a.url}\n\n${a.content}`)
            .join('\n\n---\n\n')
            .slice(0, 500000)

          await prisma.aISource.update({
            where: { id: source.id },
            data: {
              content: rawContent,
              pagesCrawled: articles.length,
              lastSynced: new Date(),
            },
          })

          send('status', 'Content opgeslagen. Claude verwerkt nu de kennis...')

          // Step 6: Process with Claude
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const chunks = splitText(rawContent, 80000)
          const summaries: string[] = []

          for (let i = 0; i < chunks.length; i++) {
            send('status', `Claude verwerkt deel ${i + 1} van ${chunks.length}...`)

            const response = await client.messages.create({
              model: 'claude-sonnet-4-5-20250929',
              max_tokens: 8000,
              system: KNOWLEDGE_PROMPT,
              messages: [{
                role: 'user',
                content: `Verwerk de volgende tekst uit "${source.name}" (${source.category}):\n\n${chunks[i]}`,
              }],
            })

            const text = response.content.find(b => b.type === 'text')
            if (text && text.type === 'text') {
              summaries.push(text.text)
            }
          }

          // Step 7: Consolidate
          let finalSummary = summaries.join('\n\n---\n\n')

          if (summaries.length > 1) {
            send('status', 'Kennis consolideren...')
            try {
              const consolidation = await client.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8000,
                system: KNOWLEDGE_PROMPT,
                messages: [{
                  role: 'user',
                  content: `Consolideer de volgende ${summaries.length} deelsamenvatting(en) van "${source.name}" tot één samenhangende kennissamenvatting:\n\n${finalSummary}`,
                }],
              })
              const text = consolidation.content.find(b => b.type === 'text')
              if (text && text.type === 'text') {
                finalSummary = text.text
              }
            } catch {
              // Keep concatenated summaries
            }
          }

          // Step 8: Save
          await prisma.aISource.update({
            where: { id: source.id },
            data: {
              summary: finalSummary,
              isProcessed: true,
              processedAt: new Date(),
            },
          })

          send('status', `Voltooid! ${articles.length} artikelen verwerkt, ${finalSummary.length} tekens kennis opgeslagen.`)
          send('result', JSON.stringify({
            articlesProcessed: articles.length,
            totalChars: rawContent.length,
            summaryLength: finalSummary.length,
            preview: finalSummary.slice(0, 300),
          }))
          send('done', '')
        } catch (error) {
          await browser.close()
          throw error
        }
      } catch (error) {
        console.error('Browser agent error:', error)
        send('error', 'Agent fout: ' + (error instanceof Error ? error.message : 'Onbekende fout'))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Attempt login on common patterns (Boom/InView OIDC, generic forms)
 */
async function attemptLogin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  creds: { email?: string; password?: string },
  send: (event: string, data: string) => void
): Promise<boolean> {
  const currentUrl = page.url()

  try {
    // Check if we're on a login page or need to navigate to one
    // Look for login links/buttons
    const loginLink = await page.$('a[href*="login"], a[href*="signin"], a[href*="inloggen"], button:has-text("Inloggen"), a:has-text("Inloggen"), a:has-text("Log in")')

    if (loginLink) {
      send('status', 'Login pagina gevonden, klikken...')
      await loginLink.click()
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
      await new Promise(r => setTimeout(r, 2000))
    }

    // Now try to find and fill in login form
    // Strategy 1: Boom account / OIDC (InView, VAAN)
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], input[id="username"], input[name="login"]')
    const passwordInput = await page.$('input[type="password"], input[name="password"]')

    if (emailInput && creds.email) {
      send('status', 'E-mail invoeren...')
      await emailInput.click({ clickCount: 3 })
      await emailInput.type(creds.email, { delay: 50 })

      // Some forms show password after email (multi-step login)
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Volgende"), button:has-text("Next"), button:has-text("Doorgaan")')
      if (submitBtn && !passwordInput) {
        await submitBtn.click()
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    // Fill password
    const pwInput = await page.$('input[type="password"], input[name="password"]')
    if (pwInput && creds.password) {
      send('status', 'Wachtwoord invoeren...')
      await pwInput.click({ clickCount: 3 })
      await pwInput.type(creds.password, { delay: 50 })

      // Submit
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Inloggen"), button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")')
      if (submitBtn) {
        send('status', 'Inloggen...')
        await submitBtn.click()
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    // Verify we're logged in (URL changed or no login form visible)
    const stillHasLogin = await page.$('input[type="password"]')
    const urlChanged = page.url() !== currentUrl

    return !stillHasLogin || urlChanged
  } catch (error) {
    console.error('Login attempt failed:', error)
    return false
  }
}

/**
 * Extract article links from a page
 */
async function extractArticleLinks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  baseUrl: string,
  maxLinks: number
): Promise<Array<{ url: string; title: string }>> {
  const baseHost = new URL(baseUrl).hostname

  return page.evaluate((host: string, max: number) => {
    const links: Array<{ url: string; title: string }> = []
    const seen = new Set<string>()

    // Look for article-like links
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
    for (const link of allLinks) {
      if (links.length >= max) break

      const href = (link as HTMLAnchorElement).href
      const text = link.textContent?.trim() || ''

      if (!href || seen.has(href)) continue
      if (!href.includes(host)) continue

      // Skip navigation/utility links
      if (href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|pdf|zip)$/i)) continue
      if (href.includes('/login') || href.includes('/account') || href.includes('/cart')) continue
      if (href.includes('#') && !href.includes('#/')) continue

      // Prefer article-like links
      const isArticle = href.includes('artikel') ||
        href.includes('uitspraak') ||
        href.includes('document') ||
        href.includes('content') ||
        href.includes('detail') ||
        href.includes('update') ||
        href.includes('publicatie') ||
        href.includes('/ar-') ||
        href.includes('annotatie') ||
        text.length > 20 // Links with meaningful text

      if (isArticle) {
        seen.add(href)
        links.push({ url: href, title: text.slice(0, 200) })
      }
    }

    // If few articles found, also try content area links
    if (links.length < 5) {
      const contentArea = document.querySelector('main, article, .content, .articles, [role="main"], #content')
      if (contentArea) {
        const contentLinks = Array.from(contentArea.querySelectorAll('a[href]'))
        for (const link of contentLinks) {
          if (links.length >= max) break
          const href = (link as HTMLAnchorElement).href
          const text = link.textContent?.trim() || ''
          if (!href || seen.has(href) || !href.includes(host)) continue
          if (text.length > 10) {
            seen.add(href)
            links.push({ url: href, title: text.slice(0, 200) })
          }
        }
      }
    }

    return links
  }, baseHost, maxLinks)
}

/**
 * Extract readable content from a page
 */
async function extractPageContent(
  page: import('puppeteer-core').Page
): Promise<{ title: string; content: string }> {
  return page.evaluate(() => {
    const title = document.title || ''

    // Try to find the main content area
    const contentSelectors = [
      'article',
      '[role="article"]',
      '.article-content',
      '.article-body',
      '.content-body',
      '.document-content',
      '.entry-content',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post-content',
    ]

    let contentEl: Element | null = null
    for (const selector of contentSelectors) {
      contentEl = document.querySelector(selector)
      if (contentEl && contentEl.textContent && contentEl.textContent.trim().length > 200) break
    }

    // Fall back to body
    if (!contentEl) contentEl = document.body

    // Clone and remove unwanted elements
    const clone = contentEl.cloneNode(true) as Element
    const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.sidebar', '.menu', '.navigation', '.cookie-notice', '.ad', '.advertisement']
    for (const sel of removeSelectors) {
      clone.querySelectorAll(sel).forEach(el => el.remove())
    }

    const content = clone.textContent
      ?.replace(/\s+/g, ' ')
      .trim() || ''

    return { title, content }
  })
}

function splitText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining)
      break
    }
    let split = remaining.lastIndexOf('\n\n', maxSize)
    if (split < maxSize * 0.5) split = remaining.lastIndexOf('. ', maxSize)
    if (split < maxSize * 0.5) split = maxSize
    chunks.push(remaining.slice(0, split))
    remaining = remaining.slice(split).trim()
  }
  return chunks
}
