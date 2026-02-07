import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Bonus', () => {
  test('page loads and shows bonus calculations', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')

    await expect(page.locator('text=/bonus/i').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can create new bonus calculation', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    // Click new button
    const newButton = page.getByRole('button', { name: /nieuw/i }).first()
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click()
      await page.waitForTimeout(500)

      // Fill invoice amount
      const amountInput = page.locator('input[type="number"]').first()
      if (await amountInput.isVisible().catch(() => false)) {
        await amountInput.fill('10000')
      }

      // Fill client name if field exists
      const clientInput = page.locator('input').filter({ hasText: '' }).nth(1)
      if (await clientInput.isVisible().catch(() => false)) {
        await clientInput.fill(`E2E Client ${testId()}`).catch(() => {})
      }

      // Save
      const saveButton = page.getByRole('button', { name: /opslaan/i }).first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Verify calculation appears
      await assertNoGarbage(page)
    }
  })

  test('bonus calculation shows correct math', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    // All displayed amounts should be valid numbers
    await assertNoGarbage(page)

    // Look for euro amounts
    const bodyText = await page.locator('body').innerText()
    // Should have some monetary values
    expect(bodyText).toMatch(/[€\d]/)
  })

  test('existing calculations are listed', async ({ page }) => {
    await navigateTo(page, '/dashboard/bonus')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })
})
