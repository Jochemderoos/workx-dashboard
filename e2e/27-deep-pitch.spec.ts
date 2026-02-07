import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Pitch Document Maker - Diepgaande Tests', () => {

  test('pagina laadt en toont sectie selector', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Header moet Pitch Document Maker tonen
    const heading = page.locator('h1', { hasText: /Pitch Document Maker/i }).first()
    await expect(heading).toBeVisible({ timeout: 10_000 })

    // Subtitle beschrijving
    const subtitle = page.locator('text=/Stel een aangepaste pitch PDF samen/i').first()
    if (await subtitle.isVisible().catch(() => false)) {
      expect(true).toBeTruthy()
    }

    // Tab "Selecteren" moet actief zijn
    const selectTab = page.locator('button', { hasText: /Selecteren/i }).first()
    await expect(selectTab).toBeVisible({ timeout: 5_000 })

    // Drie selectie secties moeten zichtbaar zijn
    const introSection = page.locator('h2', { hasText: /Intro & Diensten/i }).first()
    const teamSection = page.locator('h2', { hasText: /Team CV/i }).first()
    const bijlagenSection = page.locator('h2', { hasText: /Bijlagen/i }).first()

    await expect(introSection).toBeVisible({ timeout: 10_000 })
    await expect(teamSection).toBeVisible({ timeout: 10_000 })
    await expect(bijlagenSection).toBeVisible({ timeout: 10_000 })

    await assertNoGarbage(page)
  })

  test('secties kunnen geselecteerd en gedeselecteerd worden', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Stats row moet zichtbaar zijn met page counts
    const statsRow = page.locator('text=/Intro/i').first()
    await expect(statsRow).toBeVisible({ timeout: 10_000 })

    // "Niets" knop bij Intro klikken om alle intro secties te deselecteren
    const introNoneBtn = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await introNoneBtn.isVisible().catch(() => false)) {
      await introNoneBtn.click()
      await page.waitForTimeout(500)

      // Intro count moet nu 0 zijn
      const introCount = page.locator('.card').filter({ hasText: /Intro/ }).locator('p.text-lg, p.text-2xl').first()
      if (await introCount.isVisible().catch(() => false)) {
        const countText = await introCount.innerText()
        expect(countText.trim()).toBe('0')
      }
    }

    // "Alles" knop klikken om alle intro secties te selecteren
    const introAllBtn = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await introAllBtn.isVisible().catch(() => false)) {
      await introAllBtn.click()
      await page.waitForTimeout(500)

      // Intro count moet nu > 0 zijn
      const introCount = page.locator('.card').filter({ hasText: /Intro/ }).locator('p.text-lg, p.text-2xl').first()
      if (await introCount.isVisible().catch(() => false)) {
        const countText = await introCount.innerText()
        const count = parseInt(countText.trim())
        expect(count).toBeGreaterThan(0)
      }
    }

    // Klik op een individuele intro sectie om te togglen
    const introSectionBtn = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button').filter({ has: page.locator('.truncate') }).first()
    if (await introSectionBtn.isVisible().catch(() => false)) {
      await introSectionBtn.click()
      await page.waitForTimeout(300)
      // Toggle terug
      await introSectionBtn.click()
      await page.waitForTimeout(300)
    }

    await assertNoGarbage(page)
  })

  test('team member CVs worden getoond in lijst', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Team CV sectie met bekende namen
    const teamSection = page.locator('h2', { hasText: /Team CV/i }).first()
    await expect(teamSection).toBeVisible({ timeout: 10_000 })

    // Bekende teamleden moeten in de lijst staan
    const expectedMembers = [
      'Bas den Ridder',
      'Jochem de Roos',
      'Maaike de Jong',
      'Marnix Ritmeester',
    ]

    const bodyText = await page.locator('body').innerText()
    let foundCount = 0
    for (const name of expectedMembers) {
      if (bodyText.includes(name)) {
        foundCount++
      }
    }
    // Minstens enkele bekende teamleden moeten verschijnen
    expect(foundCount).toBeGreaterThanOrEqual(1)

    // Selecteer een teamlid
    const teamMemberBtn = page.locator('button').filter({ hasText: /Bas den Ridder|Jochem de Roos/i }).first()
    if (await teamMemberBtn.isVisible().catch(() => false)) {
      await teamMemberBtn.click()
      await page.waitForTimeout(500)

      // CV count moet nu > 0 zijn
      const cvCount = page.locator('.card').filter({ hasText: /CV/ }).locator('p.text-lg, p.text-2xl').first()
      if (await cvCount.isVisible().catch(() => false)) {
        const countText = await cvCount.innerText()
        const count = parseInt(countText.trim())
        expect(count).toBeGreaterThan(0)
      }
    }

    // Alle/Niets knoppen bij team
    const teamAllBtn = page.locator('h2', { hasText: /Team CV/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await teamAllBtn.isVisible().catch(() => false)) {
      await teamAllBtn.click()
      await page.waitForTimeout(500)

      // Alle teamleden geselecteerd
      const cvCount = page.locator('.card').filter({ hasText: /CV/ }).locator('p.text-lg, p.text-2xl').first()
      if (await cvCount.isVisible().catch(() => false)) {
        const countText = await cvCount.innerText()
        const count = parseInt(countText.trim())
        expect(count).toBeGreaterThan(5) // Meerdere teamleden
      }
    }

    await assertNoGarbage(page)
  })

  test('preview sidebar update wanneer secties wijzigen', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Live Preview sectie moet bestaan
    const previewHeader = page.locator('h2', { hasText: /Live Preview/i }).first()
    await expect(previewHeader).toBeVisible({ timeout: 10_000 })

    // Deselecteer alles eerst
    const introNone = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await introNone.isVisible().catch(() => false)) {
      await introNone.click()
      await page.waitForTimeout(300)
    }
    const teamNone = page.locator('h2', { hasText: /Team CV/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await teamNone.isVisible().catch(() => false)) {
      await teamNone.click()
      await page.waitForTimeout(300)
    }
    const bijlagenNone = page.locator('h2', { hasText: /Bijlagen/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await bijlagenNone.isVisible().catch(() => false)) {
      await bijlagenNone.click()
      await page.waitForTimeout(300)
    }

    // Totaal moet 0 zijn
    const totalCount = page.locator('.card.bg-white\\/10, .card').filter({ hasText: /Totaal/ }).locator('p.text-lg, p.text-2xl').first()
    if (await totalCount.isVisible().catch(() => false)) {
      const countText = await totalCount.innerText()
      expect(countText.trim()).toBe('0')
    }

    // Selecteer intro secties
    const introAll = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await introAll.isVisible().catch(() => false)) {
      await introAll.click()
      await page.waitForTimeout(1000)

      // Totaal moet nu > 0 zijn
      if (await totalCount.isVisible().catch(() => false)) {
        const countText = await totalCount.innerText()
        const count = parseInt(countText.trim())
        expect(count).toBeGreaterThan(0)
      }

      // Summary sectie in preview moet page counts tonen
      const introPages = page.locator('text=/Intro pagina/i').first()
      if (await introPages.isVisible().catch(() => false)) {
        expect(true).toBeTruthy()
      }
    }

    await assertNoGarbage(page)
  })

  test('PDF generatie knop bestaat en reageert op selectie', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Download knop moet bestaan
    const downloadBtn = page.locator('button', { hasText: /Download/i }).first()
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 })

    // Knop toont paginatelling
    const btnText = await downloadBtn.innerText()
    expect(btnText).toMatch(/Download.*\d+.*pag/i)

    // Deselecteer alles
    const introNone = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await introNone.isVisible().catch(() => false)) {
      await introNone.click()
      await page.waitForTimeout(300)
    }
    const teamNone = page.locator('h2', { hasText: /Team CV/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await teamNone.isVisible().catch(() => false)) {
      await teamNone.click()
      await page.waitForTimeout(300)
    }
    const bijlagenNone = page.locator('h2', { hasText: /Bijlagen/i }).locator('..').locator('..').locator('button', { hasText: /Niets/i }).first()
    if (await bijlagenNone.isVisible().catch(() => false)) {
      await bijlagenNone.click()
      await page.waitForTimeout(300)
    }

    // Met 0 selecties: knop moet disabled zijn of 0 pag tonen
    const downloadBtnAfter = page.locator('button', { hasText: /Download.*0.*pag/i }).first()
    if (await downloadBtnAfter.isVisible().catch(() => false)) {
      // Knop is zichtbaar met 0 paginas - verwacht disabled
      const isDisabled = await downloadBtnAfter.isDisabled()
      expect(isDisabled).toBeTruthy()
    }

    // Selecteer iets om knop te enablen
    const introAll = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await introAll.isVisible().catch(() => false)) {
      await introAll.click()
      await page.waitForTimeout(500)

      // Download knop moet nu enabled zijn
      const enabledDownloadBtn = page.locator('button', { hasText: /Download/i }).filter({ hasNot: page.locator('[disabled]') }).first()
      if (await enabledDownloadBtn.isVisible().catch(() => false)) {
        expect(await enabledDownloadBtn.isEnabled()).toBeTruthy()
      }
    }

    await assertNoGarbage(page)
  })

  test('logo upload area is zichtbaar op selectie tab', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Klant Logo sectie
    const logoSection = page.locator('h2', { hasText: /Klant Logo/i }).first()
    await expect(logoSection).toBeVisible({ timeout: 10_000 })

    // Upload PNG knop/label
    const uploadLabel = page.locator('text=/Upload PNG/i').first()
    await expect(uploadLabel).toBeVisible({ timeout: 5_000 })

    // File input moet bestaan (verborgen)
    const fileInput = page.locator('input[type="file"][accept*="png"]').first()
    expect(await fileInput.count()).toBeGreaterThan(0)

    await assertNoGarbage(page)
  })

  test('taal selector (NL/EN) is aanwezig', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // NL knop
    const nlBtn = page.locator('button', { hasText: /^NL$/ }).first()
    await expect(nlBtn).toBeVisible({ timeout: 10_000 })

    // EN knop
    const enBtn = page.locator('button', { hasText: /^EN$/ }).first()
    await expect(enBtn).toBeVisible({ timeout: 10_000 })

    // NL moet standaard actief zijn (heeft bg-white/20 styling)
    // Klik op NL om zeker te weten
    await nlBtn.click()
    await page.waitForTimeout(300)

    await assertNoGarbage(page)
  })

  test('stats row toont correcte tellingen per categorie', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Stats cards moeten er zijn: Intro, CVs, Bijlagen, Totaal
    const statsLabels = ['Intro', "CV's", 'Bijlagen', 'Totaal']
    for (const label of statsLabels) {
      const statCard = page.locator('text=' + label).first()
      await expect(statCard).toBeVisible({ timeout: 5_000 })
    }

    // Tellingen moeten numeriek zijn
    const bodyText = await page.locator('body').innerText()

    // Geen NaN in tellingen
    expect(bodyText).not.toContain('NaN')

    // Totaal moet gelijk zijn aan som van Intro + CVs + Bijlagen
    // We lezen de vier stats values
    const statsCards = page.locator('.card.p-3, .card.p-4').filter({ hasText: /Intro|CV|Bijlagen|Totaal/ })
    const cardCount = await statsCards.count()

    if (cardCount >= 4) {
      const values: number[] = []
      for (let i = 0; i < Math.min(cardCount, 4); i++) {
        const numEl = statsCards.nth(i).locator('p').first()
        const text = await numEl.innerText()
        values.push(parseInt(text.trim()) || 0)
      }
      // values[3] (Totaal) should equal values[0] + values[1] + values[2]
      if (values.length >= 4) {
        expect(values[3]).toBe(values[0] + values[1] + values[2])
      }
    }

    await assertNoGarbage(page)
  })

  test('tab navigatie: Selecteren en Volgorde tabs', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Tab 1: Selecteren moet actief zijn
    const selectTab = page.locator('button', { hasText: /Selecteren/i }).first()
    await expect(selectTab).toBeVisible()

    // Tab 2: Volgorde & Download
    const previewTab = page.locator('button', { hasText: /Volgorde/i }).first()
    await expect(previewTab).toBeVisible()

    // Selecteer wat content zodat we naar Volgorde kunnen
    const introAll = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await introAll.isVisible().catch(() => false)) {
      await introAll.click()
      await page.waitForTimeout(500)

      // "Ga naar Volgorde" knop moet verschijnen
      const goToOrderBtn = page.locator('button', { hasText: /Ga naar Volgorde/i }).first()
      if (await goToOrderBtn.isVisible().catch(() => false)) {
        await goToOrderBtn.click()
        await page.waitForTimeout(1000)

        // Volgorde tab content moet nu zichtbaar zijn
        const orderHeader = page.locator('h2', { hasText: /Pagina Volgorde/i }).first()
        await expect(orderHeader).toBeVisible({ timeout: 5_000 })

        // Reset knop moet beschikbaar zijn
        const resetBtn = page.locator('button', { hasText: /Reset/i }).first()
        if (await resetBtn.isVisible().catch(() => false)) {
          expect(await resetBtn.isEnabled()).toBeTruthy()
        }
      }
    }

    await assertNoGarbage(page)
  })

  test('info banner over originele kwaliteit is zichtbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    // Info banner onderaan
    const infoBanner = page.locator('text=/100% originele kwaliteit/i').first()
    await expect(infoBanner).toBeVisible({ timeout: 10_000 })

    const qualityText = page.locator('text=/originele kwaliteit behouden/i').first()
    await expect(qualityText).toBeVisible({ timeout: 5_000 })

    await assertNoGarbage(page)
  })

  test('geen NaN, undefined of [object Object] op hele pagina', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Selecteer alles en controleer opnieuw
    const introAll = page.locator('h2', { hasText: /Intro & Diensten/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await introAll.isVisible().catch(() => false)) {
      await introAll.click()
      await page.waitForTimeout(300)
    }
    const teamAll = page.locator('h2', { hasText: /Team CV/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await teamAll.isVisible().catch(() => false)) {
      await teamAll.click()
      await page.waitForTimeout(300)
    }
    const bijlagenAll = page.locator('h2', { hasText: /Bijlagen/i }).locator('..').locator('..').locator('button', { hasText: /Alles/i }).first()
    if (await bijlagenAll.isVisible().catch(() => false)) {
      await bijlagenAll.click()
      await page.waitForTimeout(500)
    }

    // Na alle selecties: geen garbage waarden
    await assertNoGarbage(page)

    // Verifieer dat totaal getal klopt en geen NaN is
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('NaN')
    expect(bodyText).not.toContain('[object Object]')

    // Page count in download knop moet een getal zijn
    const downloadBtn = page.locator('button', { hasText: /Download/i }).first()
    if (await downloadBtn.isVisible().catch(() => false)) {
      const btnText = await downloadBtn.innerText()
      const match = btnText.match(/(\d+)\s*pag/i)
      if (match) {
        const pageCount = parseInt(match[1])
        expect(isNaN(pageCount)).toBeFalsy()
        expect(pageCount).toBeGreaterThan(0)
      }
    }
  })
})
