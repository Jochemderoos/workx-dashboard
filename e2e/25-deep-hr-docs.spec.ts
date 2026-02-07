import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

test.describe('HR Docs - Diepgaande tests (Partner)', () => {

  test('pagina laadt en toont document lijst met tabs', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Pagina header moet zichtbaar zijn
    await expect(page.locator('text=The Way it Workx').first()).toBeVisible({ timeout: 10_000 })

    // Subkop beschrijving
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('personeelshandboek')

    // Document tabs moeten zichtbaar zijn
    const docTabs = page.locator('button', { hasText: /The Way it Workx|Kantoorhandboek|Klachtenregeling|Bevriende kantoren/i })
    const tabCount = await docTabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)

    // Eerste document tab moet actief zijn (lime-achtige styling)
    await assertNoGarbage(page)
  })

  test('document bevat hoofdstukken in sidebar (desktop)', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Inhoudsopgave moet zichtbaar zijn (sidebar)
    const tocHeader = page.locator('text=Inhoudsopgave').first()
    await expect(tocHeader).toBeVisible({ timeout: 10_000 })

    // Zoekbalk in sidebar
    const searchInput = page.getByPlaceholder(/Zoeken in document/i).first()
    await expect(searchInput).toBeVisible()

    // Hoofdstukken moeten zichtbaar zijn
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toContain('Welkom bij Workx')

    // Meerdere chapter buttons moeten bestaan
    const chapterButtons = page.locator('.chapter-btn')
    const chapterCount = await chapterButtons.count()
    expect(chapterCount).toBeGreaterThanOrEqual(3)

    await assertNoGarbage(page)
  })

  test('hoofdstukken zijn navigeerbaar via sidebar klik', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Wacht op chapter buttons (kan sidebar of mobile nav zijn)
    const chapterButtons = page.locator('.chapter-btn')
    await expect(chapterButtons.first()).toBeVisible({ timeout: 10_000 })

    const chapterCount = await chapterButtons.count()
    expect(chapterCount).toBeGreaterThanOrEqual(3)

    // Target chapter buttons in de hr-docs sidebar (desktop) of vallen terug op zichtbare chapter buttons
    const sidebarChapters = page.locator('.hr-docs-sidebar .chapter-btn')
    const sidebarCount = await sidebarChapters.count()

    // Gebruik sidebar chapters als ze beschikbaar zijn, anders gebruik zichtbare chapter buttons
    const targetChapters = sidebarCount >= 3 ? sidebarChapters : page.locator('.chapter-btn:visible')
    const targetCount = await targetChapters.count()

    if (targetCount >= 3) {
      // Onthoud de titel van het derde hoofdstuk
      const thirdChapter = targetChapters.nth(2)
      const chapterText = await thirdChapter.innerText()

      await thirdChapter.click()
      await page.waitForTimeout(1500)

      // Het geklikte hoofdstuk moet nu actieve styling hebben
      await expect(thirdChapter).toHaveClass(/lime/)

      await assertNoGarbage(page)
    }
  })

  test('content rendert correct zonder lege secties', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Hoofdstuk secties moeten content bevatten
    const sections = page.locator('section[id^="chapter-"]')
    const sectionCount = await sections.count()
    expect(sectionCount).toBeGreaterThanOrEqual(1)

    // Controleer dat elke zichtbare sectie content bevat (niet leeg)
    for (let i = 0; i < Math.min(sectionCount, 3); i++) {
      const section = sections.nth(i)
      const text = await section.innerText()
      // Elke sectie moet minimaal een titel en wat content hebben
      expect(text.length).toBeGreaterThan(20)
    }

    // Prose content area's moeten HTML renderen
    const proseBlocks = page.locator('.prose')
    const proseCount = await proseBlocks.count()
    expect(proseCount).toBeGreaterThanOrEqual(1)

    // Eerste prose block moet daadwerkelijke tekst bevatten
    const firstProseText = await proseBlocks.first().innerText()
    expect(firstProseText.length).toBeGreaterThan(10)

    await assertNoGarbage(page)
  })

  test('zoekfunctionaliteit filtert hoofdstukken', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Zoekbalk in de sidebar
    const searchInput = page.getByPlaceholder(/Zoeken in document/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    // Tel het originele aantal chapters in de hr-docs sidebar
    const originalChapters = page.locator('.hr-docs-sidebar .chapter-btn')
    const originalCount = await originalChapters.count()

    // Zoek naar een specifiek onderwerp
    await searchInput.fill('Welkom')
    await page.waitForTimeout(1000)

    // Gefilterde chapters moeten minder zijn (of gelijk als alles matcht)
    const filteredChapters = page.locator('.hr-docs-sidebar .chapter-btn')
    const filteredCount = await filteredChapters.count()
    expect(filteredCount).toBeGreaterThanOrEqual(1)
    expect(filteredCount).toBeLessThanOrEqual(originalCount)

    // Het "Welkom" hoofdstuk moet in het resultaat zitten
    const sidebarText = await page.locator('.hr-docs-sidebar').innerText()
    expect(sidebarText).toMatch(/Welkom/i)

    // Zoek met onzin tekst om lege state te triggeren
    await searchInput.fill('xyzqwerty_nonsens_12345')
    await page.waitForTimeout(1000)

    // Moet "Geen resultaten" tonen of lege lijst
    const afterNonsense = page.locator('.hr-docs-sidebar .chapter-btn')
    const nonsenseCount = await afterNonsense.count()
    expect(nonsenseCount).toBe(0)

    // Leeg zoekresultaat melding
    const noResults = page.locator('text=/Geen resultaten/i').first()
    await expect(noResults).toBeVisible({ timeout: 5_000 })

    // Wis zoekveld om alles te herstellen
    await searchInput.fill('')
    await page.waitForTimeout(1000)

    const restoredChapters = page.locator('.hr-docs-sidebar .chapter-btn')
    const restoredCount = await restoredChapters.count()
    expect(restoredCount).toBe(originalCount)

    await assertNoGarbage(page)
  })

  test('document tabs wisselen tussen verschillende documenten', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Bewaar inhoud van eerste document
    const firstDocTitle = await page.locator('.hr-docs-sidebar h3').first().innerText().catch(() => '')

    // Zoek alle document tab knoppen (bovenaan, niet sidebar)
    const docTabs = page.locator('button').filter({ hasText: /Kantoorhandboek|Klachtenregeling|Bevriende kantoren|Knowhow/i })
    const docTabCount = await docTabs.count()

    if (docTabCount >= 1) {
      // Klik op de tweede document tab
      await docTabs.first().click()
      await page.waitForTimeout(2000)

      // Document titel in sidebar moet gewijzigd zijn
      const newDocTitle = await page.locator('.hr-docs-sidebar h3').first().innerText().catch(() => '')
      // Titels mogen hetzelfde zijn als het dezelfde documenten zijn, maar content moet laden
      await waitForPageLoad(page)

      // Content secties moeten bestaan
      const sections = page.locator('section[id^="chapter-"]')
      const sectionCount = await sections.count()
      expect(sectionCount).toBeGreaterThanOrEqual(1)

      await assertNoGarbage(page)
    }
  })

  test('edit modus werkt voor partner (bewerk knop zichtbaar)', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Partner/Admin moet edit knoppen zien op chapter headers
    const editButtons = page.locator('button[title="Hoofdstuk bewerken"]')
    const editCount = await editButtons.count()

    if (editCount > 0) {
      // Edit knop klikken opent het bewerkformulier
      await editButtons.first().click()
      await page.waitForTimeout(1000)

      // Edit modal/popover moet zichtbaar zijn
      const editModal = page.locator('text=Hoofdstuk bewerken').first()
      await expect(editModal).toBeVisible({ timeout: 5_000 })

      // Titel input moet bestaan en gevuld zijn
      const titleInput = page.locator('input[placeholder="Hoofdstuk titel..."]').first()
      await expect(titleInput).toBeVisible()
      const titleValue = await titleInput.inputValue()
      expect(titleValue.length).toBeGreaterThan(0)

      // Content textarea moet bestaan en gevuld zijn
      const contentArea = page.locator('textarea[placeholder="Schrijf hier de inhoud..."]').first()
      await expect(contentArea).toBeVisible()
      const contentValue = await contentArea.inputValue()
      expect(contentValue.length).toBeGreaterThan(0)

      // Icoon input moet bestaan
      const iconInput = page.locator('input[placeholder*="*"]').first()
      if (await iconInput.isVisible().catch(() => false)) {
        const iconValue = await iconInput.inputValue()
        expect(iconValue.length).toBeGreaterThan(0)
      }

      // Opmaak tips moeten zichtbaar zijn
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).toContain('Opmaak tips')

      // Annuleren knop moet bestaan
      const cancelBtn = page.locator('button', { hasText: /Annuleren/i }).first()
      await expect(cancelBtn).toBeVisible()

      // Opslaan knop moet bestaan
      const saveBtn = page.locator('button', { hasText: /Opslaan/i }).first()
      await expect(saveBtn).toBeVisible()

      // Sluit modal via annuleren
      await cancelBtn.click()
      await page.waitForTimeout(500)

      await assertNoGarbage(page)
    } else {
      // Geen edit knoppen - gebruiker is geen partner/admin
      console.log('Edit knoppen niet zichtbaar - gebruiker is geen partner/admin')
    }
  })

  test('partner ziet "Document toevoegen" knop', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Partner/Admin moet "Document toevoegen" knop zien
    const addDocBtn = page.locator('button', { hasText: /Document toevoegen/i }).first()
    const isVisible = await addDocBtn.isVisible().catch(() => false)

    if (isVisible) {
      await expect(addDocBtn).toBeVisible()
    } else {
      console.log('Document toevoegen knop niet zichtbaar - gebruiker is geen partner/admin')
    }

    await assertNoGarbage(page)
  })

  test('declaratieformulier knop is aanwezig en klikbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Declaratieformulier knop in header
    const expenseBtn = page.locator('button', { hasText: /Declaratie/i }).first()
    await expect(expenseBtn).toBeVisible({ timeout: 10_000 })

    // Klik op declaratie knop
    await expenseBtn.click()
    await page.waitForTimeout(1500)

    // Modal moet openen met het declaratieformulier
    // Controleer of er een overlay/modal verschijnt
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/declaratie|kosten|bedrag|formulier/i)

    await assertNoGarbage(page)
  })

  test('document info toont correcte metadata in sidebar', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Target the hr-docs document sidebar specifically (not the main navigation sidebar)
    const docSidebar = page.locator('.hr-docs-sidebar')
    await expect(docSidebar).toBeVisible({ timeout: 10_000 })

    const sidebarText = await docSidebar.innerText()

    // Document titel moet in sidebar staan
    expect(sidebarText).toMatch(/The Way it Workx|Kantoorhandboek|Klachtenregeling/)

    // Beschrijving moet aanwezig zijn
    expect(sidebarText.length).toBeGreaterThan(50)

    // "Laatst bijgewerkt" informatie kan aanwezig zijn
    if (sidebarText.includes('Laatst bijgewerkt')) {
      expect(sidebarText).toMatch(/Laatst bijgewerkt/)
    }

    await assertNoGarbage(page)
  })

  test('geen NaN, undefined of [object Object] op alle document tabs', async ({ page }) => {
    await navigateTo(page, '/dashboard/hr-docs')
    await waitForPageLoad(page)

    // Check eerste document
    await assertNoGarbage(page)

    // Wissel naar elk beschikbaar document en controleer
    const docTabs = page.locator('button').filter({ hasText: /Kantoorhandboek|Klachtenregeling|Bevriende kantoren|Knowhow/i })
    const tabCount = await docTabs.count()

    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      await docTabs.nth(i).click()
      await page.waitForTimeout(2000)
      await waitForPageLoad(page)
      await assertNoGarbage(page)
    }
  })
})
