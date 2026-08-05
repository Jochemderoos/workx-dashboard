// Terugkerende vaste verlofdagen (bijv. "elke maandag onbetaald ouderschaps-
// verlof vanaf 6 juli"). We slaan de regel op, niet de losse dagen; hier leiden
// we occurrences af voor (a) de teller en (b) subtiele kalender-markering.

import { getDutchHolidays } from './vacation-utils'

export interface RecurringRule {
  type: string
  weekday: number // 1=ma, 2=di, 3=wo, 4=do, 5=vr (JS getDay)
  dayValue: number
  childNumber?: number | null
  startDate: string | Date
  endDate?: string | Date | null
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const holidayCache: Record<number, Set<string>> = {}
function holidaySet(year: number): Set<string> {
  if (!holidayCache[year]) holidayCache[year] = new Set(getDutchHolidays(year).map(ymd))
  return holidayCache[year]
}

// Is deze datum een occurrence van de regel? (weekdag + binnen periode + geen feestdag)
export function recurringOnDate(rule: RecurringRule, date: Date): boolean {
  if (date.getDay() !== rule.weekday) return false
  const start = new Date(rule.startDate); start.setHours(0, 0, 0, 0)
  if (date < start) return false
  if (rule.endDate) { const e = new Date(rule.endDate); e.setHours(23, 59, 59, 999); if (date > e) return false }
  return !holidaySet(date.getFullYear()).has(ymd(date))
}

// Aantal occurrence-datums in [from, to] (excl. feestdagen).
function countOccurrences(rule: RecurringRule, from: Date, to: Date): number {
  const start = new Date(rule.startDate)
  const lo = new Date(Math.max(from.getTime(), start.getTime()))
  const hi = rule.endDate ? new Date(Math.min(to.getTime(), new Date(rule.endDate).getTime())) : new Date(to)
  if (hi < lo) return 0
  const d = new Date(lo); d.setHours(12, 0, 0, 0)
  while (d.getDay() !== rule.weekday && d <= hi) d.setDate(d.getDate() + 1)
  let n = 0
  while (d <= hi) {
    if (!holidaySet(d.getFullYear()).has(ymd(d))) n++
    d.setDate(d.getDate() + 7)
  }
  return n
}

// Opgenomen dagen dit jaar t/m 'today' (verstreken occurrences × dayValue).
export function recurringTakenThisYear(rule: RecurringRule, year: number, today: Date): number {
  const from = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const to = today.getTime() < end.getTime() ? today : end
  return Math.round(countOccurrences(rule, from, to) * (rule.dayValue || 1) * 10) / 10
}

// Sleutel voor de verlof-teller: ouderschapsverlof per kind, rest per type.
export function verlofKey(type: string, childNumber?: number | null): string {
  if (type === 'ouderschap_betaald' || type === 'ouderschap_onbetaald') {
    return `${type}#${childNumber === 2 ? 2 : 1}`
  }
  return type
}
