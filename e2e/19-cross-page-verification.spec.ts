import { test, expect } from '@playwright/test'
import { navigateTo, waitForPageLoad, assertNoGarbage } from './helpers'

test.describe('Cross-page data verificatie', () => {

  test('dashboard summary API bevat alle verwachte velden', async ({ page }) => {
    // Direct API call om data integriteit te checken
    const response = await page.request.get('/api/dashboard/summary')
    expect(response.status()).toBe(200)

    const data = await response.json()

    // Verifieer structuur
    expect(data).toBeDefined()

    // Check dat response geen null/undefined waarden heeft waar dat niet hoort
    const jsonStr = JSON.stringify(data)
    expect(jsonStr).not.toContain('"NaN"')
    expect(jsonStr).not.toContain(':NaN')
  })

  test('team API retourneert volledige medewerker data', async ({ page }) => {
    const response = await page.request.get('/api/team')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data.length).toBeGreaterThan(0)

    // Elke medewerker moet basale velden hebben
    for (const member of data) {
      expect(member.name).toBeTruthy()
      expect(member.email).toBeTruthy()
      expect(member.email).toContain('@workxadvocaten.nl')
      expect(member.role).toBeTruthy()
    }
  })

  test('feedback API retourneert items met correcte structuur', async ({ page }) => {
    const response = await page.request.get('/api/feedback')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()

    for (const item of data) {
      expect(item.title).toBeTruthy()
      expect(item.type).toMatch(/^(IDEA|BUG)$/)
      expect(item.createdAt).toBeTruthy()
    }
  })

  test('bonus API retourneert berekeningen met valide bedragen', async ({ page }) => {
    const response = await page.request.get('/api/bonus')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()

    for (const calc of data) {
      expect(typeof calc.invoiceAmount).toBe('number')
      expect(calc.invoiceAmount).toBeGreaterThanOrEqual(0)
      expect(typeof calc.bonusPercentage).toBe('number')
      expect(calc.bonusPercentage).toBeGreaterThanOrEqual(0)
      expect(calc.bonusPercentage).toBeLessThanOrEqual(100)
      // Bereken verwacht bonusbedrag
      const expectedBonus = calc.invoiceAmount * (calc.bonusPercentage / 100)
      expect(calc.bonusAmount).toBeCloseTo(expectedBonus, 1)
    }
  })

  test('vacation summary API bevat balans per medewerker', async ({ page }) => {
    const response = await page.request.get('/api/vacation/summary')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toBeDefined()

    // Check dat balances numeriek zijn
    const jsonStr = JSON.stringify(data)
    expect(jsonStr).not.toContain(':NaN')
    expect(jsonStr).not.toContain('undefined')
  })

  test('calendar API retourneert events met valide datums', async ({ page }) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const response = await page.request.get(`/api/calendar?year=${year}&month=${month}`)

    if (response.status() === 200) {
      const data = await response.json()
      expect(Array.isArray(data)).toBeTruthy()

      for (const event of data) {
        expect(event.title).toBeTruthy()
        // Start date moet een valide datum zijn
        if (event.startDate) {
          expect(new Date(event.startDate).toString()).not.toBe('Invalid Date')
        }
      }
    }
  })

  test('office attendance API werkt correct', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]
    const response = await page.request.get(`/api/office-attendance?date=${today}`)
    expect(response.status()).toBe(200)

    const data = await response.json()
    // API kan array of object met attendances retourneren
    expect(data).toBeDefined()
    expect(typeof data).toBe('object')

    // Als het een object is met een attendances array
    const entries = Array.isArray(data) ? data : (data.attendances || data.data || [])
    for (const entry of entries) {
      expect(entry.userId || entry.id).toBeTruthy()
    }
  })

  test('training sessions API retourneert sessies', async ({ page }) => {
    const year = new Date().getFullYear()
    const response = await page.request.get(`/api/training/sessions?year=${year}`)
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()

    for (const session of data) {
      expect(session.title).toBeTruthy()
    }
  })
})
