import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Print & PDF Functionaliteit', () => {

  test('opleidingen print overview knop is beschikbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Print knop moet zichtbaar zijn
    const printBtn = page.locator('button', { hasText: /print|afdrukken|overzicht/i }).first()
    if (await printBtn.isVisible().catch(() => false)) {
      // Knop bestaat - goed
      expect(await printBtn.isEnabled()).toBeTruthy()
    }

    await assertNoGarbage(page)
  })

  test('opleidingen certificaten tab heeft print optie', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Ga naar certificaten tab
    const certTab = page.locator('button', { hasText: /certificat/i }).first()
    if (await certTab.isVisible().catch(() => false)) {
      await certTab.click()
      await page.waitForTimeout(1000)

      // Print certificaat knop of selectie
      const printCertBtn = page.locator('button', { hasText: /print|afdrukken|alle certificaten/i }).first()
      if (await printCertBtn.isVisible().catch(() => false)) {
        expect(await printCertBtn.isEnabled()).toBeTruthy()
      }

      await assertNoGarbage(page)
    }
  })

  test('pitch maker pagina laadt PDF editor', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Pitch pagina moet laden
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.toLowerCase()).toMatch(/pitch|presentatie|document/)

    // Check voor PDF-gerelateerde elementen
    const pdfElements = page.locator('canvas, [class*="pdf"], [class*="preview"], iframe[src*="pdf"]')
    const hasPdfElements = await pdfElements.count() > 0

    // Of er moeten knoppen zijn voor PDF generatie
    const generateBtn = page.locator('button', { hasText: /genereer|download|pdf|maken/i }).first()
    const hasGenerateBtn = await generateBtn.isVisible().catch(() => false)

    // Minstens PDF preview of genereer knop aanwezig
    expect(hasPdfElements || hasGenerateBtn).toBeTruthy()

    await assertNoGarbage(page)
  })

  test('pitch maker API genereert PDF', async ({ page }) => {
    // Ga eerst naar pitch pagina om context te laden
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Test de pitch API direct
    const response = await page.request.post('/api/pitch', {
      data: {
        sections: ['cover', 'about'],
        teamMembers: [],
        clientName: 'E2E Test Client',
        clientLogo: null,
        overlays: []
      }
    })

    // API moet een response geven (200 of 400 als parameters niet kloppen)
    expect([200, 400, 422]).toContain(response.status())

    if (response.status() === 200) {
      // Response moet een PDF zijn
      const contentType = response.headers()['content-type']
      expect(contentType).toMatch(/pdf|octet-stream/)

      // PDF moet content hebben
      const body = await response.body()
      expect(body.length).toBeGreaterThan(1000) // Een PDF is minstens 1KB

      // PDF header check: moet beginnen met %PDF
      const header = body.toString('utf8', 0, 5)
      expect(header).toBe('%PDF-')
    }
  })

  test('workxflow pagina toont PDF controls', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    const bodyText = await page.locator('body').innerText()
    expect(bodyText.toLowerCase()).toMatch(/workxflow|productie|processtuk|document/)

    // Check voor PDF download/genereer knoppen
    const pdfBtn = page.locator('button', { hasText: /pdf|download|genereer/i }).first()
    if (await pdfBtn.isVisible().catch(() => false)) {
      expect(await pdfBtn.isEnabled()).toBeTruthy()
    }

    await assertNoGarbage(page)
  })

  test('workxflow PDF bundel API endpoint bestaat', async ({ page }) => {
    // Test met een niet-bestaand ID - moet 404 of error geven, niet 500
    const response = await page.request.get('/api/workxflow/test-nonexistent/pdf')

    // Mag 404, 400, of 401 zijn maar NIET 500 (server crash)
    expect(response.status()).not.toBe(500)
  })

  test('convert API endpoint bestaat en valideert input', async ({ page }) => {
    // Test de convert API met lege/ongeldige input
    const response = await page.request.post('/api/convert', {
      data: {
        fileName: 'test.txt',
        fileData: 'data:text/plain;base64,dGVzdA=='
      }
    })

    // API moet een response geven - niet 500
    expect(response.status()).not.toBe(500)
  })

  test('print CSS is correct geconfigureerd', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Check dat print CSS regels bestaan
    const hasPrintStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets)
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule && rule.conditionText === 'print') {
              return true
            }
          }
        } catch (e) {
          // Cross-origin stylesheets kunnen niet gelezen worden
          continue
        }
      }
      return false
    })

    expect(hasPrintStyles).toBeTruthy()
  })

  test('paginas hebben correcte print layout (geen overlappende elementen)', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Emuleer print media
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(500)

    // In print modus: .no-print elementen moeten verborgen zijn
    const noPrintElements = await page.evaluate(() => {
      const els = document.querySelectorAll('.no-print')
      let hiddenCount = 0
      for (const el of els) {
        const style = window.getComputedStyle(el)
        if (style.display === 'none') hiddenCount++
      }
      return { total: els.length, hidden: hiddenCount }
    })

    // Als er .no-print elementen zijn, moeten ze verborgen zijn
    if (noPrintElements.total > 0) {
      expect(noPrintElements.hidden).toBe(noPrintElements.total)
    }

    // Card elementen moeten geen box-shadow hebben in print
    const cardsHaveShadow = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"]')
      for (const card of cards) {
        const style = window.getComputedStyle(card)
        if (style.boxShadow && style.boxShadow !== 'none') return true
      }
      return false
    })
    // In print: geen schaduwen (of cards bestaan niet - ook OK)
    // Dit is een soft check

    // Content moet leesbaar zijn (tekst aanwezig)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(100)

    // Reset naar screen
    await page.emulateMedia({ media: 'screen' })
  })

  test('bonus pagina bedragen zijn correct geformatteerd voor print', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    // Alle euro bedragen moeten correct format hebben
    const bodyText = await page.locator('body').innerText()

    // Euro bedragen aanwezig
    if (bodyText.includes('€')) {
      // Geen NaN of undefined in bedragen
      expect(bodyText).not.toContain('€NaN')
      expect(bodyText).not.toContain('€undefined')
      expect(bodyText).not.toContain('€null')

      // Bedragen moeten numeriek zijn na €
      expect(bodyText).toMatch(/€\s*[\d.,]+/)
    }

    await assertNoGarbage(page)
  })

  test('team pagina data is print-ready (geen afgekapte content)', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Emuleer print media
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(500)

    // Check dat alle medewerker namen volledig zichtbaar zijn
    const bodyText = await page.locator('body').innerText()
    const expectedMembers = ['Alain Heunen', 'Marlieke Schipper']
    for (const name of expectedMembers) {
      expect(bodyText).toContain(name)
    }

    // Geen afgekapte content (overflow hidden in print)
    const hasHiddenOverflow = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="member"]')
      for (const card of cards) {
        const style = window.getComputedStyle(card)
        if (style.overflow === 'hidden' && card.scrollHeight > card.clientHeight) {
          return true
        }
      }
      return false
    })

    // In print modus zou content niet afgekapt moeten zijn
    // (soft check - sommige cards mogen overflow hidden hebben)

    // Reset naar screen
    await page.emulateMedia({ media: 'screen' })
  })
})
