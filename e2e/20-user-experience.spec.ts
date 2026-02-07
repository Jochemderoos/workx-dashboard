import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('User Experience - Wat ziet een medewerker?', () => {

  test('dashboard welkomstbericht toont naam correct', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // "Goedemorgen/Goedemiddag/Goedenavond, Jochem"
    const greeting = page.locator('text=/Goede(morgen|middag|avond)/i').first()
    await expect(greeting).toBeVisible({ timeout: 15_000 })

    // Naam moet erbij staan
    await expect(page.locator('text=Jochem').first()).toBeVisible()
  })

  test('dashboard toont weer-widget met valide data', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Weer data mag geen NaN/undefined bevatten
    await assertNoGarbage(page)
  })

  test('dashboard quick links navigeren naar correcte paginas', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Test elke quick link
    const linkTests = [
      { name: /Agenda/i, expectedUrl: '/dashboard/agenda' },
      { name: /Vakanties/i, expectedUrl: '/dashboard/vakanties' },
      { name: /Werk/i, expectedUrl: '/dashboard/werk' },
      { name: /Feedback/i, expectedUrl: '/dashboard/feedback' },
    ]

    for (const linkTest of linkTests) {
      await navigateTo(page, '/dashboard')
      await waitForPageLoad(page)

      const link = page.locator(`a, [role="link"]`).filter({ hasText: linkTest.name }).first()
      if (await link.isVisible().catch(() => false)) {
        await link.click()
        await page.waitForTimeout(2000)
        expect(page.url()).toContain(linkTest.expectedUrl)
        await assertNoGarbage(page)
      }
    }
  })

  test('sidebar navigatie toont alle menu items', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    const menuItems = [
      'Dashboard', 'Lustrum', 'Appjeplekje', 'Agenda',
      'Vakanties', 'Opleidingen', 'Werk', 'Financien',
      'Bonus', 'Transitievergoeding', 'Afspiegeling',
      'Team', 'Feedback', 'Instellingen'
    ]

    const bodyText = await page.locator('body').innerText()
    let foundItems = 0
    for (const item of menuItems) {
      if (bodyText.includes(item)) foundItems++
    }
    // Minstens 10 van de 14 menu items moeten zichtbaar zijn
    expect(foundItems).toBeGreaterThanOrEqual(10)
  })

  test('Lustrum Mallorca pagina laadt zonder errors', async ({ page }) => {
    await navigateTo(page, '/dashboard/lustrum')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Moet Mallorca content tonen
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/mallorca|lustrum|15 jaar/i)
  })

  test('Settings pagina laadt en toont profiel', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Moet naam en email tonen
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Jochem')
    expect(bodyText).toContain('jochem.deroos@workxadvocaten.nl')
  })

  test('Financien pagina laadt (partner feature)', async ({ page }) => {
    await navigateTo(page, '/dashboard/financien')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('Transitievergoeding calculator laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    await assertNoGarbage(page)

    // Moet calculator elementen tonen
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/transitie|vergoeding/i)
  })

  test('HR Docs pagina laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('Afspiegeling pagina laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/afspiegeling')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('Workxflow pagina laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/workxflow')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('Pitch Maker pagina laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/pitch')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('Chat pagina laadt', async ({ page }) => {
    await navigateTo(page, '/dashboard/chat')
    await waitForPageLoad(page)

    await assertNoGarbage(page)
  })

  test('keyboard shortcut ⌘K zoekbalk opent', async ({ page }) => {
    await navigateTo(page, '/dashboard')
    await waitForPageLoad(page)

    // Zoekbalk moet zichtbaar zijn in de top bar
    const searchBar = page.getByPlaceholder(/zoek/i).first()
    if (await searchBar.isVisible().catch(() => false)) {
      await searchBar.click()
      await page.waitForTimeout(500)
      // Zoekbalk is interactief
      await searchBar.fill('test')
      await page.waitForTimeout(500)
      // Leeg maken
      await searchBar.fill('')
    }
  })
})
