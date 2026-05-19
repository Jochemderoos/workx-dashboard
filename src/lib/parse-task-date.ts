// Herken Nederlandse datumtermen in een taaktitel en strip ze.
// Voorbeelden:
//   "vandaag jochem mailen" → { title: "jochem mailen", dueDate: today }
//   "morgen rapport afmaken" → { title: "rapport afmaken", dueDate: tomorrow }
//   "vrijdag bestelling" → eerstvolgende vrijdag
//   "23 mei verjaardag" → 23 mei (volgend jaar als al verstreken)
//   "12/06 bellen" → 12 juni
// Als de schoongemaakte titel leeg zou zijn, wordt de oorspronkelijke
// tekst zónder datum teruggegeven.

const WEEKDAYS_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MONTHS_NL: Record<string, number> = {
  jan: 0, januari: 0,
  feb: 1, februari: 1,
  mrt: 2, maart: 2,
  apr: 3, april: 3,
  mei: 4,
  jun: 5, juni: 5,
  jul: 6, juli: 6,
  aug: 7, augustus: 7,
  sep: 8, september: 8,
  okt: 9, oktober: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ParsedTask {
  title: string
  dueDate: Date | null
}

export function parseTaskDate(input: string, now: Date = new Date()): ParsedTask {
  const original = input.trim()
  if (!original) return { title: original, dueDate: null }

  const today = startOfDay(now)

  // Probeer in volgorde van specifiteit
  const tryStrip = (text: string, re: RegExp, getDate: () => Date): ParsedTask | null => {
    if (!re.test(text)) return null
    const stripped = text.replace(re, ' ').replace(/\s+/g, ' ').trim()
    if (!stripped) return null
    return { title: stripped, dueDate: getDate() }
  }

  const lower = original.toLowerCase()

  // "vandaag"
  let r = tryStrip(original, /\bvandaag\b/i, () => today)
  if (r) return r

  // "morgen"
  r = tryStrip(original, /\bmorgen\b/i, () => {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d
  })
  if (r) return r

  // "overmorgen"
  r = tryStrip(original, /\bovermorgen\b/i, () => {
    const d = new Date(today); d.setDate(d.getDate() + 2); return d
  })
  if (r) return r

  // "volgende week" → +7 dagen (zelfde weekdag, één week later)
  r = tryStrip(original, /\bvolgende week\b/i, () => {
    const d = new Date(today); d.setDate(d.getDate() + 7); return d
  })
  if (r) return r

  // Weekdagen → eerstvolgende voorkomen (vandaag uitgesloten)
  for (let i = 0; i < WEEKDAYS_NL.length; i++) {
    const dayName = WEEKDAYS_NL[i]
    const re = new RegExp(`\\b${dayName}\\b`, 'i')
    if (!re.test(lower)) continue
    r = tryStrip(original, re, () => {
      const todayIdx = today.getDay()
      let diff = i - todayIdx
      if (diff <= 0) diff += 7
      const d = new Date(today); d.setDate(d.getDate() + diff); return d
    })
    if (r) return r
  }

  // "23 mei" (optioneel jaar)
  const monthsAlt = Object.keys(MONTHS_NL).map(escapeRegex).join('|')
  const dateRe = new RegExp(`\\b(\\d{1,2})\\s+(${monthsAlt})\\b(?:\\s+(\\d{4}))?`, 'i')
  const dm = original.match(dateRe)
  if (dm) {
    const day = parseInt(dm[1], 10)
    const month = MONTHS_NL[dm[2].toLowerCase()]
    let year = dm[3] ? parseInt(dm[3], 10) : today.getFullYear()
    const cand = new Date(year, month, day, 0, 0, 0, 0)
    if (!dm[3] && cand.getTime() < today.getTime()) {
      cand.setFullYear(year + 1)
    }
    r = tryStrip(original, new RegExp(escapeRegex(dm[0]), 'i'), () => cand)
    if (r) return r
  }

  // "DD-MM" of "DD/MM" (optioneel jaar)
  const numMatch = original.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/)
  if (numMatch) {
    const day = parseInt(numMatch[1], 10)
    const month = parseInt(numMatch[2], 10) - 1
    let year = numMatch[3] ? parseInt(numMatch[3], 10) : today.getFullYear()
    if (year < 100) year += 2000
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const cand = new Date(year, month, day, 0, 0, 0, 0)
      if (!numMatch[3] && cand.getTime() < today.getTime()) {
        cand.setFullYear(year + 1)
      }
      r = tryStrip(original, new RegExp(escapeRegex(numMatch[0])), () => cand)
      if (r) return r
    }
  }

  return { title: original, dueDate: null }
}
