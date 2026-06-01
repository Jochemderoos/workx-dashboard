'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/ui/Icons'

interface CoachingBudget {
  id: string
  userId: string
  periodStart: string
  usedAmount: number
  notes: string | null
  totalBudget: number
  remaining: number
  periodEnd: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEur(amount: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function ArbeidsvoorwaardenPage() {
  const [budget, setBudget] = useState<CoachingBudget | null>(null)
  const [loading, setLoading] = useState(true)
  const [usedInput, setUsedInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [periodInput, setPeriodInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coaching-budget')
      if (res.ok) {
        const data: CoachingBudget = await res.json()
        setBudget(data)
        setUsedInput(String(data.usedAmount))
        setNotesInput(data.notes || '')
        setPeriodInput(data.periodStart.slice(0, 10))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (overrides?: Partial<{ usedAmount: number; notes: string; periodStart: string; resetPeriod: boolean }>) => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        usedAmount: overrides?.usedAmount ?? (parseFloat(usedInput) || 0),
        notes: overrides?.notes ?? notesInput,
        periodStart: overrides?.periodStart ?? periodInput,
        ...(overrides?.resetPeriod ? { resetPeriod: true } : {}),
      }
      const res = await fetch('/api/coaching-budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data: CoachingBudget = await res.json()
        setBudget(data)
        setUsedInput(String(data.usedAmount))
        setNotesInput(data.notes || '')
        setPeriodInput(data.periodStart.slice(0, 10))
        setSavedAt(Date.now())
        setTimeout(() => setSavedAt(null), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!budget) {
    return <div className="p-6 text-red-400">Kon coaching-budget niet laden.</div>
  }

  const percentage = Math.min(100, (budget.usedAmount / budget.totalBudget) * 100)
  const periodEndDate = new Date(budget.periodEnd)
  const periodPassed = periodEndDate < new Date()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(140, 150, 30, 0.15)' }}
        >
          <Icons.target className="text-workx-lime" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Mijn coachingbudget
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            €1.500 ex btw per 3-jarige periode — houd hier zelf bij wat je hebt besteed
          </p>
        </div>
      </div>

      {/* Coaching budget card */}
      <div
        className="rounded-2xl border p-6 space-y-5"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Icons.target size={18} className="text-workx-lime" />
              Coaching-budget
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              €1.500 ex btw per 3-jarige periode (zie The Way it Workx 5.1).
              Vul hier zelf bij hoeveel je al hebt besteed.
            </p>
          </div>
          {periodPassed && (
            <button
              onClick={() => {
                if (confirm('Nieuwe 3-jaars periode starten? Het bestede bedrag wordt op €0 gezet en de start-datum wordt vandaag.')) {
                  save({ resetPeriod: true })
                }
              }}
              className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'rgba(140, 150, 30, 0.3)', color: 'var(--color-text-primary)' }}
            >
              Nieuwe periode starten
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Besteed: <strong style={{ color: 'var(--color-text-primary)' }}>{formatEur(budget.usedAmount)}</strong> van {formatEur(budget.totalBudget)}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Resterend: <strong style={{ color: budget.remaining > 0 ? 'rgb(140, 150, 30)' : '#ef4444' }}>{formatEur(budget.remaining)}</strong>
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${percentage}%`,
                backgroundColor: percentage >= 100 ? '#ef4444' : 'rgb(140, 150, 30)',
              }}
            />
          </div>
        </div>

        {/* Period info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Start huidige periode
            </label>
            <input
              type="date"
              value={periodInput}
              onChange={e => setPeriodInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="flex flex-col justify-end">
            <span style={{ color: 'var(--color-text-muted)' }}>Einde periode</span>
            <span className="font-medium mt-1.5" style={{ color: 'var(--color-text-primary)' }}>
              {formatDate(budget.periodEnd)}
              {periodPassed && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">verstreken</span>
              )}
            </span>
          </div>
        </div>

        {/* Used amount input */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Cumulatief besteed ex btw (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={usedInput}
            onChange={e => setUsedInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border focus:outline-none"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Notities (optioneel — bv. naam coach, data, sessies)
          </label>
          <textarea
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
            rows={4}
            placeholder="Bijvoorbeeld: 3 sessies bij coach X in maart-mei à €250 ex btw"
            className="w-full px-3 py-2 rounded-lg border focus:outline-none"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'rgb(140, 150, 30)',
              color: 'white',
            }}
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          {savedAt && (
            <span className="text-sm flex items-center gap-1.5" style={{ color: 'rgb(140, 150, 30)' }}>
              <Icons.check size={14} />
              Opgeslagen
            </span>
          )}
        </div>
      </div>

      {/* Info card */}
      <div
        className="rounded-2xl border p-5 text-sm space-y-2"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div className="flex items-start gap-3">
          <Icons.info size={16} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p>
              <strong style={{ color: 'var(--color-text-primary)' }}>Werking:</strong> je krijgt €1.500 ex btw per 3-jaars
              periode voor een externe coach. Daarnaast mag je gedurende 2 werkdagen onder werktijd coaching volgen
              (geen extra vrije dagen).
            </p>
            <p>
              Houd hier zelf bij hoeveel je hebt besteed. Bewaar de facturen voor verrekening — geef ze door aan Hanna.
            </p>
            <p>
              Volledige tekst van de regeling: <a href="/dashboard/hr-docs?doc=the-way-it-workx" className="underline" style={{ color: 'rgb(140, 150, 30)' }}>The Way it Workx → Ontwikkelen → 5.1 Coach</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
