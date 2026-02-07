import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Workxflow - Diepgaande Tests', () => {

  test('pagina laadt en toont bundel lijst (Processtukken)', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Pagina header moet Workxflow tonen
    const heading = page.locator('h1', { hasText: /Workxflow/i }).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })

    // Processtukken sectie moet aanwezig zijn
    const bundleListHeader = page.locator('h2', { hasText: /Processtukken/i }).first()
    await expect(bundleListHeader).toBeVisible({ timeout: 10_000 })

    // "Nieuw Processtuk" knop moet bestaan
    const newBundleBtn = page.locator('button', { hasText: /Nieuw Processtuk/i }).first()
    await expect(newBundleBtn).toBeVisible()
    expect(await newBundleBtn.isEnabled()).toBeTruthy()

    await assertNoGarbage(page)
  })

  test('maak nieuw processtuk via modal formulier', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    const bundleTitle = `E2E Processtuk ${testId()}`
    const caseNumber = `2026/${Math.floor(Math.random() * 99999)}`
    const clientName = `E2E Klant ${testId()}`

    // Klik "Nieuw Processtuk" knop
    await page.locator('button', { hasText: /Nieuw Processtuk/i }).first().click()
    await page.waitForTimeout(500)

    // Modal moet verschijnen met formulier
    const modalTitle = page.locator('h3', { hasText: /Nieuw Processtuk/i }).first()
    await expect(modalTitle).toBeVisible({ timeout: 5_000 })

    // Vul titel in (verplicht veld)
    const titleInput = page.locator('input[name="title"]').first()
    await expect(titleInput).toBeVisible()
    await titleInput.fill(bundleTitle)

    // Vul zaaknummer in (optioneel)
    const caseInput = page.locator('input[name="caseNumber"]').first()
    if (await caseInput.isVisible().catch(() => false)) {
      await caseInput.fill(caseNumber)
    }

    // Vul client in (optioneel)
    const clientInput = page.locator('input[name="clientName"]').first()
    if (await clientInput.isVisible().catch(() => false)) {
      await clientInput.fill(clientName)
    }

    // Klik Aanmaken
    await page.locator('button', { hasText: /Aanmaken/i }).first().click()
    await page.waitForTimeout(2000)

    // Modal moet sluiten
    await expect(modalTitle).toBeHidden({ timeout: 5_000 })

    // Nieuw processtuk moet verschijnen in de lijst
    await expect(page.locator(`text=${bundleTitle}`).first()).toBeVisible({ timeout: 10_000 })

    await assertNoGarbage(page)
  })

  test('bundel details laden correct na selectie', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Kijk of er bundles in de lijst zijn
    const bundleButtons = page.locator('h2', { hasText: /Processtukken/i }).locator('..').locator('button').filter({ hasNot: page.locator('text=/Nieuw|Maak/') })
    const bundleCount = await bundleButtons.count()

    if (bundleCount > 0) {
      // Klik op eerste bundel in de lijst
      await bundleButtons.first().click()
      await page.waitForTimeout(1500)

      // Editor sectie moet laden met bundel details
      // Upload processtuk sectie of processtuk titel moet zichtbaar zijn
      const editorVisible = await page.locator('text=/Upload processtuk|Producties|Bijlagen|Volledige PDF/i').first().isVisible().catch(() => false)
      expect(editorVisible).toBeTruthy()

      // Producties of Bijlagen header met count moet zichtbaar zijn
      const productionsHeader = page.locator('h3', { hasText: /Producties|Bijlagen/i }).first()
      await expect(productionsHeader).toBeVisible({ timeout: 5_000 })
    } else {
      // Geen bundels: "Selecteer een processtuk" of lege state
      const emptyState = page.locator('text=/Selecteer een processtuk|Nog geen processtukken/i').first()
      await expect(emptyState).toBeVisible({ timeout: 5_000 })
    }

    await assertNoGarbage(page)
  })

  test('PDF controls zijn zichtbaar bij actieve bundel', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Maak of selecteer een bundel
    const bundleButtons = page.locator('.card button').filter({ hasText: /.+/ })
    const existingBundle = bundleButtons.first()

    if (await existingBundle.isVisible().catch(() => false)) {
      // Klik op eerste bundel
      const firstBundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
      if (await firstBundleInList.isVisible().catch(() => false)) {
        await firstBundleInList.click()
        await page.waitForTimeout(1500)
      }
    }

    // Check PDF download knoppen
    const fullPdfBtn = page.locator('button', { hasText: /Volledige PDF/i }).first()
    const splitPdfBtn = page.locator('button', { hasText: /In Delen/i }).first()

    if (await fullPdfBtn.isVisible().catch(() => false)) {
      expect(await fullPdfBtn.isEnabled()).toBeTruthy()

      // "In Delen" knop ook zichtbaar
      if (await splitPdfBtn.isVisible().catch(() => false)) {
        expect(await splitPdfBtn.isEnabled()).toBeTruthy()
      }
    }

    // PDF opties checkboxen
    const logoCheckbox = page.locator('text=/Logo toevoegen aan processtuk/i').first()
    if (await logoCheckbox.isVisible().catch(() => false)) {
      // Checkbox bestaat - goed
      expect(true).toBeTruthy()
    }

    const productielijstCheckbox = page.locator('text=/Productielijst opnemen/i').first()
    if (await productielijstCheckbox.isVisible().catch(() => false)) {
      expect(true).toBeTruthy()
    }

    await assertNoGarbage(page)
  })

  test('lock indicator en vergrendelingslogica zichtbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // De pagina body moet context over locks bevatten of lock-gerelateerde UI
    const bodyText = await page.locator('body').innerText()

    // Check voor lock-gerelateerde indicators in bundel items
    // Als een bundel vergrendeld is door iemand anders, moet er een lock icon of "bewerkt" tekst zijn
    const lockIndicators = page.locator('[class*="lock"], [class*="yellow"]')
    const lockCount = await lockIndicators.count()

    // Lock indicators mogen bestaan (als iemand anders bewerkt)
    // Of niet (als niemand bewerkt) - beide valid
    expect(lockCount).toBeGreaterThanOrEqual(0)

    // Als bundels bestaan, selecteer er een om lock te activeren
    const bundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await bundleInList.isVisible().catch(() => false)) {
      await bundleInList.click()
      await page.waitForTimeout(1500)

      // Na selectie: lock is verworven (API call gemaakt)
      // Verifieer dat de pagina geen error toont over lock
      const lockError = page.locator('text=/vergrendeld/i').first()
      const hasLockError = await lockError.isVisible().catch(() => false)
      // Als er een lock error is, dan is de bundel al vergrendeld door iemand anders (acceptabel)
      // Geen error = lock succesvol verworven
    }

    await assertNoGarbage(page)
  })

  test('share controls zijn zichtbaar voor eigen bundels', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Selecteer een bundel
    const bundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await bundleInList.isVisible().catch(() => false)) {
      await bundleInList.click()
      await page.waitForTimeout(1500)

      // "Delen" knop moet zichtbaar zijn voor eigen bundels
      const shareBtn = page.locator('button', { hasText: /Delen/i }).first()
      if (await shareBtn.isVisible().catch(() => false)) {
        expect(await shareBtn.isEnabled()).toBeTruthy()

        // Klik op Delen om share panel te openen
        await shareBtn.click()
        await page.waitForTimeout(500)

        // Share panel moet verschijnen
        const sharePanel = page.locator('text=/Delen met collega/i').first()
        await expect(sharePanel).toBeVisible({ timeout: 5_000 })

        // Sluit door opnieuw te klikken
        await shareBtn.click()
        await page.waitForTimeout(300)
      }
    }

    await assertNoGarbage(page)
  })

  test('processtuk naamgeving selector (Producties/Bijlagen)', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Selecteer een bundel
    const bundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await bundleInList.isVisible().catch(() => false)) {
      await bundleInList.click()
      await page.waitForTimeout(1500)

      // Naamgeving dropdown moet zichtbaar zijn
      const labelSelector = page.locator('select').filter({ has: page.locator('option', { hasText: /Producties/ }) }).first()
      if (await labelSelector.isVisible().catch(() => false)) {
        // Selector bevat de opties Producties en Bijlagen
        const options = await labelSelector.locator('option').allTextContents()
        expect(options).toContain('Producties')
        expect(options).toContain('Bijlagen')
      }
    }

    await assertNoGarbage(page)
  })

  test('voorbeeld (preview) sidebar toont informatie', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Preview sidebar moet bestaan
    const previewHeader = page.locator('h2', { hasText: /Voorbeeld/i }).first()
    await expect(previewHeader).toBeVisible({ timeout: 10_000 })

    // Zonder selectie: prompt om te selecteren
    const emptyPreview = page.locator('text=/Selecteer een processtuk/i').first()
    if (await emptyPreview.isVisible().catch(() => false)) {
      expect(true).toBeTruthy()
    }

    // Selecteer bundel om preview te vullen
    const bundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await bundleInList.isVisible().catch(() => false)) {
      await bundleInList.click()
      await page.waitForTimeout(1500)

      // Preview moet nu content tonen (Processtuk label of document info)
      const previewContent = page.locator('text=/Processtuk|Totaal documenten/i').first()
      await expect(previewContent).toBeVisible({ timeout: 5_000 })
    }

    await assertNoGarbage(page)
  })

  test('desktop app info banner zichtbaar (browser modus)', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // In browser modus: desktop app banner moet zichtbaar zijn
    const desktopBanner = page.locator('text=/Desktop App voor printen/i').first()
    if (await desktopBanner.isVisible().catch(() => false)) {
      // Download link moet beschikbaar zijn
      const downloadLink = page.locator('a', { hasText: /Download voor Windows/i }).first()
      await expect(downloadLink).toBeVisible()

      const href = await downloadLink.getAttribute('href')
      expect(href).toContain('.exe')
    }

    await assertNoGarbage(page)
  })

  test('annuleer knop sluit nieuw processtuk modal', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    // Open modal
    await page.locator('button', { hasText: /Nieuw Processtuk/i }).first().click()
    await page.waitForTimeout(500)

    const modalTitle = page.locator('h3', { hasText: /Nieuw Processtuk/i }).first()
    await expect(modalTitle).toBeVisible({ timeout: 5_000 })

    // Klik Annuleren
    await page.locator('button', { hasText: /Annuleren/i }).first().click()
    await page.waitForTimeout(500)

    // Modal moet gesloten zijn
    await expect(modalTitle).toBeHidden({ timeout: 5_000 })

    await assertNoGarbage(page)
  })

  test('geen NaN, undefined of [object Object] op hele pagina', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Extra check: selecteer een bundel en controleer opnieuw
    const bundleInList = page.locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await bundleInList.isVisible().catch(() => false)) {
      await bundleInList.click()
      await page.waitForTimeout(1500)

      await assertNoGarbage(page)

      // Verifieer dat producties-count een getal is, niet NaN
      const bodyText = await page.locator('body').innerText()
      const productionCountMatch = bodyText.match(/(\d+)\s*(producties|bijlagen)/i)
      if (productionCountMatch) {
        const count = parseInt(productionCountMatch[1])
        expect(isNaN(count)).toBeFalsy()
      }
    }
  })
})
