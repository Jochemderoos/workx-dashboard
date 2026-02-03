/**
 * Vacation utility functions for calculating vacation days with parttime support
 * and Dutch national holiday exclusion
 */

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * Get all Dutch national holidays for a given year
 * These are days when most businesses are closed
 */
export function getDutchHolidays(year: number): Date[] {
  const holidays: Date[] = []

  // Fixed holidays
  holidays.push(new Date(year, 0, 1))   // Nieuwjaarsdag (1 januari)

  // Koningsdag (27 april, or 26 april if 27th is Sunday)
  const koningsdag = new Date(year, 3, 27)
  if (koningsdag.getDay() === 0) {
    holidays.push(new Date(year, 3, 26))
  } else {
    holidays.push(koningsdag)
  }

  // Bevrijdingsdag (5 mei) - national holiday
  holidays.push(new Date(year, 4, 5))

  // Kerstdagen
  holidays.push(new Date(year, 11, 25)) // Eerste Kerstdag
  holidays.push(new Date(year, 11, 26)) // Tweede Kerstdag

  // Variable holidays based on Easter
  const easter = getEasterSunday(year)

  // Goede Vrijdag (2 days before Easter)
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  holidays.push(goodFriday)

  // Eerste Paasdag (Easter Sunday)
  holidays.push(new Date(easter))

  // Tweede Paasdag (Easter Monday)
  const easterMonday = new Date(easter)
  easterMonday.setDate(easter.getDate() + 1)
  holidays.push(easterMonday)

  // Hemelvaartsdag (39 days after Easter)
  const ascension = new Date(easter)
  ascension.setDate(easter.getDate() + 39)
  holidays.push(ascension)

  // Eerste Pinksterdag (49 days after Easter)
  const pentecost = new Date(easter)
  pentecost.setDate(easter.getDate() + 49)
  holidays.push(pentecost)

  // Tweede Pinksterdag (50 days after Easter)
  const pentecostMonday = new Date(easter)
  pentecostMonday.setDate(easter.getDate() + 50)
  holidays.push(pentecostMonday)

  return holidays
}

/**
 * Get holiday name in Dutch
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  // Fixed holidays
  if (month === 0 && day === 1) return 'Nieuwjaarsdag'
  if (month === 11 && day === 25) return 'Eerste Kerstdag'
  if (month === 11 && day === 26) return 'Tweede Kerstdag'
  if (month === 4 && day === 5) return 'Bevrijdingsdag'

  // Koningsdag
  const koningsdag = new Date(year, 3, 27)
  if (koningsdag.getDay() === 0) {
    if (month === 3 && day === 26) return 'Koningsdag'
  } else {
    if (month === 3 && day === 27) return 'Koningsdag'
  }

  // Easter-based holidays
  const easter = getEasterSunday(year)
  const easterTime = easter.getTime()
  const dateTime = new Date(year, month, day).getTime()
  const daysDiff = Math.round((dateTime - easterTime) / (1000 * 60 * 60 * 24))

  if (daysDiff === -2) return 'Goede Vrijdag'
  if (daysDiff === 0) return 'Eerste Paasdag'
  if (daysDiff === 1) return 'Tweede Paasdag'
  if (daysDiff === 39) return 'Hemelvaartsdag'
  if (daysDiff === 49) return 'Eerste Pinksterdag'
  if (daysDiff === 50) return 'Tweede Pinksterdag'

  return null
}

/**
 * Check if a date is a Dutch national holiday
 */
export function isDutchHoliday(date: Date): boolean {
  return getHolidayName(date) !== null
}

/**
 * Format date as YYYY-MM-DD for comparison
 */
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Calculate the number of vacation days in a period based on werkdagen
 * Excludes weekends (based on werkdagen) and Dutch national holidays
 *
 * @param startDate - Start date of the vacation period
 * @param endDate - End date of the vacation period (inclusive)
 * @param werkdagen - Array of weekdays that count (1=Ma, 2=Di, 3=Wo, 4=Do, 5=Vr, 6=Za, 7=Zo)
 * @param excludeHolidays - Whether to exclude Dutch national holidays (default: true)
 * @returns Number of vacation days
 *
 * Example:
 * - Period: 15-19 juli 2026 (ma-vr)
 * - Medewerker werkt: Ma, Di, Wo (1,2,3)
 * - Berekende dagen: 3
 */
export function calculateVacationDays(
  startDate: Date | string,
  endDate: Date | string,
  werkdagen: number[],
  excludeHolidays: boolean = true
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Reset time components for accurate day counting
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  // Get all holidays in the range
  const holidaySet = new Set<string>()
  if (excludeHolidays) {
    // Get holidays for all years in range
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const holidays = getDutchHolidays(year)
      holidays.forEach(h => holidaySet.add(formatDateKey(h)))
    }
  }

  let days = 0
  const current = new Date(start)

  while (current <= end) {
    // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
    // Our format: 1=Monday, 2=Tuesday, ..., 7=Sunday
    const jsDay = current.getDay()
    const ourDay = jsDay === 0 ? 7 : jsDay // Convert Sunday from 0 to 7

    if (werkdagen.includes(ourDay)) {
      // Check if it's not a holiday
      if (!holidaySet.has(formatDateKey(current))) {
        days++
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return days
}

/**
 * Calculate the number of workdays between two dates
 * Excludes weekends and Dutch national holidays
 */
export function calculateWorkdays(
  startDate: Date | string,
  endDate: Date | string,
  excludeHolidays: boolean = true
): number {
  return calculateVacationDays(startDate, endDate, [1, 2, 3, 4, 5], excludeHolidays)
}

/**
 * Get details about holidays in a date range
 */
export function getHolidaysInRange(
  startDate: Date | string,
  endDate: Date | string
): { date: Date; name: string }[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const holidays: { date: Date; name: string }[] = []
  const current = new Date(start)

  while (current <= end) {
    const name = getHolidayName(current)
    if (name) {
      holidays.push({ date: new Date(current), name })
    }
    current.setDate(current.getDate() + 1)
  }

  return holidays
}

/**
 * Parse werkdagen string to array of numbers
 * @param werkdagenStr - Comma-separated string like "1,2,3,4,5"
 * @returns Array of weekday numbers
 */
export function parseWerkdagen(werkdagenStr: string): number[] {
  if (!werkdagenStr) return [1, 2, 3, 4, 5] // Default to Mon-Fri
  return werkdagenStr.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 1 && d <= 7)
}

/**
 * Convert werkdagen array to string
 * @param werkdagen - Array of weekday numbers
 * @returns Comma-separated string like "1,2,3,4,5"
 */
export function werkdagenToString(werkdagen: number[]): string {
  return werkdagen.sort((a, b) => a - b).join(',')
}

/**
 * Get day names in Dutch
 */
export const DAY_NAMES: Record<number, string> = {
  1: 'Ma',
  2: 'Di',
  3: 'Wo',
  4: 'Do',
  5: 'Vr',
  6: 'Za',
  7: 'Zo',
}

/**
 * Get full day names in Dutch
 */
export const DAY_NAMES_FULL: Record<number, string> = {
  1: 'Maandag',
  2: 'Dinsdag',
  3: 'Woensdag',
  4: 'Donderdag',
  5: 'Vrijdag',
  6: 'Zaterdag',
  7: 'Zondag',
}

/**
 * Format werkdagen array to readable string
 * @param werkdagen - Array of weekday numbers
 * @returns Readable string like "Ma, Di, Wo"
 */
export function formatWerkdagen(werkdagen: number[]): string {
  return werkdagen.sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ')
}

/**
 * Check if werkdagen represents fulltime (Mon-Fri)
 */
export function isFulltime(werkdagen: number[]): boolean {
  const sorted = [...werkdagen].sort((a, b) => a - b)
  return sorted.length === 5 &&
    sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3 &&
    sorted[3] === 4 && sorted[4] === 5
}

/**
 * Default werkdagen for fulltime employees
 */
export const DEFAULT_WERKDAGEN = [1, 2, 3, 4, 5]
export const DEFAULT_WERKDAGEN_STRING = '1,2,3,4,5'

/**
 * Format a date range as readable Dutch string
 */
export function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const startStr = start.toLocaleDateString('nl-NL', options)
  const endStr = end.toLocaleDateString('nl-NL', options)

  if (start.getTime() === end.getTime()) {
    return startStr
  }
  return `${startStr} - ${endStr}`
}
