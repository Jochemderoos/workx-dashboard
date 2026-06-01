'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import TextReveal from '@/components/ui/TextReveal'
import { getPhotoUrl } from '@/lib/team-photos'

interface BudgetRow {
  userId: string
  name: string
  role: string
  startDate: string | null
  usedAmount: number
  notes: string
  periodStart: string | null
  periodEnd: string | null
  totalBudget: number
  remaining: number
  hasRecord: boolean
}

interface EditState {
  usedAmount: string
  notes: string
  periodStart: Date | null
}

function formatEur(amount: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function rowToEdit(row: BudgetRow): EditState {
  return {
    usedAmount: String(row.usedAmount || 0),
    notes: row.notes || '',
    periodStart: row.periodStart ? new Date(row.periodStart) : null,
  }
}

export default function CoachingBudgettenBeheerPage() {
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const u = await res.json()
          if (u.role === 'ADMIN') setHasAccess(true)
        }
      } catch {
        // ignore
      }
    }
    check()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coaching-budget/admin')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list: BudgetRow[] = data.budgets
      setRows(list)
      const initial: Record<string, EditState> = {}
      for (const row of list) initial[row.userId] = rowToEdit(row)
      setEdits(initial)
      setSavedSnapshot(initial)
    } catch {
      toast.error('Kon overzicht niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) load()
  }, [hasAccess, load])

  const setField = (userId: string, field: keyof EditState, value: string | Date | null) => {
    setEdits(prev => {
      const current = prev[userId] ?? { usedAmount: '0', notes: '', periodStart: null }
      return { ...prev, [userId]: { ...current, [field]: value } as EditState }
    })
  }

  const isDirty = (userId: string) => {
    const cur = edits[userId]
    const snap = savedSnapshot[userId]
    if (!cur || !snap) return false
    const sameDate = (cur.periodStart?.getTime() ?? null) === (snap.periodStart?.getTime() ?? null)
    return cur.usedAmount !== snap.usedAmount || cur.notes !== snap.notes || !sameDate
  }

  const save = async (row: BudgetRow) => {
    const cur = edits[row.userId]
    if (!cur) return
    const amount = parseFloat(cur.usedAmount.replace(',', '.')) || 0
    if (amount < 0) {
      toast.error('Bedrag mag niet negatief zijn')
      return
    }
    setSaving(prev => new Set(prev).add(row.userId))
    try {
      const res = await fetch('/api/coaching-budget/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: row.userId,
          usedAmount: amount,
          notes: cur.notes,
          periodStart: cur.periodStart ? cur.periodStart.toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setRows(prev => prev.map(r => r.userId === row.userId ? {
        ...r,
        usedAmount: updated.usedAmount,
        notes: updated.notes,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        remaining: updated.remaining,
        hasRecord: true,
      } : r))
      const snap: EditState = {
        usedAmount: String(updated.usedAmount),
        notes: updated.notes || '',
        periodStart: new Date(updated.periodStart),
      }
      setEdits(prev => ({ ...prev, [row.userId]: snap }))
      setSavedSnapshot(prev => ({ ...prev, [row.userId]: snap }))
      setSavedAt(prev => ({ ...prev, [row.userId]: Date.now() }))
      setTimeout(() => {
        setSavedAt(prev => {
          const next = { ...prev }
          delete next[row.userId]
          return next
        })
      }, 2000)
    } catch {
      toast.error(`Kon budget van ${row.name.split(' ')[0]} niet opslaan`)
    } finally {
      setSaving(prev => {
        const next = new Set(prev)
        next.delete(row.userId)
        return next
      })
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.name.toLowerCase().includes(q))
  }, [rows, filter])

  const totals = useMemo(() => {
    const ingevuld = rows.filter(r => r.hasRecord).length
    const totaalBesteed = rows.reduce((s, r) => s + r.usedAmount, 0)
    return { ingevuld, totaalBesteed }
  }, [rows])

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Alleen voor partners en office management.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span style={{ color: 'var(--color-text-tertiary)' }}>Laden…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-emerald-500/10 flex items-center justify-center">
            <Icons.target className="text-workx-lime" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white"><TextReveal>Coaching-budgetten</TextReveal></h1>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Beheer per medewerker — vul reeds bestede facturen in zodat iedereen vanaf de start een goed overzicht heeft.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Medewerkers</p>
          <p className="text-xl font-semibold text-white mt-0.5">{rows.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Ingevuld</p>
          <p className="text-xl font-semibold text-white mt-0.5">{totals.ingevuld}<span className="text-sm text-gray-500"> / {rows.length}</span></p>
        </div>
        <div className="card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Totaal besteed</p>
          <p className="text-xl font-semibold text-workx-lime mt-0.5">{formatEur(totals.totaalBesteed)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-xs">
        <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter op naam…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
        />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(row => {
          const edit = edits[row.userId]
          const amount = parseFloat((edit?.usedAmount || '0').replace(',', '.')) || 0
          const pct = Math.min(100, (amount / row.totalBudget) * 100)
          const periodEndDate = edit?.periodStart
            ? new Date(edit.periodStart.getFullYear() + 3, edit.periodStart.getMonth(), edit.periodStart.getDate())
            : null
          const periodPassed = periodEndDate ? periodEndDate < new Date() : false
          const dirty = isDirty(row.userId)
          const isSaving = saving.has(row.userId)
          const justSaved = !!savedAt[row.userId]
          const photo = getPhotoUrl(row.name)
          const remaining = row.totalBudget - amount

          return (
            <div key={row.userId} className="card p-5 space-y-4 border border-white/10">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                  {photo ? (
                    <Image src={photo} alt={row.name} fill className="object-cover" sizes="44px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-300">
                      {row.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{row.name}</p>
                  <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {row.role === 'PARTNER' ? 'Partner' : row.role === 'ADMIN' ? 'Office' : 'Advocaat'}
                    {!row.hasRecord && <span className="ml-2 text-amber-400/80">· nog niet ingevuld</span>}
                    {periodPassed && row.hasRecord && <span className="ml-2 text-red-400/80">· periode verstreken</span>}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>
                    Besteed: <strong className="text-white">{formatEur(amount)}</strong> / {formatEur(row.totalBudget)}
                  </span>
                  <span style={{ color: remaining > 0 ? 'rgb(140, 150, 30)' : '#ef4444' }}>
                    {remaining > 0 ? `${formatEur(remaining)} over` : 'op'}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/5">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? '#ef4444' : 'rgb(140, 150, 30)',
                    }}
                  />
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Besteed (€ ex btw)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={edit?.usedAmount ?? '0'}
                    onChange={(e) => setField(row.userId, 'usedAmount', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Start periode</label>
                  <DatePicker
                    selected={edit?.periodStart ?? null}
                    onChange={(d) => setField(row.userId, 'periodStart', d)}
                    placeholder="Kies datum…"
                    dateFormat="d MMM yyyy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Notities (coach, sessies, facturen)</label>
                <textarea
                  value={edit?.notes ?? ''}
                  onChange={(e) => setField(row.userId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Bv. 3 sessies bij coach X à €250 — factuur 2025-04, 2025-06, 2025-09"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-workx-lime/30"
                />
              </div>

              {/* Save */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {edit?.periodStart && (
                    <>Einde: {new Date(edit.periodStart.getFullYear() + 3, edit.periodStart.getMonth(), edit.periodStart.getDate()).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                  )}
                </span>
                <button
                  onClick={() => save(row)}
                  disabled={!dirty || isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  style={{
                    backgroundColor: dirty ? 'rgb(140, 150, 30)' : 'rgba(255,255,255,0.05)',
                    color: dirty ? 'white' : 'var(--color-text-tertiary)',
                  }}
                >
                  {isSaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : justSaved ? (
                    <><Icons.check size={14} /> Opgeslagen</>
                  ) : (
                    <><Icons.save size={14} /> Opslaan</>
                  )}
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full card p-8 text-center">
            <p style={{ color: 'var(--color-text-tertiary)' }}>Geen medewerkers gevonden voor "{filter}"</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icons.info className="text-blue-400" size={16} />
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            <p className="text-white font-medium mb-1">Hoe werkt het?</p>
            <p>
              Bij een nieuwe 3-jaars periode wordt automatisch de hire-datum van de medewerker gebruikt als start
              (of vandaag als die ontbreekt). Pas de start aan als de coachingperiode op een andere datum is begonnen.
              Medewerkers zien hun eigen overzicht op <a href="/dashboard/arbeidsvoorwaarden" className="text-workx-lime underline">Mijn coachingbudget</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
