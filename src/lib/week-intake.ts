// Helpers voor de medewerker week-intake.
// Window: donderdag 15:00 vóór de target maandag → maandag 10:00 van de target week.
//
// Target-week-bepaling:
//   - Nu < donderdag 15:00 van deze week  → target = maandag deze week
//   - Nu ≥ donderdag 15:00 van deze week  → target = maandag volgende week
//
// Editen is toegestaan vanaf donderdag 15:00 (= openingsmoment voor de target).
// Sluit op maandag 10:00 van de target week.

export function getMondayOf(d: Date): Date {
  const day = d.getDay() // 0=zo, 1=ma, ..., 6=za
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

export function getTargetWeekStart(now: Date = new Date()): Date {
  const monday = getMondayOf(now)
  const thursday1500 = new Date(monday)
  thursday1500.setDate(monday.getDate() + 3)
  thursday1500.setHours(15, 0, 0, 0)

  if (now >= thursday1500) {
    const next = new Date(monday)
    next.setDate(monday.getDate() + 7)
    return next
  }
  return monday
}

export function getWindowOpenAt(targetWeekStart: Date): Date {
  // Donderdag 15:00 van de week VOOR target (= 4 dagen vóór maandag).
  const open = new Date(targetWeekStart)
  open.setDate(targetWeekStart.getDate() - 4) // donderdag = ma - 4 dagen
  open.setHours(15, 0, 0, 0)
  return open
}

export function getWindowCloseAt(targetWeekStart: Date): Date {
  // Maandag 10:00 van de target week.
  const close = new Date(targetWeekStart)
  close.setHours(10, 0, 0, 0)
  return close
}

export function isWindowOpen(now: Date, targetWeekStart: Date): boolean {
  const open = getWindowOpenAt(targetWeekStart)
  const close = getWindowCloseAt(targetWeekStart)
  return now >= open && now < close
}

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export function isoDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
