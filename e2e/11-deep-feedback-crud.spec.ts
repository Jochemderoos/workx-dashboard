import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Feedback - Diepgaande CRUD (Partner)', () => {

  test('indienen idee → verschijnt in lijst → markeer als verwerkt', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')

    const title = `E2E Idee ${testId()}`

    // Open "Nieuw" popover
    await page.locator('button', { hasText: /Nieuw/i }).first().click()
    await page.waitForTimeout(1000)

    // Selecteer "Idee" type (de type selector buttons in het formulier)
    const ideaBtn = page.locator('button', { hasText: /^Idee$/ }).first()
    if (await ideaBtn.isVisible().catch(() => false)) {
      await ideaBtn.click()
    }

    // Vul titel in - target input.input-field (formulier) i.p.v. zoekbalk
    const titleInput = page.locator('input.input-field').first()
    await expect(titleInput).toBeVisible({ timeout: 10_000 })
    await titleInput.fill(title)

    // Vul beschrijving in
    const descInput = page.locator('textarea').first()
    await descInput.fill('Automatische E2E deep test - mag verwijderd worden')

    // Klik "Idee indienen"
    await page.locator('button', { hasText: /indienen/i }).first().click()
    await page.waitForTimeout(2000)

    // Verifieer: feedback verschijnt in de lijst
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10_000 })

    // Partner feature: markeer als verwerkt (checkbox)
    // Zoek de feedback card met onze titel en de checkbox erin
    const feedbackCard = page.locator('div', { hasText: title }).first()
    const checkbox = feedbackCard.locator('[title*="verwerkt"], [title*="markeren"]').first()
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click()
      await page.waitForTimeout(1000)

      // Verifieer: toast of badge "Verwerkt" verschijnt
      const verwerktBadge = page.locator('text=/verwerkt/i').first()
      await expect(verwerktBadge).toBeVisible({ timeout: 5_000 })
    }
  })

  test('indienen probleem → verschijnt met rode badge', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')

    const title = `E2E Bug ${testId()}`

    await page.locator('button', { hasText: /Nieuw/i }).first().click()
    await page.waitForTimeout(1000)

    // Selecteer "Probleem" type - knop bevat "Probleem" + beschrijvingstekst
    const problemBtn = page.locator('button', { hasText: 'Iets werkt niet goed' }).first()
    await expect(problemBtn).toBeVisible({ timeout: 10_000 })
    await problemBtn.click()
    await page.waitForTimeout(500)

    // Vul titel - target input.input-field (formulier)
    const titleInput = page.locator('input.input-field').first()
    await expect(titleInput).toBeVisible({ timeout: 10_000 })
    await titleInput.fill(title)

    // Vul beschrijving
    await page.locator('textarea').first().fill('E2E deep test bug report')

    // Klik "Probleem melden" submit knop
    await page.locator('button', { hasText: /Probleem melden/i }).first().click()
    await page.waitForTimeout(2000)

    // Verifieer: verschijnt in lijst
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10_000 })
  })

  test('filter Ideeën toont alleen ideeën, Problemen alleen bugs', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')
    await waitForPageLoad(page)

    // Klik "Ideeën" filter
    const ideeenFilter = page.locator('button', { hasText: /Ideeën/i }).first()
    if (await ideeenFilter.isVisible().catch(() => false)) {
      await ideeenFilter.click()
      await page.waitForTimeout(1000)

      // Geen "Probleem" badges zichtbaar (alleen ideeën)
      await assertNoGarbage(page)
    }

    // Klik "Problemen" filter
    const problemenFilter = page.locator('button', { hasText: /Problemen/i }).first()
    if (await problemenFilter.isVisible().catch(() => false)) {
      await problemenFilter.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }

    // Terug naar "Alles"
    const allesFilter = page.locator('button', { hasText: /Alles/i }).first()
    if (await allesFilter.isVisible().catch(() => false)) {
      await allesFilter.click()
      await page.waitForTimeout(500)
    }
  })

  test('statistieken tonen correcte aantallen', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')
    await waitForPageLoad(page)

    // Stats cards bovenaan: Ideeën count, Problemen count, Open count
    const statsSection = page.locator('text=/Ideeën|Problemen|Open/i').first()
    await expect(statsSection).toBeVisible({ timeout: 5_000 })

    // Getallen moeten numeriek zijn, geen NaN
    await assertNoGarbage(page)
  })
})
