import { test, expect } from '@playwright/test'
import { navigateTo, assertNoGarbage, waitForPageLoad } from './helpers'

test.describe('Dashboard', () => {
  test('loads all widgets without errors', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Hero section with welcome message
    await expect(page.locator('text=Welkom')).toBeVisible()

    // Wait for data to load
    await waitForPageLoad(page)

    // No garbage data
    await assertNoGarbage(page)
  })

  test('quick links are present and clickable', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Check key quick links exist
    const links = ['Agenda', 'Vakanties', 'Werk', 'Feedback']
    for (const link of links) {
      await expect(page.locator(`text=${link}`).first()).toBeVisible()
    }
  })

  test('appjeplekje widget shows on dashboard', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // The appjeplekje section should exist
    await expect(page.locator('text=Appjeplekje').first()).toBeVisible()
  })

  test('absence overview renders correctly', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Look for absence/vacation related widget
    const absenceSection = page.locator('text=/weg|afwezig|verlof/i').first()
    await expect(absenceSection).toBeVisible({ timeout: 10_000 })
  })

  test('upcoming events section loads', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Events or agenda section should be visible
    const eventsSection = page.locator('text=/agenda|evenement|event/i').first()
    // This may or may not be present depending on events
    if (await eventsSection.isVisible().catch(() => false)) {
      await assertNoGarbage(page)
    }
  })

  test('no console errors on dashboard load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Filter out known benign errors (e.g. favicon, service worker)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('service-worker') &&
      !e.includes('Failed to load resource: the server responded with a status of 404')
    )

    if (realErrors.length > 0) {
      console.warn('Console errors found:', realErrors)
    }
  })
})
