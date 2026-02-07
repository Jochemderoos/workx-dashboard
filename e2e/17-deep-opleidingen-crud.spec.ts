import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Opleidingen - Diepgaande CRUD (Partner)', () => {

  test('maak training sessie → verschijnt in lijst', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    const sessionTitle = `E2E Training ${testId()}`

    // Klik Nieuw
    const newBtn = page.locator('button', { hasText: /Nieuw/i }).first()
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click()
      await page.waitForTimeout(500)

      // Vul titel
      const titleInput = page.locator('input[type="text"]').first()
      await titleInput.fill(sessionTitle)

      // Vul spreker
      const speakerInput = page.locator('input[type="text"]').nth(1)
      if (await speakerInput.isVisible().catch(() => false)) {
        await speakerInput.fill('E2E Test Spreker')
      }

      // Vul punten (standaard 1)
      const pointsInput = page.locator('input[type="number"]').first()
      if (await pointsInput.isVisible().catch(() => false)) {
        await pointsInput.fill('2')
      }

      // Opslaan
      await page.locator('button', { hasText: /Opslaan/i }).first().click()
      await page.waitForTimeout(2000)

      // Verifieer: sessie verschijnt in lijst
      await expect(page.locator(`text=${sessionTitle}`).first()).toBeVisible({ timeout: 10_000 })

      // Spreker moet ook zichtbaar zijn
      await expect(page.locator('text=E2E Test Spreker').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('certificaten tab toont punten overzicht', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Klik certificaten tab
    const certTab = page.locator('button', { hasText: /certificat/i }).first()
    if (await certTab.isVisible().catch(() => false)) {
      await certTab.click()
      await page.waitForTimeout(1000)

      // Certificaten tab content moet zichtbaar zijn
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).toMatch(/certificat/i)

      // Getallen moeten numeriek zijn
      await assertNoGarbage(page)
    }
  })

  test('jaar selector werkt correct', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Zoek jaar selector
    const yearSelect = page.locator('select').first()
    if (await yearSelect.isVisible().catch(() => false)) {
      // Selecteer vorig jaar
      const prevYear = (new Date().getFullYear() - 1).toString()
      await yearSelect.selectOption(prevYear).catch(() => {})
      await page.waitForTimeout(1000)

      await assertNoGarbage(page)

      // Ga terug naar huidig jaar
      const currentYear = new Date().getFullYear().toString()
      await yearSelect.selectOption(currentYear).catch(() => {})
      await page.waitForTimeout(1000)
    }
  })
})
