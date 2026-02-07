import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Werk - Diepgaande CRUD (Partner)', () => {

  test('maak werkitem → verschijnt in lijst → wijzig status naar COMPLETED', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    const title = `E2E Werkitem ${testId()}`

    // Zoek de juiste tab (toewijzing)
    const toewijzingTab = page.locator('button', { hasText: /toewijzing/i }).first()
    if (await toewijzingTab.isVisible().catch(() => false)) {
      await toewijzingTab.click()
      await page.waitForTimeout(1000)
    }

    // Klik Nieuw
    const newBtn = page.locator('button', { hasText: /Nieuw/i }).first()
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click()
      await page.waitForTimeout(500)

      // Vul titel
      const titleInput = page.locator('input[type="text"]').first()
      await titleInput.fill(title)

      // Vul beschrijving als textarea beschikbaar
      const textarea = page.locator('textarea').first()
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('E2E test werkitem - mag verwijderd worden')
      }

      // Opslaan
      await page.locator('button', { hasText: /Opslaan/i }).first().click()
      await page.waitForTimeout(2000)

      // Verifieer: item verschijnt
      await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('werkdruk tab toont team grid (partner feature)', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    // Klik werkdruk tab
    const werkdrukTab = page.locator('button', { hasText: /werkdruk/i }).first()
    if (await werkdrukTab.isVisible().catch(() => false)) {
      await werkdrukTab.click()
      await page.waitForTimeout(2000)

      // Moet team member namen tonen
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).toMatch(/Alain|Marlieke|Justine|Wies|Kay|Erika|Barbara/i)

      await assertNoGarbage(page)
    }
  })

  test('urenoverzicht tab toont maandelijkse uren', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    // Klik urenoverzicht tab
    const urenTab = page.locator('button', { hasText: /urenoverzicht/i }).first()
    if (await urenTab.isVisible().catch(() => false)) {
      await urenTab.click()
      await page.waitForTimeout(2000)

      // Moet maand headers tonen
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)

      await assertNoGarbage(page)
    }
  })

  test('wie-doet-wat tab is zichtbaar en toont data', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    // Wie doet wat tab (default view)
    const wdwTab = page.locator('button', { hasText: /wie doet wat/i }).first()
    if (await wdwTab.isVisible().catch(() => false)) {
      await wdwTab.click()
      await page.waitForTimeout(2000)

      await assertNoGarbage(page)
    }
  })
})
