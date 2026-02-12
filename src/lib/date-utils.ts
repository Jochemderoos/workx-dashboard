/**
 * Date utilities to prevent timezone issues between frontend and backend
 *
 * THE PROBLEM:
 * When you do `new Date("2026-03-16").toISOString()` in a browser in Netherlands (UTC+1),
 * you get "2026-03-15T23:00:00.000Z" - the previous day in UTC!
 *
 * When the server receives this and does `new Date("2026-03-15T23:00:00.000Z")`,
 * it might interpret it as March 15 instead of March 16.
 *
 * THE SOLUTION:
 * Always send dates as "YYYY-MM-DD" strings (date-only, no time/timezone)
 * Always parse dates by extracting year/month/day components
 */

/**
 * Format a Date object to a date-only string (YYYY-MM-DD)
 * Safe to send to APIs without timezone issues
 */
export function formatDateForAPI(date: Date | null | undefined): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a Date object to a datetime string for APIs
 * Preserves the local time as-is (for calendar events, etc.)
 */
export function formatDateTimeForAPI(date: Date | null | undefined): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  // Include timezone offset so server interprets correctly (e.g. +01:00 for CET, +02:00 for CEST)
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absOffset = Math.abs(offsetMin)
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0')
  const offsetMins = String(absOffset % 60).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`
}

/**
 * Parse a date string from API to a Date object
 * Handles both ISO strings and date-only strings correctly
 *
 * @param dateStr - Date string from API ("2026-03-16" or "2026-03-16T00:00:00.000Z")
 * @returns Date object representing the correct local date
 */
export function parseDateFromAPI(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null

  if (dateStr instanceof Date) {
    // Already a Date, normalize to midnight
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate())
  }

  // If it's an ISO string with time component
  if (dateStr.includes('T')) {
    const date = new Date(dateStr)
    // Use UTC components to avoid timezone shift
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  // Date-only string like "2026-03-16"
  const [year, month, day] = dateStr.split('-').map(Number)
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.warn('Invalid date string:', dateStr)
    return null
  }
  return new Date(year, month - 1, day)
}

/**
 * Parse a datetime string from API to a Date object
 * Preserves the time component
 */
export function parseDateTimeFromAPI(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null

  if (dateStr instanceof Date) {
    return dateStr
  }

  // If it's a full ISO string, parse it
  if (dateStr.includes('T')) {
    // Check if it has timezone info (Z or +/-)
    if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
      // Has timezone - use UTC values to preserve local time intent
      const date = new Date(dateStr)
      return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
      )
    }
    // No timezone - parse as local time
    return new Date(dateStr)
  }

  // Date-only string
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Get today's date as a YYYY-MM-DD string
 */
export function getTodayString(): string {
  return formatDateForAPI(new Date())
}

/**
 * Check if two dates are the same day (ignoring time)
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseDateFromAPI(date1) : date1
  const d2 = typeof date2 === 'string' ? parseDateFromAPI(date2) : date2

  if (!d1 || !d2) return false

  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

/**
 * Check if a date falls within a range (inclusive)
 */
export function isDateInRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const d = typeof date === 'string' ? parseDateFromAPI(date) : date
  const start = typeof startDate === 'string' ? parseDateFromAPI(startDate) : startDate
  const end = typeof endDate === 'string' ? parseDateFromAPI(endDate) : endDate

  if (!d || !start || !end) return false

  const dTime = d.getTime()
  return dTime >= start.getTime() && dTime <= end.getTime()
}

/**
 * Format a date for display in Dutch locale
 */
export function formatDateDisplay(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseDateFromAPI(date) : date
  if (!d) return ''
  return d.toLocaleDateString('nl-NL', options)
}

/**
 * Format a date range for display
 */
export function formatDateRangeDisplay(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  const start = typeof startDate === 'string' ? parseDateFromAPI(startDate) : startDate
  const end = typeof endDate === 'string' ? parseDateFromAPI(endDate) : endDate

  if (!start) return ''
  if (!end || isSameDay(start, end)) {
    return formatDateDisplay(start, { day: 'numeric', month: 'short' })
  }

  const startStr = formatDateDisplay(start, { day: 'numeric', month: 'short' })
  const endStr = formatDateDisplay(end, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startStr} - ${endStr}`
}
