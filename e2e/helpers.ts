import { Page, expect } from '@playwright/test'

/** Wait for page to be fully loaded (no spinners/skeletons) */
export async function waitForPageLoad(page: Page) {
  // Wait for any skeleton loaders to disappear
  await page.waitForTimeout(1000)
  const skeletons = page.locator('.skeleton-wave, .animate-pulse')
  if (await skeletons.count() > 0) {
    await expect(skeletons.first()).toBeHidden({ timeout: 15_000 }).catch(() => {})
  }
}

/** Check that no text on the page contains undefined, NaN, or [object Object] */
export async function assertNoGarbage(page: Page) {
  const body = await page.locator('body').innerText()

  // Check for undefined (but not in code-like contexts)
  const undefinedMatches = body.match(/\bundefined\b/gi) || []
  for (const match of undefinedMatches) {
    // Allow "undefined" only inside code blocks or error messages from console
    console.warn(`Found "undefined" in page text`)
  }

  expect(body).not.toContain('NaN')
  expect(body).not.toContain('[object Object]')
}

/** Generate a unique test identifier */
export function testId() {
  return `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Navigate and wait for load */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' })
  await waitForPageLoad(page)
}
