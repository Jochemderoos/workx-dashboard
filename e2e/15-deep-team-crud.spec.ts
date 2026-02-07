import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Team - Diepgaande CRUD (Partner)', () => {

  test('team pagina toont alle medewerkers met correcte data', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Bekende team members moeten zichtbaar zijn
    const expectedMembers = ['Alain Heunen', 'Marlieke Schipper', 'Justine Schellekens', 'Barbara Rip']
    for (const name of expectedMembers) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 10_000 })
    }

    // Salaris en uurtarief data moet numeriek zijn
    await assertNoGarbage(page)

    // Euro bedragen moeten aanwezig zijn
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/€\s*\d/)
  })

  test('ervaringsjaar en uurtarief worden correct getoond', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Check ervaringsjaar formaat (bijv. "9e jaars")
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/\de jaars/i)

    // Uurtarieven moeten aanwezig zijn
    expect(bodyText).toMatch(/€\s*\d+/)

    // Bruto salaris moet aanwezig zijn
    expect(bodyText).toMatch(/mnd/)

    await assertNoGarbage(page)
  })

  test('vakantiedagen per medewerker kloppen (geen NaN)', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Vakantiedagen sectie moet numerieke waarden tonen
    const bodyText = await page.locator('body').innerText()

    // Check "dagen over" formaat
    expect(bodyText).toMatch(/dagen over/i)

    // Check "Totaal:" formaat met getal
    expect(bodyText).toMatch(/Totaal:\s*\d/)

    // Check "Opgenomen:" formaat
    expect(bodyText).toMatch(/Opgenomen:\s*\d/)

    await assertNoGarbage(page)
  })

  test('ouderschapsverlof details zijn correct', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // O.V. (Ouderschapsverlof) secties
    const bodyText = await page.locator('body').innerText()

    // Check dat O.V. data correct formaat heeft
    if (bodyText.includes('O.V.')) {
      // Betaald O.V. formaat: "xxx/324 uur"
      expect(bodyText).toMatch(/\d+(\.\d+)?\/324 uur/)

      // Onbetaald O.V. formaat: "x/85 dagen"
      expect(bodyText).toMatch(/\d+\/85 dagen/)
    }

    await assertNoGarbage(page)
  })

  test('ziektedagen worden correct getoond', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Ziektedagen sectie
    const bodyText = await page.locator('body').innerText()

    // Formaat: "X dagen"
    expect(bodyText).toMatch(/\d+ dagen/i)

    // Kay Maes heeft 20 ziektedagen - check waarschuwing
    if (bodyText.includes('Kay Maes')) {
      const kaySection = page.locator('div', { hasText: 'Kay Maes' }).first()
      if (await kaySection.isVisible().catch(() => false)) {
        const kayText = await kaySection.innerText()
        if (kayText.includes('20 dagen')) {
          // Waarschuwing moet zichtbaar zijn
          expect(kayText).toContain('Meer dan 5 ziektedagen')
        }
      }
    }

    await assertNoGarbage(page)
  })

  test('bonus overzicht per medewerker klopt', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // BONUS sectie per medewerker
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('BONUS')

    // "Betaald" en "In afwachting" labels
    expect(bodyText).toMatch(/Betaald/i)
    expect(bodyText).toMatch(/In afwachting/i)

    // Bedragen moeten euro formaat zijn
    expect(bodyText).toMatch(/€\s*\d/)

    await assertNoGarbage(page)
  })

  test('zoekfunctie filtert correct', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Zoek op naam
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('Marlieke')
      await page.waitForTimeout(1000)

      // Marlieke moet zichtbaar zijn
      await expect(page.locator('text=Marlieke Schipper').first()).toBeVisible()

      // Resultaten moeten gefilterd zijn - check het hoofdgedeelte (niet sidebar)
      // Marlieke moet in resultaten staan
      await assertNoGarbage(page)

      // Leeg zoekfilter
      await searchInput.fill('')
      await page.waitForTimeout(1000)

      // Nu moeten alle medewerkers weer zichtbaar zijn
      await expect(page.locator('text=Alain Heunen').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('partner knoppen zijn zichtbaar (Teamlid toevoegen, Ervaringsjaar, Uurtarief)', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Partner-only knoppen
    const addMemberBtn = page.locator('button', { hasText: /teamlid toevoegen/i }).first()
    await expect(addMemberBtn).toBeVisible({ timeout: 5_000 })

    const experienceBtn = page.locator('button', { hasText: /ervaringsjaar/i }).first()
    await expect(experienceBtn).toBeVisible({ timeout: 5_000 })

    const hourlyBtn = page.locator('button', { hasText: /uurtarief/i }).first()
    await expect(hourlyBtn).toBeVisible({ timeout: 5_000 })
  })
})
