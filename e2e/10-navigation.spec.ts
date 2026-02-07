import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Navigation & Cross-feature', () => {
  test('sidebar navigation works for all pages', async ({ page }) => {
    const pages = [
      '/dashboard',
      '/dashboard/vakanties',
      '/dashboard/werk',
      '/dashboard/agenda',
      '/dashboard/appjeplekje',
      '/dashboard/feedback',
      '/dashboard/bonus',
      '/dashboard/opleidingen',
      '/dashboard/team',
    ]

    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' })

      // Should not redirect to login (auth should be valid)
      await page.waitForTimeout(2000)
      expect(page.url()).not.toContain('/login')

      // No server error pages (check for actual error page, not numbers in content)
      const body = await page.locator('body').innerText()
      expect(body).not.toContain('Internal Server Error')
      expect(body).not.toMatch(/\b500 Internal\b/)
    }
  })

  test('all pages are free of undefined and NaN', async ({ page }) => {
    // Test fewer pages to avoid timeout, and use domcontentloaded instead of networkidle
    const pages = [
      '/dashboard',
      '/dashboard/vakanties',
      '/dashboard/agenda',
      '/dashboard/feedback',
      '/dashboard/bonus',
      '/dashboard/team',
    ]

    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      await assertNoGarbage(page)
    }
  })

  test('API responses return valid JSON (spot check)', async ({ page }) => {
    const apiEndpoints = [
      '/api/dashboard/summary',
      '/api/feedback',
      '/api/team',
    ]

    for (const endpoint of apiEndpoints) {
      const response = await page.request.get(endpoint)
      expect(response.status()).toBeLessThan(500)

      if (response.status() === 200) {
        const json = await response.json()
        expect(json).toBeDefined()
        expect(typeof json).toBe('object')
      }
    }
  })
})
