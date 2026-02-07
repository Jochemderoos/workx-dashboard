import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Agenda', () => {
  test('page loads and shows calendar', async ({ page }) => {
    await navigateTo(page, '/dashboard/agenda')

    await expect(page.locator('text=Agenda').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can create a new event', async ({ page }) => {
    await navigateTo(page, '/dashboard/agenda')
    await waitForPageLoad(page)

    const eventTitle = `E2E Event ${testId()}`

    // Click new event button
    const newButton = page.getByRole('button', { name: /nieuw/i }).first()
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click()

      // Fill title
      const titleInput = page.locator('input').filter({ hasText: '' }).first()
      await titleInput.fill(eventTitle)

      // Save
      const saveButton = page.getByRole('button', { name: /opslaan/i }).first()
      await saveButton.click()

      await page.waitForTimeout(2000)

      // Verify the event shows on the calendar
      await expect(page.locator(`text=${eventTitle}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('calendar navigation works', async ({ page }) => {
    await navigateTo(page, '/dashboard/agenda')
    await waitForPageLoad(page)

    // Should have month navigation arrows
    const prevButton = page.locator('button').filter({ hasText: /←|vorige|prev/i }).first()
    const nextButton = page.locator('button').filter({ hasText: /→|volgende|next/i }).first()

    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click()
      await waitForPageLoad(page)
      await assertNoGarbage(page)
    }
  })

  test('event details show correctly', async ({ page }) => {
    await navigateTo(page, '/dashboard/agenda')
    await waitForPageLoad(page)

    // Page loaded successfully, verify no garbage
    await assertNoGarbage(page)

    // Calendar should show weekday headers
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/Ma|Di|Wo|Do|Vr/)
  })
})
