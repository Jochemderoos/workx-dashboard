/**
 * Centralized configuration for Workx Dashboard
 * All hardcoded values should be defined here
 */

// ============================================
// OFFICE CONFIGURATION
// ============================================

export const OFFICE_CONFIG = {
  /** Total number of workplaces in the office */
  TOTAL_WORKPLACES: 11,

  /** Office location for weather widget */
  DEFAULT_LOCATION: {
    city: 'Amsterdam',
    lat: 52.3676,
    lon: 4.9041,
  },
} as const

// ============================================
// VACATION CONFIGURATION
// ============================================

export const VACATION_CONFIG = {
  /** Default vacation days per year for employees */
  DEFAULT_DAYS_EMPLOYEE: 25,

  /** Default vacation days per year for partners (they manage their own) */
  DEFAULT_DAYS_PARTNER: 0,

  /** Maximum vacation days that can be carried over */
  MAX_CARRYOVER_DAYS: 10,
} as const

// ============================================
// SCHOOL HOLIDAYS (Noord-Holland / Regio Noord)
// ============================================

export interface SchoolHoliday {
  name: string
  startDate: string
  endDate: string
}

export const SCHOOL_HOLIDAYS: SchoolHoliday[] = [
  // 2025
  { name: 'Voorjaarsvakantie 2025', startDate: '2025-02-22', endDate: '2025-03-02' },
  { name: 'Meivakantie 2025', startDate: '2025-04-26', endDate: '2025-05-11' },
  { name: 'Zomervakantie 2025', startDate: '2025-07-19', endDate: '2025-08-31' },
  { name: 'Herfstvakantie 2025', startDate: '2025-10-18', endDate: '2025-10-26' },
  { name: 'Kerstvakantie 2025', startDate: '2025-12-20', endDate: '2026-01-04' },
  // 2026
  { name: 'Voorjaarsvakantie 2026', startDate: '2026-02-21', endDate: '2026-03-01' },
  { name: 'Meivakantie 2026', startDate: '2026-04-25', endDate: '2026-05-10' },
  { name: 'Zomervakantie 2026', startDate: '2026-07-11', endDate: '2026-08-23' },
  { name: 'Herfstvakantie 2026', startDate: '2026-10-17', endDate: '2026-10-25' },
  { name: 'Kerstvakantie 2026', startDate: '2026-12-19', endDate: '2027-01-03' },
  // 2027
  { name: 'Voorjaarsvakantie 2027', startDate: '2027-02-20', endDate: '2027-02-28' },
  { name: 'Meivakantie 2027', startDate: '2027-05-01', endDate: '2027-05-09' },
  { name: 'Zomervakantie 2027', startDate: '2027-07-17', endDate: '2027-08-29' },
  { name: 'Herfstvakantie 2027', startDate: '2027-10-16', endDate: '2027-10-24' },
  { name: 'Kerstvakantie 2027', startDate: '2027-12-18', endDate: '2028-01-02' },
]

// ============================================
// COLOR PALETTE
// ============================================

export const COLORS = {
  /** Brand colors */
  brand: {
    lime: '#f9ff85',
    limeDark: '#e5eb7a',
    dark: '#1e1e1e',
    darkLight: '#2a2a2a',
    gray: '#3c3c3b',
    grayLight: '#cdcdcd',
    grayMedium: '#404041',
  },

  /** User/category colors for calendar, charts, etc. */
  palette: [
    { name: 'Lime', value: '#f9ff85' },
    { name: 'Blauw', value: '#60a5fa' },
    { name: 'Paars', value: '#a78bfa' },
    { name: 'Roze', value: '#f472b6' },
    { name: 'Oranje', value: '#fb923c' },
    { name: 'Groen', value: '#34d399' },
    { name: 'Cyan', value: '#22d3ee' },
    { name: 'Rood', value: '#f87171' },
  ],

  /** Workload indicator colors */
  workload: {
    green: '#22c55e',   // Rustig
    yellow: '#eab308',  // Normaal
    orange: '#f97316',  // Druk
    red: '#ef4444',     // Heel druk
  },

  /** Status colors */
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const

// ============================================
// WORKLOAD THRESHOLDS
// ============================================

export const WORKLOAD_THRESHOLDS = {
  /** Hours per week thresholds */
  GREEN_MAX: 30,    // 0-30 = green (rustig)
  YELLOW_MAX: 40,   // 31-40 = yellow (normaal)
  ORANGE_MAX: 50,   // 41-50 = orange (druk)
  // > 50 = red (heel druk)
} as const

// ============================================
// FINANCIAL CONFIGURATION
// ============================================

export const FINANCE_CONFIG = {
  /** Default hourly rate increase per year (in euros) */
  DEFAULT_HOURLY_RATE_INCREASE: 10,

  /** Default bonus percentage */
  DEFAULT_BONUS_PERCENTAGE: 0.15,
} as const

// ============================================
// CACHING CONFIGURATION
// ============================================

export const CACHE_CONFIG = {
  /** Cache TTL in seconds */
  TEAM_DATA: 3600,        // 1 hour
  BIRTHDAYS: 3600,        // 1 hour
  CALENDAR: 60,           // 1 minute
  DASHBOARD_SUMMARY: 30,  // 30 seconds
  LUSTRUM: 300,           // 5 minutes

  /** Slack user cache TTL in ms */
  SLACK_USERS: 1000 * 60 * 60, // 1 hour
} as const

// ============================================
// DATE/TIME CONFIGURATION
// ============================================

export const DATE_CONFIG = {
  /** First day of the week (0 = Sunday, 1 = Monday) */
  FIRST_DAY_OF_WEEK: 1, // Monday

  /** Date format for display (Dutch) */
  DATE_FORMAT: 'dd-MM-yyyy',

  /** Time format */
  TIME_FORMAT: 'HH:mm',

  /** Locale */
  LOCALE: 'nl-NL',
} as const

// ============================================
// PAGINATION DEFAULTS
// ============================================

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const

// ============================================
// API RATE LIMITING
// ============================================

export const RATE_LIMITS = {
  /** Requests per minute per user */
  DEFAULT: 100,

  /** Requests per minute for heavy endpoints */
  HEAVY: 20,
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a consistent color for a user based on their name
 */
export function getColorForUser(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS.palette[Math.abs(hash) % COLORS.palette.length].value
}

/**
 * Get default vacation days based on role
 */
export function getDefaultVacationDays(role: string): number {
  return role === 'PARTNER' ? VACATION_CONFIG.DEFAULT_DAYS_PARTNER : VACATION_CONFIG.DEFAULT_DAYS_EMPLOYEE
}

/**
 * Get school holidays for a specific year
 */
export function getSchoolHolidaysForYear(year: number): SchoolHoliday[] {
  return SCHOOL_HOLIDAYS.filter(h => {
    const startYear = parseInt(h.startDate.split('-')[0])
    return startYear === year || startYear === year - 1
  })
}

/**
 * Check if a date falls within a school holiday
 */
export function isSchoolHoliday(date: Date): SchoolHoliday | null {
  const dateStr = date.toISOString().split('T')[0]
  return SCHOOL_HOLIDAYS.find(h => dateStr >= h.startDate && dateStr <= h.endDate) || null
}
