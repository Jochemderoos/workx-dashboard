'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'

// ── Types ─────────────────────────────────────────────────────────────────

interface Goal {
  id: string
  title: string
  description: string
  color: string
  sortOrder: number
}

interface MonthData {
  focus?: string
  plans?: string
  milestones?: string
}

interface YearAgenda {
  id: string
  year: number
  goals: string
  months: string
  theme: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const MONTHS = [
  { num: 1, name: 'januari', season: 'winter' },
  { num: 2, name: 'februari', season: 'winter' },
  { num: 3, name: 'maart', season: 'lente' },
  { num: 4, name: 'april', season: 'lente' },
  { num: 5, name: 'mei', season: 'lente' },
  { num: 6, name: 'juni', season: 'zomer' },
  { num: 7, name: 'juli', season: 'zomer' },
  { num: 8, name: 'augustus', season: 'zomer' },
  { num: 9, name: 'september', season: 'herfst' },
  { num: 10, name: 'oktober', season: 'herfst' },
  { num: 11, name: 'november', season: 'herfst' },
  { num: 12, name: 'december', season: 'winter' },
] as const

const SEASON_STYLES: Record<string, { border: string; gradient: string; accent: string; bg: string }> = {
  winter:  { border: 'border-sky-500/30',    gradient: 'from-sky-500/10',     accent: 'text-sky-300',     bg: 'bg-sky-500/10' },
  lente:   { border: 'border-emerald-500/30', gradient: 'from-emerald-500/10', accent: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  zomer:   { border: 'border-amber-500/30',   gradient: 'from-amber-500/10',   accent: 'text-amber-300',   bg: 'bg-amber-500/10' },
  herfst:  { border: 'border-orange-500/30',  gradient: 'from-orange-500/10',  accent: 'text-orange-300',  bg: 'bg-orange-500/10' },
}

const QUARTERS = [
  { num: 1, name: 'Q1 — Winter/lente', months: [1, 2, 3], season: 'winter', emoji: '❄️' },
  { num: 2, name: 'Q2 — Lente/zomer', months: [4, 5, 6], season: 'lente', emoji: '🌷' },
  { num: 3, name: 'Q3 — Zomer/herfst', months: [7, 8, 9], season: 'zomer', emoji: '☀️' },
  { num: 4, name: 'Q4 — Herfst/winter', months: [10, 11, 12], season: 'herfst', emoji: '🍂' },
] as const

const GOAL_COLORS = ['purple', 'emerald', 'amber', 'sky', 'rose', 'cyan']

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Auto-textarea ─────────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  minRows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={minRows}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  )
}

// ── Hoofdpagina ───────────────────────────────────────────────────────────

const NEXT_YEAR_DEFAULT = new Date().getFullYear() + 1

export default function JaaragendaPage() {
  const { data: session } = useSession()
  const canEdit = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN' || session?.user?.role === 'OFFICE_MANAGER'

  const [agenda, setAgenda] = useState<YearAgenda | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(NEXT_YEAR_DEFAULT)
  const [viewMode, setViewMode] = useState<'maand' | 'kwartaal' | 'tijdlijn'>('maand')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)

  // Parsed state
  const goals: Goal[] = useMemo(() => {
    if (!agenda) return []
    try {
      const parsed = JSON.parse(agenda.goals)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }, [agenda])

  const months: Record<number, MonthData> = useMemo(() => {
    if (!agenda) return {}
    try {
      const parsed = JSON.parse(agenda.months)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch { return {} }
  }, [agenda])

  // ── Fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/year-agenda?year=${selectedYear}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgenda(data) })
      .catch(() => toast.error('Kon agenda niet laden'))
      .finally(() => setIsLoading(false))
  }, [selectedYear])

  // ── Debounced save ──────────────────────────────────────────────────────
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const persist = useCallback((patch: Partial<{ goals: Goal[]; months: Record<number, MonthData>; theme: string | null }>) => {
    if (!agenda || !canEdit) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const body: Record<string, unknown> = { year: selectedYear }
        if (patch.goals !== undefined) body.goals = JSON.stringify(patch.goals)
        if (patch.months !== undefined) body.months = JSON.stringify(patch.months)
        if (patch.theme !== undefined) body.theme = patch.theme
        const res = await fetch('/api/year-agenda', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error()
        const updated: YearAgenda = await res.json()
        setAgenda(updated)
      } catch {
        toast.error('Opslaan mislukt')
      }
    }, 700)
  }, [agenda, canEdit, selectedYear])

  // ── Goal mutations ──────────────────────────────────────────────────────
  const updateGoals = (next: Goal[]) => {
    if (!agenda) return
    setAgenda({ ...agenda, goals: JSON.stringify(next) })
    persist({ goals: next })
  }
  const addGoal = () => {
    const usedColors = goals.map(g => g.color)
    const color = GOAL_COLORS.find(c => !usedColors.includes(c)) || GOAL_COLORS[goals.length % GOAL_COLORS.length]
    updateGoals([
      ...goals,
      { id: makeId(), title: '', description: '', color, sortOrder: goals.length },
    ])
  }
  const updateGoal = (id: string, patch: Partial<Goal>) => {
    updateGoals(goals.map(g => g.id === id ? { ...g, ...patch } : g))
  }
  const removeGoal = (id: string) => {
    if (!confirm('Dit doel verwijderen?')) return
    updateGoals(goals.filter(g => g.id !== id))
  }

  // ── Month mutations ─────────────────────────────────────────────────────
  const updateMonth = (monthNum: number, patch: Partial<MonthData>) => {
    if (!agenda) return
    const current = months[monthNum] || {}
    const nextMonth = { ...current, ...patch }
    // Verwijder lege velden zodat we geen ruis bewaren
    if (!nextMonth.focus?.trim() && !nextMonth.plans?.trim() && !nextMonth.milestones?.trim()) {
      const { [monthNum]: _, ...rest } = months
      const map = rest
      setAgenda({ ...agenda, months: JSON.stringify(map) })
      persist({ months: map })
    } else {
      const map = { ...months, [monthNum]: nextMonth }
      setAgenda({ ...agenda, months: JSON.stringify(map) })
      persist({ months: map })
    }
  }

  const updateTheme = (v: string) => {
    if (!agenda) return
    setAgenda({ ...agenda, theme: v })
    persist({ theme: v.trim() || null })
  }

  // ── Voortgang ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const filledMonths = MONTHS.filter(m => {
      const d = months[m.num]
      return d && (d.focus?.trim() || d.plans?.trim() || d.milestones?.trim())
    }).length
    const filledGoals = goals.filter(g => g.title.trim() || g.description.trim()).length
    return { filledMonths, totalMonths: 12, filledGoals }
  }, [months, goals])

  const ringPct = (stats.filledMonths / 12) * 100

  // ── Render ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6 fade-in">
        <div className="card p-10 text-center text-white/50">Jaaragenda laden…</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6 fade-in relative">
      {/* Background glow */}
      <div className="absolute top-0 right-[10%] w-72 h-72 bg-purple-500/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[20%] left-[5%] w-64 h-64 bg-amber-500/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-500/12 via-indigo-500/6 to-amber-500/8 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Voortgangs-ring */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
                <circle
                  cx="40" cy="40" r="32"
                  stroke="url(#agenda-grad)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - ringPct / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="agenda-grad" x1="0" y1="0" x2="80" y2="80">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm sm:text-base font-bold text-white tabular-nums">{stats.filledMonths}<span className="text-white/40 text-xs">/12</span></span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-purple-300/70">Jaaragenda</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                <TextReveal>{`Workx ${selectedYear}`}</TextReveal>
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                {stats.filledMonths === 0 ? 'Nog niets ingevuld — begin met de jaardoelen ↓' :
                 stats.filledMonths === 12 ? 'Alle 12 maanden ingevuld 🎉' :
                 `${stats.filledMonths} van 12 maanden ingevuld · ${stats.filledGoals} doelen`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Jaar-selector */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {[NEXT_YEAR_DEFAULT - 1, NEXT_YEAR_DEFAULT, NEXT_YEAR_DEFAULT + 1].map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all tabular-nums ${
                    selectedYear === y
                      ? 'bg-purple-500/20 text-purple-100 font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* View-mode toggle */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
              {(['maand', 'kwartaal', 'tijdlijn'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors capitalize ${
                    viewMode === m ? 'bg-purple-500/20 text-purple-100' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Thema */}
        <div className="mt-5 pt-5 border-t border-white/5">
          {canEdit ? (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-purple-300/70 mb-1">Jaar-thema / motto</label>
              <input
                value={agenda?.theme || ''}
                onChange={e => updateTheme(e.target.value)}
                placeholder={`Bijv. "${selectedYear}: jaar van de groei"`}
                className="w-full bg-transparent text-lg sm:text-xl text-white font-semibold focus:outline-none placeholder:text-white/20"
              />
            </div>
          ) : agenda?.theme ? (
            <p className="text-lg sm:text-xl text-white font-semibold italic">"{agenda.theme}"</p>
          ) : null}
        </div>
      </section>

      {/* JAARDOELEN */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Icons.target className="text-purple-300" size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Jaardoelen</h2>
              <p className="text-xs text-white/50">3-5 strategische pijlers voor het jaar</p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={addGoal}
              disabled={goals.length >= 8}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 hover:bg-purple-500/25 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <Icons.plus size={12} /> Doel
            </button>
          )}
        </div>

        {goals.length === 0 ? (
          <p className="text-sm text-white/40 italic py-4 text-center">
            Nog geen doelen ingevuld. {canEdit && 'Klik op "+ Doel" om er een toe te voegen.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {goals.map(goal => {
              const colorClass = {
                purple:  { border: 'border-purple-500/30',  bg: 'from-purple-500/10',  accent: 'text-purple-300' },
                emerald: { border: 'border-emerald-500/30', bg: 'from-emerald-500/10', accent: 'text-emerald-300' },
                amber:   { border: 'border-amber-500/30',   bg: 'from-amber-500/10',   accent: 'text-amber-300' },
                sky:     { border: 'border-sky-500/30',     bg: 'from-sky-500/10',     accent: 'text-sky-300' },
                rose:    { border: 'border-rose-500/30',    bg: 'from-rose-500/10',    accent: 'text-rose-300' },
                cyan:    { border: 'border-cyan-500/30',    bg: 'from-cyan-500/10',    accent: 'text-cyan-300' },
              }[goal.color] || { border: 'border-white/20', bg: 'from-white/5', accent: 'text-white/80' }
              return (
                <div key={goal.id} className={`relative group rounded-xl border bg-gradient-to-br to-transparent p-3 ${colorClass.border} ${colorClass.bg}`}>
                  {canEdit ? (
                    <>
                      <input
                        value={goal.title}
                        onChange={e => updateGoal(goal.id, { title: e.target.value })}
                        placeholder="Doel-titel…"
                        className={`w-full bg-transparent text-sm font-semibold focus:outline-none ${colorClass.accent} placeholder:text-white/30`}
                      />
                      <AutoTextarea
                        value={goal.description}
                        onChange={v => updateGoal(goal.id, { description: v })}
                        placeholder="Korte omschrijving…"
                        className="w-full bg-transparent text-xs text-white/70 mt-1 focus:outline-none placeholder:text-white/30"
                        minRows={2}
                      />
                      <button
                        onClick={() => removeGoal(goal.id)}
                        className="absolute top-2 right-2 p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Doel verwijderen"
                      >
                        <Icons.trash size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={`text-sm font-semibold ${colorClass.accent}`}>{goal.title || '(geen titel)'}</p>
                      {goal.description && <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">{goal.description}</p>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* VIEWS */}
      {viewMode === 'maand' && (
        <MonthGrid
          months={months}
          canEdit={canEdit}
          expandedMonth={expandedMonth}
          onExpand={setExpandedMonth}
          onUpdate={updateMonth}
        />
      )}

      {viewMode === 'kwartaal' && (
        <QuarterView months={months} canEdit={canEdit} onUpdate={updateMonth} />
      )}

      {viewMode === 'tijdlijn' && (
        <TimelineView months={months} />
      )}
    </div>
  )
}

// ── Maand-grid (12 cards) ─────────────────────────────────────────────────

function MonthGrid({
  months,
  canEdit,
  expandedMonth,
  onExpand,
  onUpdate,
}: {
  months: Record<number, MonthData>
  canEdit: boolean
  expandedMonth: number | null
  onExpand: (m: number | null) => void
  onUpdate: (month: number, patch: Partial<MonthData>) => void
}) {
  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {MONTHS.map(m => {
          const data = months[m.num] || {}
          const isFilled = !!(data.focus?.trim() || data.plans?.trim() || data.milestones?.trim())
          const isExpanded = expandedMonth === m.num
          const colors = SEASON_STYLES[m.season]
          return (
            <div
              key={m.num}
              className={`relative rounded-2xl border bg-gradient-to-br to-transparent transition-all ${colors.border} ${colors.gradient} ${isExpanded ? 'sm:col-span-2 md:col-span-3 lg:col-span-4 row-span-2' : ''}`}
            >
              <button
                onClick={() => onExpand(isExpanded ? null : m.num)}
                className="w-full p-3 text-left"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs uppercase tracking-wider font-semibold ${colors.accent}`}>
                      {m.name}
                    </span>
                    <span className="text-[9px] text-white/30 uppercase">{m.season}</span>
                  </div>
                  {isFilled && (
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.bg.replace('/10', '/50')}`} title="Ingevuld" />
                  )}
                </div>
                {data.focus ? (
                  <p className="text-sm text-white font-medium line-clamp-2">{data.focus}</p>
                ) : (
                  <p className="text-xs text-white/30 italic">Nog niet ingevuld</p>
                )}
                {!isExpanded && (data.plans || data.milestones) && (
                  <p className="text-[10px] text-white/50 mt-1 line-clamp-1">
                    {data.plans && `Plannen: ${data.plans}`}
                    {data.plans && data.milestones && ' · '}
                    {data.milestones && `Mijlpalen: ${data.milestones}`}
                  </p>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-3">
                  {canEdit ? (
                    <>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Focus</label>
                        <input
                          value={data.focus || ''}
                          onChange={e => onUpdate(m.num, { focus: e.target.value })}
                          placeholder="Wat is het hoofdthema deze maand?"
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Plannen</label>
                        <AutoTextarea
                          value={data.plans || ''}
                          onChange={v => onUpdate(m.num, { plans: v })}
                          placeholder="Activiteiten, projecten, deadlines…"
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
                          minRows={3}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Mijlpalen / events</label>
                        <AutoTextarea
                          value={data.milestones || ''}
                          onChange={v => onUpdate(m.num, { milestones: v })}
                          placeholder="Belangrijke momenten, deadlines, lustrum, opleidingen…"
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
                          minRows={2}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {data.focus && <p className="text-white"><span className={`text-[10px] uppercase tracking-wider ${colors.accent}`}>Focus: </span>{data.focus}</p>}
                      {data.plans && <p className="text-white/70 whitespace-pre-wrap"><span className="text-[10px] uppercase tracking-wider text-white/40">Plannen: </span>{data.plans}</p>}
                      {data.milestones && <p className="text-white/70 whitespace-pre-wrap"><span className="text-[10px] uppercase tracking-wider text-white/40">Mijlpalen: </span>{data.milestones}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Kwartaal-view ─────────────────────────────────────────────────────────

function QuarterView({
  months,
  canEdit,
  onUpdate,
}: {
  months: Record<number, MonthData>
  canEdit: boolean
  onUpdate: (month: number, patch: Partial<MonthData>) => void
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {QUARTERS.map(q => {
        const colors = SEASON_STYLES[q.season]
        return (
          <div key={q.num} className={`rounded-2xl border bg-gradient-to-br to-transparent p-5 ${colors.border} ${colors.gradient}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{q.emoji}</span>
              <h3 className={`text-base font-semibold ${colors.accent}`}>{q.name}</h3>
            </div>
            <div className="space-y-3">
              {q.months.map(mNum => {
                const m = MONTHS.find(mm => mm.num === mNum)!
                const data = months[mNum] || {}
                return (
                  <div key={mNum} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className={`text-xs uppercase tracking-wider font-semibold mb-1.5 ${colors.accent}`}>{m.name}</p>
                    {canEdit ? (
                      <>
                        <input
                          value={data.focus || ''}
                          onChange={e => onUpdate(mNum, { focus: e.target.value })}
                          placeholder="Focus…"
                          className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-white/30"
                        />
                        <AutoTextarea
                          value={data.plans || ''}
                          onChange={v => onUpdate(mNum, { plans: v })}
                          placeholder="Plannen…"
                          className="w-full bg-transparent text-xs text-white/70 mt-1 focus:outline-none placeholder:text-white/30"
                          minRows={2}
                        />
                      </>
                    ) : (
                      <>
                        {data.focus ? <p className="text-sm text-white">{data.focus}</p> : <p className="text-xs text-white/30 italic">Nog niet ingevuld</p>}
                        {data.plans && <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">{data.plans}</p>}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// ── Tijdlijn-view ─────────────────────────────────────────────────────────

function TimelineView({ months }: { months: Record<number, MonthData> }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-base font-semibold text-white mb-1">Tijdlijn</h2>
      <p className="text-xs text-white/50 mb-5">Chronologisch overzicht van alle plannen en mijlpalen door het jaar.</p>

      <div className="relative pl-6">
        {/* Verticale lijn */}
        <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-sky-500/30 via-emerald-500/30 via-amber-500/30 to-orange-500/30" />

        <div className="space-y-4">
          {MONTHS.map(m => {
            const data = months[m.num] || {}
            const isFilled = !!(data.focus?.trim() || data.plans?.trim() || data.milestones?.trim())
            const colors = SEASON_STYLES[m.season]
            return (
              <div key={m.num} className="relative">
                <div className={`absolute -left-[19px] top-1 w-3 h-3 rounded-full ring-4 ring-workx-dark ${isFilled ? colors.bg.replace('/10', '/60') : 'bg-white/10'}`}>
                  <div className={`w-full h-full rounded-full ${isFilled ? colors.accent.replace('text-', 'bg-').replace('300', '400') : 'bg-transparent'}`} />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={`text-xs uppercase tracking-wider font-semibold ${colors.accent}`}>{m.name}</span>
                    {!isFilled && <span className="text-[10px] text-white/30 italic">leeg</span>}
                  </div>
                  {data.focus && <p className="text-sm text-white font-medium">{data.focus}</p>}
                  {data.plans && <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap"><span className="text-white/40 uppercase tracking-wider text-[10px]">Plannen: </span>{data.plans}</p>}
                  {data.milestones && <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap"><span className="text-amber-300/70 uppercase tracking-wider text-[10px]">Mijlpalen: </span>{data.milestones}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
