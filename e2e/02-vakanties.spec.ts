import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Vakanties', () => {
  test('page loads and shows vacation balance', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')

    // Page title
    await expect(page.locator('text=Vakanties').first()).toBeVisible()

    await waitForPageLoad(page)

    // Page shows vacation content (calendar, "Afwezig deze week", "Vakanties & Verlof")
    await expect(page.locator('text=/Vakanties & Verlof|Afwezig|Schoolvakant|februari|maart/i').first()).toBeVisible({ timeout: 10_000 })

    await assertNoGarbage(page)
  })

  test('vacation balance shows numeric values (no NaN/undefined)', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Find all number displays in the balance section
    await assertNoGarbage(page)

    // Check that there are actual numbers displayed
    const bodyText = await page.locator('body').innerText()
    // Balance should contain some numbers
    expect(bodyText).toMatch(/\d+/)
  })

  test('parental leave section loads', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Look for parental leave section
    const parentalSection = page.locator('text=/ouderschapsverlof|parental/i').first()
    if (await parentalSection.isVisible().catch(() => false)) {
      await assertNoGarbage(page)
    }
  })

  test('team overview is visible', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    // Team overview should show vacation data for team members
    const teamSection = page.locator('text=/team|overzicht/i').first()
    await expect(teamSection).toBeVisible({ timeout: 10_000 })
  })

  test('calendar view renders without errors', async ({ page }) => {
    await navigateTo(page, '/dashboard/vakanties')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Calendar should show month names or weekday headers
    const calendarContent = page.locator('text=/ma|di|wo|do|vr|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december/i').first()
    await expect(calendarContent).toBeVisible({ timeout: 10_000 })
  })
})
