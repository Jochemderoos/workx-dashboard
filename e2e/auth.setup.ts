import { test as setup, expect } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')

  // Fill login form
  await page.getByPlaceholder('naam@workxadvocaten.nl').fill(process.env.TEST_EMAIL!)
  await page.getByPlaceholder('••••••••').fill(process.env.TEST_PASSWORD!)

  // Click login button
  await page.getByRole('button', { name: 'Inloggen' }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
  await expect(page.locator('text=Welkom')).toBeVisible({ timeout: 15_000 })

  // Save auth state
  await page.context().storageState({ path: '.auth/session.json' })
})
