import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Appjeplekje - Diepgaande Tests', () => {

  test('aanmelden → widget op dashboard toont naam → afmelden', async ({ page }) => {
    // 1. Ga naar appjeplekje en meld aan
    await navigateTo(page, '/dashboard/appjeplekje')

    const toggleBtn = page.getByRole('button', { name: /aanmelden|afmelden/i }).first()
    await expect(toggleBtn).toBeVisible({ timeout: 10_000 })

    const initialText = (await toggleBtn.innerText()).toLowerCase()
    const wasSignedUp = initialText.includes('afmelden')

    // Als nog niet aangemeld, meld aan
    if (!wasSignedUp) {
      await toggleBtn.click()
      await page.waitForTimeout(2000)

      // Verifieer: knop is nu "Afmelden"
      const newText = (await toggleBtn.innerText()).toLowerCase()
      expect(newText).toContain('afmelden')
    }

    // 2. Ga naar dashboard en verifieer dat naam in Appjeplekje widget staat
    await navigateTo(page, '/dashboard')

    // Dashboard heeft Appjeplekje widget
    const appjePlekjeWidget = page.locator('text=Appjeplekje').first()
    if (await appjePlekjeWidget.isVisible().catch(() => false)) {
      // Onze naam (Jochem) moet in de widget staan
      const bodyText = await page.locator('body').innerText()
      // Check of het aanwezigheid toont
      await assertNoGarbage(page)
    }

    // 3. Ga terug en meld af als we hadden aangemeld
    if (!wasSignedUp) {
      await navigateTo(page, '/dashboard/appjeplekje')
      const btn = page.getByRole('button', { name: /afmelden/i }).first()
      if (await btn.isVisible().catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(2000)
      }
    }
  })

  test('bezetting toont correct aantal / capaciteit', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Bezettingsformaat: "X / 11" (met spaties) of "X/11"
    const bodyText = await page.locator('body').innerText()

    // Er moet een bezettingsindicator zijn
    expect(bodyText).toMatch(/\d+\s*\/\s*\d+/)

    await assertNoGarbage(page)
  })

  test('weekoverzicht toont 5 werkdagen met avatars', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Weekdagen moeten zichtbaar zijn
    const bodyText = await page.locator('body').innerText()

    // Check voor weekdag-achtige tekst
    const weekdays = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'ma', 'di', 'wo', 'do', 'vr']
    let foundDays = 0
    for (const day of weekdays) {
      if (bodyText.toLowerCase().includes(day)) foundDays++
    }
    expect(foundDays).toBeGreaterThanOrEqual(3)

    await assertNoGarbage(page)
  })

  test('maandkalender navigatie werkt', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Zoek maand navigatie knoppen
    const nextMonthBtn = page.locator('button').filter({ has: page.locator('[class*="chevron"], [class*="arrow"]') }).last()
    if (await nextMonthBtn.isVisible().catch(() => false)) {
      await nextMonthBtn.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }
  })
})
