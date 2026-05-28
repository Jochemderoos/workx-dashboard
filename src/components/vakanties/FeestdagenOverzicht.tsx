'use client'

import { useMemo, useState } from 'react'

// Berekenen van Pasen via Gauss-formule, geeft Eerste Paasdag terug
function easterSunday(year: number): Date {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=mrt, 4=apr
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

interface Feestdag {
  name: string
  emoji: string
  date: Date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function buildFeestdagen(year: number): Feestdag[] {
  const easter = easterSunday(year)
  // Bevrijdingsdag: eens per 5 jaar (2025, 2030, 2035…)
  const isBevrijdingsdagJaar = year % 5 === 0
  return [
    { name: 'Nieuwjaarsdag', emoji: '🎉', date: new Date(Date.UTC(year, 0, 1)) },
    { name: 'Goede Vrijdag', emoji: '✝️', date: addDays(easter, -2) },
    { name: 'Eerste Paasdag', emoji: '🐣', date: easter },
    { name: 'Tweede Paasdag', emoji: '🐰', date: addDays(easter, 1) },
    { name: 'Koningsdag', emoji: '👑', date: new Date(Date.UTC(year, 3, 27)) },
    ...(isBevrijdingsdagJaar
      ? [{ name: 'Bevrijdingsdag', emoji: '🕊️', date: new Date(Date.UTC(year, 4, 5)) }]
      : []),
    { name: 'Hemelvaartsdag', emoji: '☁️', date: addDays(easter, 39) },
    { name: 'Eerste Pinksterdag', emoji: '🔥', date: addDays(easter, 49) },
    { name: 'Tweede Pinksterdag', emoji: '🌬️', date: addDays(easter, 50) },
    { name: 'Eerste Kerstdag', emoji: '🎄', date: new Date(Date.UTC(year, 11, 25)) },
    { name: 'Tweede Kerstdag', emoji: '🎁', date: new Date(Date.UTC(year, 11, 26)) },
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
}

const DAY_NAMES = ['zon', 'maan', 'din', 'woe', 'don', 'vrij', 'zat']
const DAY_FULL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

export default function FeestdagenOverzicht() {
  const today = useMemo(() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    return d
  }, [])
  const currentYear = today.getUTCFullYear()
  const [year, setYear] = useState(currentYear)

  const days = useMemo(() => buildFeestdagen(year), [year])

  const enriched = useMemo(() => days.map(d => {
    const diff = Math.floor((d.date.getTime() - today.getTime()) / 86400000)
    return { ...d, diff }
  }), [days, today])

  const nextOne = enriched.find(d => d.diff >= 0) || null

  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />

      <div className="relative p-6 sm:p-8">
        {/* Header met jaar-switch */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{
              background: 'rgba(249, 255, 133, 0.35)',
              border: '1px solid rgba(180, 185, 50, 0.4)',
            }}>
              🎉
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'rgb(140, 150, 30)' }}>
                Feestdagen · Kantoor gesloten
              </p>
              <h2 className="text-2xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                Workx-feestdagen {year}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border-subtle)' }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: year === y ? 'rgb(249, 255, 133)' : 'transparent',
                  color: year === y ? 'rgb(45, 45, 45)' : 'var(--color-text-secondary)',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Eerstvolgende */}
        {nextOne && year === currentYear && (
          <div className="mt-5 rounded-2xl p-4 border-2 flex items-center gap-4" style={{
            background: 'rgba(249, 255, 133, 0.12)',
            borderColor: 'rgba(180, 185, 50, 0.5)',
          }}>
            <div className="text-3xl shrink-0">{nextOne.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'rgb(140, 150, 30)' }}>
                Eerstvolgend
              </p>
              <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {nextOne.name}
                <span className="ml-2 font-normal text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  · {DAY_FULL[nextOne.date.getUTCDay()]} {nextOne.date.getUTCDate()} {nextOne.date.toLocaleDateString('nl-NL', { month: 'long', timeZone: 'UTC' })}
                </span>
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {nextOne.diff === 0
                  ? 'Vandaag — kantoor gesloten'
                  : nextOne.diff === 1
                    ? 'Morgen — kantoor gesloten'
                    : `Over ${nextOne.diff} dagen`}
              </p>
            </div>
          </div>
        )}

        {/* Compact maand-grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {enriched.map((d, i) => {
            const isPast = d.diff < 0 && year === currentYear
            const isToday = d.diff === 0 && year === currentYear
            const isWeekend = d.date.getUTCDay() === 0 || d.date.getUTCDay() === 6
            return (
              <div
                key={i}
                className="rounded-xl p-3 border flex items-center gap-3 transition-all"
                style={{
                  background: isToday ? 'rgba(34, 197, 94, 0.12)' : 'var(--color-bg-card)',
                  borderColor: isToday ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border-subtle)',
                  opacity: isPast ? 0.45 : 1,
                }}
              >
                <div className="w-12 text-center shrink-0">
                  <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    {d.date.toLocaleDateString('nl-NL', { month: 'short', timeZone: 'UTC' })}
                  </p>
                  <p className="text-2xl font-bold tabular-nums leading-none mt-0.5" style={{
                    color: isToday ? 'rgb(22, 163, 74)' : 'var(--color-text-primary)',
                  }}>
                    {d.date.getUTCDate()}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{
                    color: isWeekend ? 'var(--color-text-tertiary)' : 'rgb(140, 150, 30)',
                  }}>
                    {DAY_NAMES[d.date.getUTCDay()]}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{d.emoji}</span>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {d.name}
                    </p>
                  </div>
                  {isToday && (
                    <p className="text-[10px] font-bold mt-0.5" style={{ color: 'rgb(22, 163, 74)' }}>
                      Vandaag
                    </p>
                  )}
                  {isWeekend && !isToday && (
                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      Weekend
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Info-noot over Bevrijdingsdag */}
        <p className="mt-5 text-[11px] italic" style={{ color: 'var(--color-text-tertiary)' }}>
          💡 Bevrijdingsdag is eens in de 5 jaar een vrije dag (laatste: 2025, volgende: 2030). Als je parttime werkt en er een onevenredig aantal feestdagen op jouw vaste parttime-dag valt, compenseert Workx je voor het verschil.
        </p>
      </div>
    </section>
  )
}
