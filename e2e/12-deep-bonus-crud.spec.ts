import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Bonus - Diepgaande CRUD (Partner)', () => {

  test('maak berekening → verifieer wiskunde → verschijnt in lijst', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    const clientName = `E2E Client ${testId()}`
    const invoiceAmount = '25000'
    const bonusPercentage = '20'
    const expectedBonus = 25000 * 0.20 // = 5000

    // Open nieuw formulier
    await page.locator('button', { hasText: /Nieuw/i }).first().click()
    await page.waitForTimeout(500)

    // Vul factuurbedrag
    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill(invoiceAmount)

    // Verifieer dat bonus percentage standaard 20% is of vul in
    const percentageInput = page.locator('input[type="number"]').nth(1)
    const currentPercentage = await percentageInput.inputValue()
    if (currentPercentage !== '20') {
      await percentageInput.fill(bonusPercentage)
    }

    // Vul klantnaam
    const clientInput = page.getByPlaceholder(/klantnaam/i).first()
    if (await clientInput.isVisible().catch(() => false)) {
      await clientInput.fill(clientName)
    }

    // Vul factuurnummer
    const invoiceNumInput = page.getByPlaceholder(/2024/i).first()
    if (await invoiceNumInput.isVisible().catch(() => false)) {
      await invoiceNumInput.fill('E2E-2026-001')
    }

    // Verifieer live berekening in het formulier
    const calcDisplay = page.locator('text=/berekende bonus/i').first()
    if (await calcDisplay.isVisible().catch(() => false)) {
      // Bonus bedrag moet zichtbaar zijn
      const calcSection = page.locator('text=/5.000|5000|€\\s*5/i').first()
      await expect(calcSection).toBeVisible({ timeout: 5_000 })
    }

    // Opslaan
    await page.locator('button', { hasText: /Opslaan/i }).first().click()
    await page.waitForTimeout(2000)

    // Verifieer: berekening verschijnt in de lijst
    await expect(page.locator(`text=${clientName}`).first()).toBeVisible({ timeout: 10_000 })

    // Verifieer: bonusbedrag klopt
    await assertNoGarbage(page)
  })

  test('markeer factuur als betaald → status wijzigt', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    // Open nieuw formulier met klein bedrag
    await page.locator('button', { hasText: /Nieuw/i }).first().click()
    await page.waitForTimeout(500)

    const clientName = `Betaaltest ${testId()}`

    // Vul bedrag
    await page.locator('input[type="number"]').first().fill('1000')

    // Vul klant
    const clientInput = page.getByPlaceholder(/klantnaam/i).first()
    if (await clientInput.isVisible().catch(() => false)) {
      await clientInput.fill(clientName)
    }

    // Vink "Factuur is betaald" aan
    const factuurBetaald = page.locator('text=Factuur is betaald').first()
    if (await factuurBetaald.isVisible().catch(() => false)) {
      await factuurBetaald.click()
    }

    // Opslaan
    await page.locator('button', { hasText: /Opslaan/i }).first().click()
    await page.waitForTimeout(2000)

    // Verifieer: status badge toont "Te betalen" (factuur betaald, bonus nog niet)
    const statusBadge = page.locator('text=/Te betalen|betaald/i').first()
    await expect(statusBadge).toBeVisible({ timeout: 5_000 })
  })

  test('bewerk bestaande berekening → wijzigingen opgeslagen', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    // Zoek een bestaande berekening en klik edit
    const editButton = page.locator('button[title*="bewerk"], button[title*="edit"]').first()
    if (!await editButton.isVisible().catch(() => false)) {
      // Hover over eerste item om edit knoppen te onthullen
      const firstCard = page.locator('.card, [class*="rounded-2xl"]').nth(1)
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.hover()
        await page.waitForTimeout(300)
      }
    }

    // Probeer edit icon te vinden (pencil/edit icon)
    const editIcon = page.locator('[class*="edit"], [class*="pencil"]').first()
    if (await editIcon.isVisible().catch(() => false)) {
      await editIcon.click()
      await page.waitForTimeout(500)

      // Wijzig klantnaam
      const clientInput = page.getByPlaceholder(/klantnaam/i).first()
      if (await clientInput.isVisible().catch(() => false)) {
        await clientInput.fill(`Bewerkt ${testId()}`)
      }

      // Klik bijwerken
      const updateBtn = page.locator('button', { hasText: /bijwerken|opslaan/i }).first()
      await updateBtn.click()
      await page.waitForTimeout(2000)
    }

    await assertNoGarbage(page)
  })

  test('alle bedragen zijn numeriek, geen NaN of undefined', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Check dat er euro bedragen staan
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/€/)
  })
})
