import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Team', () => {
  test('page loads and shows team members', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')

    await expect(page.locator('text=Team').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('team members have names and emails', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Should show email addresses
    const emailPattern = page.locator('text=/@workxadvocaten\\.nl/i').first()
    await expect(emailPattern).toBeVisible({ timeout: 10_000 })

    await assertNoGarbage(page)
  })

  test('team data displays correctly', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Check no garbage values
    await assertNoGarbage(page)

    // Body should contain actual team data
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(100)
  })

  test('search/filter works on team page', async ({ page }) => {
    await navigateTo(page, '/dashboard/team')
    await waitForPageLoad(page)

    // Look for search input
    const searchInput = page.locator('input[type="text"], input[type="search"]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('jochem')
      await page.waitForTimeout(1000)

      // Should still show relevant results
      const bodyText = await page.locator('body').innerText()
      expect(bodyText.toLowerCase()).toContain('jochem')
    }
  })
})
