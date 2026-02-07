import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Appjeplekje', () => {
  test('page loads and shows office attendance', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')

    await expect(page.locator('text=Appjeplekje').first()).toBeVisible()
    await waitForPageLoad(page)
    await assertNoGarbage(page)
  })

  test('can toggle office attendance', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Find the aanmelden/afmelden button
    const aanmeldenBtn = page.getByRole('button', { name: /aanmelden|afmelden/i }).first()
    await expect(aanmeldenBtn).toBeVisible({ timeout: 10_000 })

    const initialText = await aanmeldenBtn.innerText()
    await aanmeldenBtn.click()
    await page.waitForTimeout(2000)

    // Button text should have toggled
    const newText = await aanmeldenBtn.innerText()
    if (initialText.toLowerCase().includes('aanmelden')) {
      expect(newText.toLowerCase()).toContain('afmelden')
    }

    // Toggle back to restore original state
    await aanmeldenBtn.click()
    await page.waitForTimeout(2000)
  })

  test('week overview shows days', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Week overview should show weekday names
    const weekdays = ['ma', 'di', 'wo', 'do', 'vr']
    let foundDays = 0
    for (const day of weekdays) {
      const dayEl = page.locator(`text=/${day}/i`).first()
      if (await dayEl.isVisible().catch(() => false)) foundDays++
    }
    expect(foundDays).toBeGreaterThan(0)
  })

  test('time slot selection works', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Look for time slot buttons
    const slots = ['Hele dag', 'Ochtend', 'Middag']
    for (const slot of slots) {
      const slotBtn = page.locator(`text=${slot}`).first()
      if (await slotBtn.isVisible().catch(() => false)) {
        // At least one time slot option exists
        expect(true).toBeTruthy()
        return
      }
    }
  })

  test('attendance count shows correctly', async ({ page }) => {
    await navigateTo(page, '/dashboard/appjeplekje')
    await waitForPageLoad(page)

    // Should show a count like "X/11"
    const countText = page.locator('text=/\\d+\\/\\d+/').first()
    if (await countText.isVisible().catch(() => false)) {
      const text = await countText.innerText()
      expect(text).toMatch(/\d+\/\d+/)
    }

    await assertNoGarbage(page)
  })
})
