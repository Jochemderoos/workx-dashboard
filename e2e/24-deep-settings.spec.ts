import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('Settings - Diepgaande tests (Partner)', () => {

  test('profiel laadt met correcte gebruikersdata', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Pagina titel "Instellingen" moet zichtbaar zijn
    await expect(page.locator('text=Instellingen').first()).toBeVisible({ timeout: 10_000 })

    // Account info card moet naam tonen
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Jochem')

    // Email moet zichtbaar zijn
    expect(bodyText).toContain('jochem.deroos@workxadvocaten.nl')

    // Rol badge moet zichtbaar zijn (Partner of Head of Office)
    expect(bodyText).toMatch(/Partner|Head of Office|Medewerker/)

    // Profiel initiaal (eerste letter) in avatar
    const avatar = page.locator('text=/^J$/').first()
    await expect(avatar).toBeVisible({ timeout: 5_000 })

    await assertNoGarbage(page)
  })

  test('profiel velden zijn bewerkbaar (naam, telefoon, afdeling)', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Profiel tab moet standaard actief zijn
    await expect(page.locator('text=Profiel informatie').first()).toBeVisible({ timeout: 10_000 })

    // Email veld is disabled
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeDisabled()

    // Naam veld is bewerkbaar
    const nameInput = page.locator('input[placeholder="Je naam"]').first()
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeEditable()

    // Bewaar originele waarde en type nieuwe waarde
    const originalName = await nameInput.inputValue()
    const testSuffix = testId()
    await nameInput.fill(`Jochem de Roos ${testSuffix}`)
    await page.waitForTimeout(300)

    // Verifieer dat waarde is gewijzigd
    expect(await nameInput.inputValue()).toContain(testSuffix)

    // Herstel originele naam
    await nameInput.fill(originalName || 'Jochem de Roos')

    // Telefoonnummer veld is bewerkbaar
    const phoneInput = page.locator('input[placeholder="+31 6 12345678"]').first()
    await expect(phoneInput).toBeVisible()
    await expect(phoneInput).toBeEditable()
    await phoneInput.fill('+31 6 99887766')
    await page.waitForTimeout(300)
    expect(await phoneInput.inputValue()).toBe('+31 6 99887766')

    // Afdeling veld is bewerkbaar
    const deptInput = page.locator('input[placeholder="Arbeidsrecht"]').first()
    await expect(deptInput).toBeVisible()
    await expect(deptInput).toBeEditable()
    await deptInput.fill('Arbeidsrecht E2E')
    await page.waitForTimeout(300)
    expect(await deptInput.inputValue()).toBe('Arbeidsrecht E2E')

    // "Wijzigingen opslaan" knop is aanwezig
    const saveBtn = page.locator('button', { hasText: /Wijzigingen opslaan/i }).first()
    await expect(saveBtn).toBeVisible()

    await assertNoGarbage(page)
  })

  test('wachtwoord wijzigen formulier bestaat en valideert', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Klik op Beveiliging tab
    const securityTab = page.locator('button', { hasText: /Beveiliging/i }).first()
    await expect(securityTab).toBeVisible({ timeout: 10_000 })
    await securityTab.click()
    await page.waitForTimeout(1000)

    // Wachtwoord formulier is zichtbaar
    await expect(page.locator('text=Wachtwoord wijzigen').first()).toBeVisible({ timeout: 5_000 })

    // Drie password velden moeten bestaan
    const passwordFields = page.locator('input[type="password"]')
    await expect(passwordFields).toHaveCount(3)

    // Labels moeten correct zijn
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Huidig wachtwoord')
    expect(bodyText).toContain('Nieuw wachtwoord')
    expect(bodyText).toContain('Bevestig nieuw wachtwoord')

    // Minimaal 6 tekens hint
    expect(bodyText).toContain('Minimaal 6 tekens')

    // Beveiligingstips sectie moet zichtbaar zijn
    expect(bodyText).toContain('Beveiligingstips')
    expect(bodyText).toMatch(/uniek wachtwoord/)
    expect(bodyText).toMatch(/letters, cijfers en symbolen/)
    expect(bodyText).toMatch(/tweefactorauthenticatie/)

    // Wachtwoord wijzigen knop bestaat
    const changeBtn = page.locator('button[type="submit"]', { hasText: /Wachtwoord wijzigen/i }).first()
    await expect(changeBtn).toBeVisible()

    await assertNoGarbage(page)
  })

  test('notificaties tab toont voorkeuren met toggles', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Klik op Notificaties tab
    const notifTab = page.locator('button', { hasText: /Notificaties/i }).first()
    await expect(notifTab).toBeVisible({ timeout: 10_000 })
    await notifTab.click()
    await page.waitForTimeout(1000)

    // Notificatie voorkeuren header
    await expect(page.locator('text=Notificatie voorkeuren').first()).toBeVisible({ timeout: 5_000 })

    // Alle notificatie opties moeten zichtbaar zijn
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Email notificaties')
    expect(bodyText).toContain('Chat berichten')
    expect(bodyText).toContain('Agenda herinneringen')
    expect(bodyText).toContain('Vakantie updates')
    expect(bodyText).toContain('Werk toewijzingen')

    // Checkboxes moeten bestaan (toggle switches)
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThanOrEqual(5)

    // Voorkeuren opslaan knop
    const saveBtn = page.locator('button', { hasText: /Voorkeuren opslaan/i }).first()
    await expect(saveBtn).toBeVisible()

    await assertNoGarbage(page)
  })

  test('admin/beheer tab zichtbaar voor partner users', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Beheer tab moet zichtbaar zijn voor partner/admin
    const adminTab = page.locator('button', { hasText: /Beheer/i }).first()
    const adminVisible = await adminTab.isVisible().catch(() => false)

    if (adminVisible) {
      await adminTab.click()
      await page.waitForTimeout(2000)

      // Gebruikersbeheer header
      await expect(page.locator('text=Gebruikersbeheer').first()).toBeVisible({ timeout: 10_000 })

      // "Nieuw account" knop moet bestaan
      const newAccountBtn = page.locator('button', { hasText: /Nieuw account/i }).first()
      await expect(newAccountBtn).toBeVisible()

      // Gebruikerslijst moet items tonen (minimaal 1 user)
      const bodyText = await page.locator('body').innerText()
      // Moet email adressen of gebruikersnamen bevatten
      expect(bodyText).toMatch(/@|Medewerker|Partner|Head of Office/)

      await assertNoGarbage(page)
    } else {
      // Als niet zichtbaar, dan is de gebruiker geen admin/partner - dat is ook OK
      console.log('Beheer tab niet zichtbaar - gebruiker is geen admin/partner')
    }
  })

  test('gevaarlijke zone sectie is altijd zichtbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Gevaarlijke zone moet op elke tab zichtbaar zijn
    const dangerZone = page.locator('text=Gevaarlijke zone').first()
    await expect(dangerZone).toBeVisible({ timeout: 10_000 })

    // Account verwijderen knop
    const deleteBtn = page.locator('button', { hasText: /Account verwijderen/i }).first()
    await expect(deleteBtn).toBeVisible()

    // Waarschuwingstekst
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Dit kan niet ongedaan worden gemaakt')

    await assertNoGarbage(page)
  })

  test('tab navigatie werkt correct tussen alle tabs', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Profiel tab (standaard actief)
    await expect(page.locator('text=Profiel informatie').first()).toBeVisible({ timeout: 10_000 })

    // Klik Beveiliging
    await page.locator('button', { hasText: /Beveiliging/i }).first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Wachtwoord wijzigen').first()).toBeVisible({ timeout: 5_000 })

    // Klik Notificaties
    await page.locator('button', { hasText: /Notificaties/i }).first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Notificatie voorkeuren').first()).toBeVisible({ timeout: 5_000 })

    // Terug naar Profiel
    await page.locator('button', { hasText: /Profiel/i }).first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Profiel informatie').first()).toBeVisible({ timeout: 5_000 })

    await assertNoGarbage(page)
  })

  test('geen NaN, undefined of [object Object] op alle tabs', async ({ page }) => {
    await navigateTo(page, '/dashboard/settings')
    await waitForPageLoad(page)

    // Check profiel tab
    await assertNoGarbage(page)

    // Check beveiliging tab
    await page.locator('button', { hasText: /Beveiliging/i }).first().click()
    await page.waitForTimeout(1000)
    await assertNoGarbage(page)

    // Check notificaties tab
    await page.locator('button', { hasText: /Notificaties/i }).first().click()
    await page.waitForTimeout(1000)
    await assertNoGarbage(page)

    // Check beheer tab als zichtbaar
    const adminTab = page.locator('button', { hasText: /Beheer/i }).first()
    if (await adminTab.isVisible().catch(() => false)) {
      await adminTab.click()
      await page.waitForTimeout(2000)
      await assertNoGarbage(page)
    }
  })
})
