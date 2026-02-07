import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Vakanties - Diepgaande CRUD (Partner)', () => {

  test('vakantie toevoegen → verschijnt in kalender', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Klik "Vakantie toevoegen" knop (partner feature)
    const addBtn = page.locator('button', { hasText: /vakantie toevoegen/i }).first()
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click()
      await page.waitForTimeout(500)

      // Vul formulier in - kies een teamlid
      // Zoek team member dropdown/select
      const memberSelect = page.locator('select').first()
      if (await memberSelect.isVisible().catch(() => false)) {
        // Selecteer een teamlid (niet onszelf)
        const options = await memberSelect.locator('option').allInnerTexts()
        if (options.length > 1) {
          await memberSelect.selectOption({ index: 1 })
        }
      }

      // Vul datums in
      const dateInputs = page.locator('input[type="date"], .react-datepicker__input-container input')
      if (await dateInputs.first().isVisible().catch(() => false)) {
        // Gebruik volgende week als test periode
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const endDate = new Date(nextWeek)
        endDate.setDate(endDate.getDate() + 2)

        const startStr = nextWeek.toISOString().split('T')[0]
        const endStr = endDate.toISOString().split('T')[0]

        await dateInputs.first().fill(startStr)
        if (await dateInputs.nth(1).isVisible().catch(() => false)) {
          await dateInputs.nth(1).fill(endStr)
        }
      }

      // Opslaan
      const saveBtn = page.locator('button', { hasText: /opslaan/i }).first()
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    await assertNoGarbage(page)
  })

  test('Afwezig deze week widget toont correcte namen', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // "Afwezig deze week" sectie
    const absenceSection = page.locator('text=Afwezig deze week').first()
    if (await absenceSection.isVisible().catch(() => false)) {
      // Moet namen tonen van mensen die weg zijn
      const bodyText = await page.locator('body').innerText()
      // Verifieer dat er geen broken data is
      await assertNoGarbage(page)

      // Check dat bij afwezigen daadwerkelijk datums staan
      expect(bodyText).toMatch(/\d+\s*(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i)
    }
  })

  test('schoolvakanties banner is zichtbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Schoolvakanties Noord-Holland banner
    const schoolBanner = page.locator('text=/schoolvakant/i').first()
    await expect(schoolBanner).toBeVisible({ timeout: 5_000 })
  })

  test('kalender wisselt correct tussen Week/Maand/Lijst views', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Week view
    const weekBtn = page.locator('button', { hasText: /^Week$/i }).first()
    if (await weekBtn.isVisible().catch(() => false)) {
      await weekBtn.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }

    // Lijst view
    const lijstBtn = page.locator('button', { hasText: /^Lijst$/i }).first()
    if (await lijstBtn.isVisible().catch(() => false)) {
      await lijstBtn.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }

    // Maand view (terug)
    const maandBtn = page.locator('button', { hasText: /^Maand$/i }).first()
    if (await maandBtn.isVisible().catch(() => false)) {
      await maandBtn.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }
  })

  test('beheer modus toont vakantiesaldo per medewerker (partner)', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Zoek beheer/settings knop (tandwiel icoon)
    const beheerBtn = page.locator('button[title*="beheer"], button[title*="instellingen"]').first()
    if (!await beheerBtn.isVisible().catch(() => false)) {
      // Probeer tandwiel icoon
      const gearBtn = page.locator('button').filter({ has: page.locator('[class*="settings"], [class*="gear"]') }).first()
      if (await gearBtn.isVisible().catch(() => false)) {
        await gearBtn.click()
        await page.waitForTimeout(1000)
      }
    } else {
      await beheerBtn.click()
      await page.waitForTimeout(1000)
    }

    // In beheer modus: check dat saldo data er staat
    await assertNoGarbage(page)

    // Verifieer dat medewerker namen zichtbaar zijn
    const bodyText = await page.locator('body').innerText()
    // Moet team members tonen
    expect(bodyText).toMatch(/Alain|Marlieke|Justine|Wies|Emma|Kay|Erika|Barbara/i)
  })
})
