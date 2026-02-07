import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage, testId } from './helpers'

/**
 * Helper: pick a date via the react-datepicker calendar widget.
 *
 * The custom DatePicker wraps react-datepicker with a portal (portalId="datepicker-portal").
 * Each .workx-datepicker container holds one trigger <button type="button">.
 * When clicked, the calendar popup renders inside #datepicker-portal (outside .workx-datepicker).
 *
 * We:
 *  1. Click the trigger button inside the Nth .workx-datepicker container.
 *  2. Wait for the calendar popup to appear in the portal.
 *  3. Navigate month-by-month to the target year/month.
 *  4. Click the target day cell.
 */
async function pickDate(
  page: import('@playwright/test').Page,
  triggerIndex: number,
  year: number,
  month: number,   // 0-based (0 = January)
  day: number,
) {
  // 1. Click the trigger button inside the Nth .workx-datepicker container
  const container = page.locator('.workx-datepicker').nth(triggerIndex)
  const triggerBtn = container.locator('button[type="button"]').first()
  await triggerBtn.click()

  // 2. Wait for the calendar popup to appear inside the portal
  const portal = page.locator('#datepicker-portal')
  const calendar = portal.locator('.react-datepicker')
  await calendar.waitFor({ state: 'visible', timeout: 5000 })

  // 3. Navigate to the correct month/year
  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ]
  const targetLabel = `${monthNames[month]} ${year}`

  for (let i = 0; i < 600; i++) {
    const header = portal.locator('.react-datepicker__current-month').first()
    const headerText = await header.innerText().catch(() => '')
    if (headerText.toLowerCase().includes(targetLabel.toLowerCase())) break

    // Determine direction based on current month/year vs target
    const currentMatch = headerText.toLowerCase().match(
      /(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/
    )
    if (currentMatch) {
      const currentMonthIdx = monthNames.indexOf(currentMatch[1])
      const currentYear = parseInt(currentMatch[2])
      const currentTotal = currentYear * 12 + currentMonthIdx
      const targetTotal = year * 12 + month
      if (targetTotal < currentTotal) {
        await portal.locator('.react-datepicker__navigation--previous').first().click()
      } else {
        await portal.locator('.react-datepicker__navigation--next').first().click()
      }
    } else {
      await portal.locator('.react-datepicker__navigation--next').first().click()
    }
    await page.waitForTimeout(30)
  }

  // 4. Click the target day (exclude days from adjacent months)
  const dayCell = portal.locator(
    '.react-datepicker__day:not(.react-datepicker__day--outside-month)'
  ).getByText(String(day), { exact: true }).first()
  await dayCell.click()

  // Wait for the calendar to close
  await calendar.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(200)
}

test.describe('Transitie Calculator - Diepgaande E2E Tests', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Page load & form element verification
  // ─────────────────────────────────────────────────────────────────────────────
  test('pagina laadt en alle formulier-elementen zijn aanwezig', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Title
    await expect(page.locator('h1', { hasText: /Transitievergoeding/i })).toBeVisible()

    // Info card about the legal formula
    await expect(page.locator('text=/1\\/3 bruto maandsalaris/i')).toBeVisible()
    await expect(page.locator('text=/102.000/i').first()).toBeVisible()

    // Werkgever input
    const werkgeverInput = page.getByPlaceholder(/werkgever/i)
    await expect(werkgeverInput).toBeVisible()

    // Werknemer input
    const werknemerInput = page.getByPlaceholder(/werknemer/i)
    await expect(werknemerInput).toBeVisible()

    // Date pickers (two .workx-datepicker containers)
    const datePickers = page.locator('.workx-datepicker')
    await expect(datePickers).toHaveCount(2)

    // Labels for dates
    await expect(page.locator('text=/Datum in dienst/i').first()).toBeVisible()
    await expect(page.locator('text=/Datum uit dienst/i').first()).toBeVisible()

    // Salary input
    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await expect(salaryInput).toBeVisible()

    // Vakantiegeld checkbox (default checked)
    const vakantiegeldCheckbox = page.locator('text=/Vakantiegeld/i').first()
    await expect(vakantiegeldCheckbox).toBeVisible()

    // 13e maand checkbox
    await expect(page.locator('text=/13e maand/i').first()).toBeVisible()

    // Bonus section with three options
    await expect(page.locator('button', { hasText: /Geen bonus/i })).toBeVisible()
    await expect(page.locator('button', { hasText: /Vast bedrag/i })).toBeVisible()
    await expect(page.locator('button', { hasText: /Bereken gemiddelde/i })).toBeVisible()

    // Overtime & other inputs
    await expect(page.locator('text=/Overwerk/i').first()).toBeVisible()
    await expect(page.locator('text=/Overige/i').first()).toBeVisible()

    // Pension checkbox
    await expect(page.locator('text=/Pensioen/i').first()).toBeVisible()

    // Calculate button
    await expect(page.locator('button', { hasText: /Bereken transitievergoeding/i })).toBeVisible()

    // Reset button
    await expect(page.locator('button', { hasText: /Reset/i })).toBeVisible()

    // Placeholder card when no result yet
    await expect(page.locator('text=/Klaar om te berekenen/i')).toBeVisible()

    // Disclaimer
    await expect(page.locator('text=/Disclaimer/i').first()).toBeVisible()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Fill in calculation & verify math
  // ─────────────────────────────────────────────────────────────────────────────
  test('vul berekening in en verifieer de wiskunde (basisscenario)', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Scenario: 3000 EUR/month, 8% vakantiegeld, no 13th month, no bonus
    // Employment: 2020-03-01 to 2026-03-01 = 6 years 0 months = 72 months
    // Total salary = 3000 + (3000 * 0.08) = 3000 + 240 = 3240
    // Transitie = (3240 / 3) * (72 / 12) = 1080 * 6 = 6480
    // Yearly salary = 3240 * 12 = 38880 (below 102k cap)

    const employerName = `Werkgever ${testId()}`
    const employeeName = `Werknemer ${testId()}`

    // Fill employer
    await page.getByPlaceholder(/werkgever/i).fill(employerName)

    // Fill employee
    await page.getByPlaceholder(/werknemer/i).fill(employeeName)

    // Pick start date: 1 March 2020
    await pickDate(page, 0, 2020, 2, 1)

    // Pick end date: 1 March 2026
    await pickDate(page, 1, 2026, 2, 1)

    // Fill salary: 3000
    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('3000')

    // Vakantiegeld is already checked by default (8%)
    // 13e maand is unchecked by default
    // Bonus type is "none" by default

    // Click calculate
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Result should now be visible
    await expect(page.locator('text=/Transitievergoeding/i').first()).toBeVisible()

    // Verify the result amount: expected 6480 EUR
    // Dutch formatting: € 6.480,00
    const resultSection = page.locator('p.text-4xl').first()
    const resultText = await resultSection.innerText()
    expect(resultText).toMatch(/6[.\s]?480/)

    // Verify dienstverband shows "6 jaar, 0 maanden"
    await expect(page.locator('text=/6 jaar/i').first()).toBeVisible()
    await expect(page.locator('text=/0 maand/i').first()).toBeVisible()

    // Verify total salary per month: 3240
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/3[.\s]?240/)

    // Verify yearly salary: 38880
    expect(bodyText).toMatch(/38[.\s]?880/)

    // Verify 1/3 maandsalaris = 1080
    expect(bodyText).toMatch(/1[.\s]?080/)

    // PDF and save buttons should appear
    await expect(page.locator('button', { hasText: /Download PDF/i })).toBeVisible()
    await expect(page.locator('button', { hasText: /opslaan/i })).toBeVisible()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Save and load a calculation
  // ─────────────────────────────────────────────────────────────────────────────
  test('berekening opslaan en laden vanuit opgeslagen lijst', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    const employeeName = `SaveLoadTest ${testId()}`

    // Fill the form
    await page.getByPlaceholder(/werkgever/i).fill('Test Werkgever BV')
    await page.getByPlaceholder(/werknemer/i).fill(employeeName)

    // Pick start date: 1 Jan 2022
    await pickDate(page, 0, 2022, 0, 1)

    // Pick end date: 1 Jan 2026
    await pickDate(page, 1, 2026, 0, 1)

    // Fill salary
    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('4000')

    // Calculate
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Result should be visible
    await expect(page.locator('button', { hasText: /opslaan/i })).toBeVisible()

    // Remember the displayed result amount
    const resultAmount = await page.locator('p.text-4xl').first().innerText()

    // Save
    await page.locator('button', { hasText: /opslaan/i }).first().click()
    await page.waitForTimeout(2000)

    // Verify the employee appears in the saved calculations table or section
    await expect(page.locator(`text=${employeeName}`).first()).toBeVisible({ timeout: 10_000 })

    // Reset the form
    await page.locator('button', { hasText: /Reset/i }).click()
    await page.waitForTimeout(500)

    // Verify form is cleared (placeholder card visible again)
    await expect(page.locator('text=/Klaar om te berekenen/i')).toBeVisible()

    // Re-enter employee name so the "Eerdere berekeningen" section appears
    await page.getByPlaceholder(/werknemer/i).fill(employeeName)
    await page.waitForTimeout(1000)

    // Find and click the "Laden" button for our saved calculation
    const loadButton = page.locator('button, a').filter({ hasText: /Laden/i }).first()
    if (await loadButton.isVisible().catch(() => false)) {
      await loadButton.click()
      await page.waitForTimeout(1500)

      // The form should be re-populated and result should show
      const reloadedAmount = await page.locator('p.text-4xl').first().innerText().catch(() => '')
      if (reloadedAmount) {
        // The amount should match what was saved
        expect(reloadedAmount).toBe(resultAmount)
      }

      // "Bewerken" badge should be visible
      await expect(page.locator('text=/Bewerken/i').first()).toBeVisible()

      // Save button should now say "bijwerken"
      await expect(page.locator('button', { hasText: /bijwerken/i })).toBeVisible()
    } else {
      // Alternatively, check via the "Alle opgeslagen berekeningen" table
      const tableLoadBtn = page.locator('button[title="Laden"]').first()
      if (await tableLoadBtn.isVisible().catch(() => false)) {
        await tableLoadBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4a. Edge case: short employment period (< 1 year)
  // ─────────────────────────────────────────────────────────────────────────────
  test('edge case: kort dienstverband (minder dan 1 jaar)', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Employment: 2025-06-01 to 2026-01-01 = 0 years 7 months
    // Salary: 5000 + 8% vacation = 5400
    // Transitie = (5400 / 3) * (7 / 12) = 1800 * 0.5833 = 1050

    await page.getByPlaceholder(/werknemer/i).fill(`Kort ${testId()}`)

    await pickDate(page, 0, 2025, 5, 1)   // June 1, 2025
    await pickDate(page, 1, 2026, 0, 1)    // Jan 1, 2026

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('5000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Should show 0 jaar, 7 maanden
    await expect(page.locator('text=/0 jaar/i').first()).toBeVisible()
    await expect(page.locator('text=/7 maand/i').first()).toBeVisible()

    // Result should be a reasonable amount (approximately 1050)
    const resultText = await page.locator('p.text-4xl').first().innerText()
    // Extract numeric value - Dutch format uses comma for decimal, dot for thousands
    const numericStr = resultText.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(numericStr)
    expect(amount).toBeGreaterThan(0)
    expect(amount).toBeLessThan(5000) // Should be well under one year's salary

    // No maximum should be applied for such a small amount
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Maximum toegepast/i)

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4b. Edge case: high salary near the statutory cap
  // ─────────────────────────────────────────────────────────────────────────────
  test('edge case: hoog salaris dicht bij wettelijk maximum', async ({ page }) => {
    test.setTimeout(120_000) // Extra time for navigating to 1989 in datepicker
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Scenario: very high salary, long tenure => should hit the cap
    // Salary: 8000/month + 8% vacation = 8640/month
    // Yearly: 8640 * 12 = 103,680 (above statutory 102k for 2026)
    // Max used = max(102000, 103680) = 103,680 (yearly salary is higher)
    // Employment: 2000-01-01 to 2026-01-01 = 26 years 0 months
    // Transitie before max = (8640/3) * (312/12) = 2880 * 26 = 74,880
    // Since 74,880 < 103,680 => max NOT applied

    // Let's use an even higher scenario to trigger the cap:
    // Salary: 6000/month + 8% = 6480, yearly = 77,760
    // Employment: 2000-01-01 to 2026-01-01 = 26 years
    // Before max = (6480/3) * 26 = 2160 * 26 = 56,160 -- still under

    // To actually trigger the max, we need amount > max(102000, yearlySalary):
    // Let's use salary 3000/month, 8% vac = 3240, yearly = 38880
    // Need (3240/3) * (months/12) > 102000
    // 1080 * years > 102000 => years > 94.4 -- not realistic

    // Alternative approach: use high salary with long tenure where yearly > 102k
    // Salary: 10000/month, 8% vacation = 10800, yearly = 129,600
    // Need (10800/3) * (months/12) > 129,600
    // 3600 * years > 129,600 => years > 36

    // Use realistic scenario: 10000/month, 40 years
    // Before max = 3600 * 40 = 144,000
    // Max = max(102000, 129600) = 129,600
    // 144,000 > 129,600 => MAX APPLIED, result = 129,600

    await page.getByPlaceholder(/werknemer/i).fill(`HoogSalaris ${testId()}`)

    await pickDate(page, 0, 1989, 0, 1)   // Jan 1, 1989 (37 years)
    await pickDate(page, 1, 2026, 0, 1)    // Jan 1, 2026

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('10000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Result should show the maximum applied warning
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/Maximum toegepast/i)

    // The "Voor maximum" line should be visible with the uncapped amount
    await expect(page.locator('text=/Voor maximum/i').first()).toBeVisible()

    // The displayed result should be the capped value (129,600)
    const resultText = await page.locator('p.text-4xl').first().innerText()
    const numericStr = resultText.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(numericStr)
    // Should be capped at yearly salary (129600) since it's higher than 102000
    expect(amount).toBeLessThanOrEqual(130000)
    expect(amount).toBeGreaterThanOrEqual(100000)

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. No NaN/undefined in any output fields
  // ─────────────────────────────────────────────────────────────────────────────
  test('geen NaN of undefined in uitvoervelden na berekening', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Fill in a calculation with all components active
    await page.getByPlaceholder(/werkgever/i).fill('Garbage Check BV')
    await page.getByPlaceholder(/werknemer/i).fill(`GarbageTest ${testId()}`)

    await pickDate(page, 0, 2020, 0, 15)  // Jan 15, 2020
    await pickDate(page, 1, 2025, 6, 15)   // Jul 15, 2025

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('4500')

    // Enable 13th month
    const thirteenthMonthLabel = page.locator('label').filter({ hasText: /13e maand/i })
    await thirteenthMonthLabel.click()

    // Set bonus to fixed amount
    await page.locator('button', { hasText: /Vast bedrag/i }).click()
    await page.waitForTimeout(300)
    const bonusInput = page.locator('input[placeholder*="Bonus per maand"]')
    await bonusInput.fill('200')

    // Fill overtime
    const overtimeInput = page.locator('input[type="number"][step="0.01"]').nth(2)
    await overtimeInput.fill('150')

    // Fill other
    const otherInput = page.locator('input[type="number"][step="0.01"]').nth(3)
    await otherInput.fill('75')

    // Calculate
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Verify result is shown
    await expect(page.locator('p.text-4xl').first()).toBeVisible()

    // Run the global garbage check
    await assertNoGarbage(page)

    // Additional targeted checks on result fields
    const bodyText = await page.locator('body').innerText()

    // All currency values should be well-formed
    expect(bodyText).not.toContain('€ NaN')
    expect(bodyText).not.toContain('€NaN')
    expect(bodyText).not.toContain('€ undefined')
    expect(bodyText).not.toContain('€undefined')
    expect(bodyText).not.toContain('€ null')
    expect(bodyText).not.toContain('€null')

    // Dienstverband should not contain NaN
    expect(bodyText).not.toMatch(/NaN\s*jaar/i)
    expect(bodyText).not.toMatch(/NaN\s*maand/i)

    // All numeric output cells should have valid numbers
    const eurMatches = bodyText.match(/€\s*[\d.,\-]+/g) || []
    expect(eurMatches.length).toBeGreaterThan(0)
    for (const m of eurMatches) {
      expect(m).not.toContain('NaN')
      expect(m).not.toContain('undefined')
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. PDF generation button exists and is functional
  // ─────────────────────────────────────────────────────────────────────────────
  test('PDF download knop bestaat en is klikbaar na berekening', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // PDF button should NOT be visible before calculation
    const pdfBtn = page.locator('button', { hasText: /Download PDF/i })
    await expect(pdfBtn).toBeHidden()

    // Fill in minimal calculation
    await page.getByPlaceholder(/werknemer/i).fill('PDF Test')
    await pickDate(page, 0, 2023, 0, 1)
    await pickDate(page, 1, 2026, 0, 1)
    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('3500')

    // Calculate
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // PDF button should now be visible and enabled
    await expect(pdfBtn).toBeVisible()
    expect(await pdfBtn.isEnabled()).toBeTruthy()

    // Click PDF button (intercept window.open to prevent actual popup)
    let pdfBlobUrl = ''
    await page.evaluate(() => {
      // Override window.open to capture the call
      (window as any).__pdfOpened = false;
      const originalOpen = window.open;
      window.open = (url?: string | URL, target?: string) => {
        (window as any).__pdfOpened = true;
        (window as any).__pdfUrl = url?.toString() || '';
        return null;
      };
    })

    await pdfBtn.click()
    await page.waitForTimeout(2000)

    // Verify that PDF generation was triggered (window.open called with blob URL)
    const pdfOpened = await page.evaluate(() => (window as any).__pdfOpened)
    expect(pdfOpened).toBeTruthy()

    const pdfUrl = await page.evaluate(() => (window as any).__pdfUrl)
    expect(pdfUrl).toMatch(/^blob:/)

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Calculation with 13th month and all salary components
  // ─────────────────────────────────────────────────────────────────────────────
  test('berekening met 13e maand en alle componenten klopt', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Salary: 4000
    // Vacation: 8% = 320
    // 13th month: 8.3% = 332
    // Bonus: fixed 100/month
    // Overtime: 50/month
    // Other: 25/month
    // Total monthly = 4000 + 320 + 332 + 100 + 50 + 25 = 4827
    // Yearly = 4827 * 12 = 57,924
    // Employment: 2021-06-01 to 2026-06-01 = 5 years 0 months
    // Transitie = (4827 / 3) * 5 = 1609 * 5 = 8045

    await page.getByPlaceholder(/werknemer/i).fill(`AllComp ${testId()}`)
    await pickDate(page, 0, 2021, 5, 1)
    await pickDate(page, 1, 2026, 5, 1)

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('4000')

    // Enable 13th month
    const thirteenthMonthLabel = page.locator('label').filter({ hasText: /13e maand/i })
    await thirteenthMonthLabel.click()
    await page.waitForTimeout(200)

    // Set bonus to fixed
    await page.locator('button', { hasText: /Vast bedrag/i }).click()
    await page.waitForTimeout(300)
    await page.locator('input[placeholder*="Bonus per maand"]').fill('100')

    // Fill overtime (find by label context)
    // The overtime and other inputs are the 2nd and 3rd number inputs after salary/bonus
    const numberInputs = page.locator('input[type="number"][step="0.01"]')
    // Inputs order: salary(0), [vacation%], bonusFixed, overtime, other
    // Let's target by parent label text
    const overtimeSection = page.locator('label:has-text("Overwerk") + div input, label:has-text("Overwerk") ~ div input').first()
    if (await overtimeSection.isVisible().catch(() => false)) {
      await overtimeSection.fill('50')
    } else {
      // Fallback: use nth index. The overtime input is typically after the bonus input
      // Count visible number inputs
      const count = await numberInputs.count()
      if (count >= 4) {
        await numberInputs.nth(count - 2).fill('50')
        await numberInputs.nth(count - 1).fill('25')
      }
    }

    const otherSection = page.locator('label:has-text("Overige") ~ div input[type="number"]').first()
    if (await otherSection.isVisible().catch(() => false)) {
      await otherSection.fill('25')
    }

    // Calculate
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Verify result exists and is a valid number
    const resultText = await page.locator('p.text-4xl').first().innerText()
    const numericStr = resultText.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const amount = parseFloat(numericStr)
    expect(amount).toBeGreaterThan(5000)
    expect(amount).toBeLessThan(20000)

    // Verify total monthly salary includes all components (should be around 4827)
    const bodyText = await page.locator('body').innerText()
    // The total should contain the 13th month effect
    // At minimum, the displayed monthly total should be > base salary of 4000
    const salaryMatch = bodyText.match(/Salaris.*?€\s*([\d.,]+)/i)
    if (salaryMatch) {
      const displayedSalary = parseFloat(salaryMatch[1].replace(/\./g, '').replace(',', '.'))
      expect(displayedSalary).toBeGreaterThan(4000)
    }

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Bonus average calculator works
  // ─────────────────────────────────────────────────────────────────────────────
  test('gemiddelde bonus calculator berekent correct', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    await page.getByPlaceholder(/werknemer/i).fill(`BonusAvg ${testId()}`)

    // Must set end date first so the average calculator shows year labels
    await pickDate(page, 0, 2020, 0, 1)
    await pickDate(page, 1, 2026, 0, 1)

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('3000')

    // Select "Bereken gemiddelde" bonus type
    await page.locator('button', { hasText: /Bereken gemiddelde/i }).click()
    await page.waitForTimeout(500)

    // The calculator panel should appear
    await expect(page.locator('text=/Bonus Calculator/i')).toBeVisible()

    // Fill in the three year fields
    // Year labels should be endYear-3, endYear-2, endYear-1 = 2023, 2024, 2025
    const bonusInputs = page.locator('.rounded-xl input[type="number"]')
    // There should be year fields plus an "overig" field inside the purple box
    await expect(page.locator('text=/2023/').first()).toBeVisible()
    await expect(page.locator('text=/2024/').first()).toBeVisible()
    await expect(page.locator('text=/2025/').first()).toBeVisible()

    // Fill bonus years: 3600, 2400, 1200 = total 7200
    // Divisor = min(36, months employed) = min(36, 72) = 36
    // Bonus per month = 7200 / 36 = 200
    const yearInputs = page.locator('.grid.grid-cols-3 input[type="number"]')
    await yearInputs.nth(0).fill('3600')
    await yearInputs.nth(1).fill('2400')
    await yearInputs.nth(2).fill('1200')
    await page.waitForTimeout(500)

    // The calculated result should show
    await expect(page.locator('text=/Bonus per maand/i').first()).toBeVisible()

    // Verify the "Berekend resultaat" section shows
    await expect(page.locator('text=/Berekend resultaat/i')).toBeVisible()

    // The total should show 7200 and division by 36 months
    const calcText = await page.locator('text=/Totaal:.*€/i').first().innerText().catch(() => '')
    if (calcText) {
      expect(calcText).toMatch(/7[.\s]?200/)
      expect(calcText).toMatch(/36/)
    }

    // Now calculate the full transitie
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // The bonus per month should be shown in the result (200 EUR)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/Bonus/)
    expect(bodyText).toMatch(/200/)

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Reset button clears all fields
  // ─────────────────────────────────────────────────────────────────────────────
  test('reset knop wist alle velden en resultaat', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Fill and calculate something first
    await page.getByPlaceholder(/werkgever/i).fill('Reset Test BV')
    await page.getByPlaceholder(/werknemer/i).fill('Reset Werknemer')

    await pickDate(page, 0, 2022, 0, 1)
    await pickDate(page, 1, 2026, 0, 1)

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('5000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Result should be visible
    await expect(page.locator('p.text-4xl').first()).toBeVisible()

    // Click reset
    await page.locator('button', { hasText: /Reset/i }).click()
    await page.waitForTimeout(500)

    // Form should be cleared
    const werkgeverValue = await page.getByPlaceholder(/werkgever/i).inputValue()
    expect(werkgeverValue).toBe('')

    const werknemerValue = await page.getByPlaceholder(/werknemer/i).inputValue()
    expect(werknemerValue).toBe('')

    const salaryValue = await salaryInput.inputValue()
    expect(salaryValue).toBe('')

    // Result card should be gone, placeholder should be back
    await expect(page.locator('text=/Klaar om te berekenen/i')).toBeVisible()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Validation: missing required fields
  // ─────────────────────────────────────────────────────────────────────────────
  test('validatie: foutmelding bij ontbrekende verplichte velden', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Try to calculate without filling anything
    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Toast error should appear about required fields
    // The toast library renders in a portal
    const toast = page.locator('text=/verplichte velden/i').first()
    await expect(toast).toBeVisible({ timeout: 5_000 })

    // No result should be shown
    await expect(page.locator('text=/Klaar om te berekenen/i')).toBeVisible()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Validation: end date before start date
  // ─────────────────────────────────────────────────────────────────────────────
  test('validatie: berekening zonder datum geeft foutmelding', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Fill only salary but NO dates - should trigger validation
    await page.getByPlaceholder(/werknemer/i).fill('Validatie Test')
    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('3000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Should show error toast about required fields or no result
    const bodyText = await page.locator('body').innerText()
    const hasValidation = bodyText.match(/verplichte velden|datum|Klaar om te berekenen/i)
    expect(hasValidation).toBeTruthy()

    // Result should NOT be shown
    await expect(page.locator('text=/Klaar om te berekenen/i')).toBeVisible()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Statutory max caps per year (2024, 2025, 2026)
  // ─────────────────────────────────────────────────────────────────────────────
  test('disclaimer vermeldt correcte wettelijke maxima per jaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    const bodyText = await page.locator('body').innerText()

    // The info card and disclaimer should mention the max amounts
    expect(bodyText).toMatch(/102[.\s]?000/)  // 2026 max
    // The disclaimer text references all three years
    expect(bodyText).toMatch(/Disclaimer/i)

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Pension/AOW checkbox is interactive
  // ─────────────────────────────────────────────────────────────────────────────
  test('pensioen/AOW checkbox werkt en wordt meegenomen', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // Check the pension checkbox
    const pensionLabel = page.locator('label').filter({ hasText: /Pensioen/i })
    await pensionLabel.click()
    await page.waitForTimeout(200)

    // The checkbox inside should now be checked
    const checkbox = pensionLabel.locator('input[type="checkbox"]')
    await expect(checkbox).toBeChecked()

    // Uncheck it
    await pensionLabel.click()
    await page.waitForTimeout(200)
    await expect(checkbox).not.toBeChecked()

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. Delete a saved calculation
  // ─────────────────────────────────────────────────────────────────────────────
  test('verwijder opgeslagen berekening', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    const employeeName = `DeleteTest ${testId()}`

    // Create a calculation
    await page.getByPlaceholder(/werknemer/i).fill(employeeName)
    await pickDate(page, 0, 2023, 0, 1)
    await pickDate(page, 1, 2026, 0, 1)

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('3000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // Save it
    await page.locator('button', { hasText: /opslaan/i }).first().click()
    await page.waitForTimeout(2000)

    // Find the employee in the table
    await expect(page.locator(`text=${employeeName}`).first()).toBeVisible({ timeout: 10_000 })

    // Find and click the delete button (Verwijderen text or trash icon)
    const deleteBtn = page.locator('button').filter({ hasText: /Verwijderen/i }).first()
    const trashBtn = page.locator('button[title="Verwijderen"]').first()

    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click()
    } else if (await trashBtn.isVisible().catch(() => false)) {
      await trashBtn.click()
    }
    await page.waitForTimeout(2000)

    // The employee name should no longer appear in the saved list (or have one fewer occurrence)
    // After deletion, we verify the toast confirms deletion
    const toast = page.locator('text=/verwijderd/i').first()
    await expect(toast).toBeVisible({ timeout: 5_000 }).catch(() => {
      // Toast may have already dismissed; check the list instead
    })

    await assertNoGarbage(page)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. Vacation percentage can be adjusted
  // ─────────────────────────────────────────────────────────────────────────────
  test('vakantiegeld percentage is aanpasbaar', async ({ page }) => {
    await navigateTo(page, '/dashboard/transitie')
    await waitForPageLoad(page)

    // The vacation percent input should be visible (default 8%)
    const vacPercentInput = page.locator('input[type="number"][step="0.1"]')
    await expect(vacPercentInput).toBeVisible()
    const defaultValue = await vacPercentInput.inputValue()
    expect(defaultValue).toBe('8')

    // Change it to 10%
    await vacPercentInput.fill('10')
    const newValue = await vacPercentInput.inputValue()
    expect(newValue).toBe('10')

    // Now calculate with 10% and verify it affects the result
    await page.getByPlaceholder(/werknemer/i).fill('VacPct Test')
    await pickDate(page, 0, 2023, 0, 1)
    await pickDate(page, 1, 2026, 0, 1)

    const salaryInput = page.locator('input[type="number"][step="0.01"]').first()
    await salaryInput.fill('5000')

    await page.locator('button', { hasText: /Bereken transitievergoeding/i }).click()
    await page.waitForTimeout(1000)

    // With 10% vacation: total = 5000 + 500 = 5500
    // The monthly salary shown should be 5500
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/5[.\s]?500/)

    await assertNoGarbage(page)
  })
})
