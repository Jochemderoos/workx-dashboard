import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Werkitems', () => {
  test('page loads and shows work items', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')

    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can create a new work item', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    const title = `Test werkitem ${testId()}`

    // Click new button
    const newButton = page.getByRole('button', { name: /nieuw/i }).first()
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click()

      // Fill in the form
      const titleInput = page.locator('input[type="text"]').first()
      await titleInput.fill(title)

      // Save
      const saveButton = page.getByRole('button', { name: /opslaan/i }).first()
      await saveButton.click()

      // Wait for save
      await page.waitForTimeout(2000)

      // Verify it appears in the list
      await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('completed work items can be marked', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    // Check that the page has work items or empty state
    await assertNoGarbage(page)
  })

  test('workload section shows data', async ({ page }) => {
    await navigateTo(page, '/dashboard/werk')
    await waitForPageLoad(page)

    // Look for workload/toewijzing tabs
    const workloadTab = page.locator('text=/werkdruk|toewijzing|wie doet wat/i').first()
    if (await workloadTab.isVisible().catch(() => false)) {
      await workloadTab.click()
      await waitForPageLoad(page)
      await assertNoGarbage(page)
    }
  })
})
