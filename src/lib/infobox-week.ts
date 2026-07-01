// Helpers voor de wekelijkse infobox-toewijzing.
// De "week" loopt van maandag t/m zondag, bepaald in Europe/Amsterdam.

function amsYMD(now: Date): [number, number, number] {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now) // YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number)
  return [y, m, d]
}

// Maandag van de huidige week als YYYY-MM-DD.
export function weekStartISO(now: Date = new Date()): string {
  const [y, m, d] = amsYMD(now)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=zo .. 6=za
  const diff = (dow + 6) % 7 // dagen sinds maandag
  dt.setUTCDate(dt.getUTCDate() - diff)
  return dt.toISOString().slice(0, 10)
}

// Is het vandaag een werkdag (ma–vr) in Amsterdam?
export function isWeekday(now: Date = new Date()): boolean {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).format(now)
  return !['Sat', 'Sun'].includes(wd)
}
