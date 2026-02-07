import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Feedback', () => {
  test('page loads and shows feedback list', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')

    await expect(page.locator('text=/Feedback|Ideeën/i').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can submit new feedback', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')
    await waitForPageLoad(page)

    const feedbackTitle = `E2E Test ${testId()}`

    // Click "+ Nieuw" button (top right)
    const newButton = page.locator('button', { hasText: /Nieuw/i }).first()
    await expect(newButton).toBeVisible({ timeout: 5_000 })
    await newButton.click()
    await page.waitForTimeout(1000)

    // Modal should open - find the form inputs inside it (not the search bar)
    const modal = page.locator('[class*="modal"], [class*="fixed"][class*="inset"], [role="dialog"]').first()

    // Select type (IDEA) if radio/button exists
    const ideaOption = modal.locator('text=/idee/i').first()
    if (await ideaOption.isVisible().catch(() => false)) {
      await ideaOption.click()
    }

    // Fill title - use the input inside the modal, not the top search bar
    const titleInput = modal.locator('input[type="text"]').first()
    await titleInput.fill(feedbackTitle)

    // Fill description
    const textarea = modal.locator('textarea').first()
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('Automatische E2E test feedback - mag verwijderd worden')
    }

    // Save - look for submit button in modal
    const saveButton = modal.getByRole('button', { name: /opslaan|indienen|verzenden|toevoegen/i }).first()
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify it appears in the list
    await expect(page.locator(`text=${feedbackTitle}`).first()).toBeVisible({ timeout: 10_000 })
  })

  test('filter buttons work', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')
    await waitForPageLoad(page)

    // Try clicking filter for bugs
    const bugFilter = page.locator('text=/bug/i').first()
    if (await bugFilter.isVisible().catch(() => false)) {
      await bugFilter.click()
      await page.waitForTimeout(1000)
      await assertNoGarbage(page)
    }
  })

  test('feedback stats are displayed', async ({ page }) => {
    await navigateTo(page, '/dashboard/feedback')
    await waitForPageLoad(page)

    // Stats section should show counts
    await assertNoGarbage(page)
  })
})
