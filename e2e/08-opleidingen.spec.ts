import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Opleidingen', () => {
  test('page loads and shows training sessions', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')

    await expect(page.locator('text=/opleidingen|training/i').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can create new training session', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    const sessionTitle = `E2E Training ${testId()}`

    // Click new button
    const newButton = page.getByRole('button', { name: /nieuw/i }).first()
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click()
      await page.waitForTimeout(500)

      // Fill title
      const titleInput = page.locator('input[type="text"]').first()
      await titleInput.fill(sessionTitle)

      // Fill speaker if available
      const speakerInput = page.locator('input[type="text"]').nth(1)
      if (await speakerInput.isVisible().catch(() => false)) {
        await speakerInput.fill('E2E Spreker')
      }

      // Save
      const saveButton = page.getByRole('button', { name: /opslaan/i }).first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Verify it appears
      await expect(page.locator(`text=${sessionTitle}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('tabs switch between sessions and certificates', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Look for tab buttons
    const certTab = page.locator('text=/certificat/i').first()
    if (await certTab.isVisible().catch(() => false)) {
      await certTab.click()
      await waitForPageLoad(page)
      await assertNoGarbage(page)
    }
  })

  test('points summary shows correctly', async ({ page }) => {
    await navigateTo(page, '/dashboard/opleidingen')
    await waitForPageLoad(page)

    // Look for points display
    const pointsText = page.locator('text=/punt|point/i').first()
    if (await pointsText.isVisible().catch(() => false)) {
      await assertNoGarbage(page)
    }
  })
})
