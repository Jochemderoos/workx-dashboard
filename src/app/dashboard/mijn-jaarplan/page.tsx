'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import TextReveal from '@/components/ui/TextReveal'

interface YearPlanItem {
  id: string
  planId: string
  category: string
  title: string
  description: string | null
  status: 'todo' | 'doing' | 'done'
  progress: number
  targetDate: string | null
  completedAt: string | null
  position: number
  createdAt: string
  updatedAt: string
}

interface YearPlanEvaluation {
  id: string
  evaluatorName: string
  notes: string
  evaluatedAt: string
}

interface YearPlan {
  id: string
  year: number
  items: YearPlanItem[]
  evaluations: YearPlanEvaluation[]
}

const CATEGORIES = [
  {
    key: 'theorie',
    label: 'Juridische theorie',
    icon: 'books' as const,
    color: 'purple',
    description: 'Verdieping in onderwerpen, vakliteratuur, jurisprudentie, congressen.',
  },
  {
    key: 'praktijk',
    label: 'Juridische praktijk',
    icon: 'briefcase' as const,
    color: 'indigo',
    description: 'Zaken doen op specifieke arbeidsrechtelijke gebieden, kennis in praktijk brengen.',
  },
  {
    key: 'acquisitie',
    label: 'Acquisitie',
    icon: 'trendingUp' as const,
    color: 'emerald',
    description: 'Nieuwe relaties, content, zichtbaarheid, netwerk.',
  },
  {
    key: 'intern',
    label: 'Intern',
    icon: 'users' as const,
    color: 'amber',
    description: 'Opleiden junioren, organiseren seminars, borrels, uitjes — bijdrage aan team.',
  },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

export default function MijnJaarplanPage() {
  const [plan, setPlan] = useState<YearPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [year] = useState(new Date().getFullYear())

  // Inline edit-state per item-id
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<YearPlanItem>>({})

  // New-item-state per categorie
  const [newItem, setNewItem] = useState<Record<string, { title: string; description: string; targetDate: string }>>({})

  useEffect(() => {
    fetch(`/api/year-plan?year=${year}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setPlan(data)
        else toast.error(data.error || 'Kon plan niet laden')
      })
      .catch(() => toast.error('Netwerkfout'))
      .finally(() => setIsLoading(false))
  }, [year])

  const itemsByCategory = useMemo(() => {
    const map: Record<string, YearPlanItem[]> = { theorie: [], praktijk: [], acquisitie: [], intern: [] }
    if (plan) for (const it of plan.items) (map[it.category] ||= []).push(it)
    return map
  }, [plan])

  const addItem = async (category: CategoryKey) => {
    const draft = newItem[category]
    if (!draft?.title?.trim()) return
    try {
      const res = await fetch('/api/year-plan/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: draft.title,
          description: draft.description,
          targetDate: draft.targetDate || null,
          year,
        }),
      })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setPlan(p => p ? { ...p, items: [...p.items, item] } : p)
      setNewItem(s => ({ ...s, [category]: { title: '', description: '', targetDate: '' } }))
      toast.success('Toegevoegd')
    } catch {
      toast.error('Toevoegen mislukt')
    }
  }

  const updateItem = async (id: string, patch: Partial<YearPlanItem>) => {
    try {
      const res = await fetch('/api/year-plan/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setPlan(p => p ? { ...p, items: p.items.map(i => i.id === id ? updated : i) } : p)
      return updated
    } catch {
      toast.error('Opslaan mislukt')
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Dit item verwijderen?')) return
    try {
      const res = await fetch(`/api/year-plan/items?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setPlan(p => p ? { ...p, items: p.items.filter(i => i.id !== id) } : p)
      toast.success('Verwijderd')
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }

  const beginEdit = (item: YearPlanItem) => {
    setEditingId(item.id)
    setEditDraft({ title: item.title, description: item.description || '', targetDate: item.targetDate })
  }
  const saveEdit = async () => {
    if (!editingId) return
    await updateItem(editingId, editDraft)
    setEditingId(null)
    setEditDraft({})
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6 fade-in">
        <div className="card p-8 text-center text-white/50">Plan laden…</div>
      </div>
    )
  }

  const totalItems = plan?.items.length || 0
  const doneCount = plan?.items.filter(i => i.status === 'done').length || 0
  const avgProgress = totalItems > 0
    ? Math.round((plan!.items.reduce((s, i) => s + (i.status === 'done' ? 100 : i.progress), 0)) / totalItems)
    : 0

  return (
    <div className="max-w-5xl space-y-6 fade-in relative">
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center">
              <Icons.target className="text-purple-300" size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                <TextReveal>{`Mijn Jaarplan ${year}`}</TextReveal>
              </h1>
              <p className="text-sm text-white/60 mt-0.5">Persoonlijke ontwikkeldoelen — theorie, praktijk, acquisitie, intern</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{doneCount}<span className="text-sm text-white/40">/{totalItems}</span></p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">afgerond</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-300 tabular-nums">{avgProgress}<span className="text-sm text-white/40">%</span></p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">gem. voortgang</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categorieën */}
      {CATEGORIES.map(cat => {
        const items = itemsByCategory[cat.key] || []
        const colorClass = {
          purple: 'border-purple-500/30 from-purple-500/8',
          indigo: 'border-indigo-500/30 from-indigo-500/8',
          emerald: 'border-emerald-500/30 from-emerald-500/8',
          amber: 'border-amber-500/30 from-amber-500/8',
        }[cat.color]
        const accentText = {
          purple: 'text-purple-300',
          indigo: 'text-indigo-300',
          emerald: 'text-emerald-300',
          amber: 'text-amber-300',
        }[cat.color]
        const Icon = Icons[cat.icon] as any

        return (
          <section key={cat.key} className={`relative rounded-2xl border bg-gradient-to-br to-transparent p-5 ${colorClass}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {Icon && <Icon className={accentText} size={18} />}
                <div>
                  <h2 className="text-lg font-semibold text-white">{cat.label}</h2>
                  <p className="text-xs text-white/50">{cat.description}</p>
                </div>
              </div>
              <span className="text-xs text-white/40">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4">
              {items.map(item => {
                const isEditing = editingId === item.id
                return (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={editDraft.title || ''}
                          onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                          className="input-field w-full"
                          placeholder="Titel"
                        />
                        <textarea
                          value={editDraft.description || ''}
                          onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30 resize-none"
                          placeholder="Toelichting (optioneel)"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <DatePicker
                            selected={editDraft.targetDate ? new Date(editDraft.targetDate) : null}
                            onChange={(d) => setEditDraft(s => ({ ...s, targetDate: d ? formatDateForAPI(d) : null }))}
                            placeholder="Streefdatum"
                          />
                          <button onClick={saveEdit} className="btn-primary text-sm py-1.5 px-3">Opslaan</button>
                          <button onClick={() => { setEditingId(null); setEditDraft({}) }} className="btn-secondary text-sm py-1.5 px-3">Annuleren</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => updateItem(item.id, {
                              status: item.status === 'done' ? 'doing' : item.status === 'doing' ? 'done' : 'doing',
                            })}
                            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              item.status === 'done'
                                ? 'bg-emerald-500 border-emerald-500'
                                : item.status === 'doing'
                                  ? 'bg-purple-500/30 border-purple-500'
                                  : 'border-white/30 hover:border-white/60'
                            }`}
                            title="Klik om status te wisselen"
                          >
                            {item.status === 'done' && <Icons.check size={12} className="text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${item.status === 'done' ? 'text-white/50 line-through' : 'text-white'}`}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-xs text-white/60 mt-0.5 whitespace-pre-wrap">{item.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                              {item.targetDate && (
                                <span className="flex items-center gap-1">
                                  <Icons.calendar size={11} />
                                  {new Date(item.targetDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {item.status === 'done' && item.completedAt && (
                                <span className="text-emerald-400">✓ {new Date(item.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                              )}
                              <span>Status: {item.status === 'todo' ? 'Nog te doen' : item.status === 'doing' ? 'Mee bezig' : 'Afgerond'}</span>
                            </div>

                            {/* Progress-slider voor doing-items */}
                            {item.status === 'doing' && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={item.progress}
                                  onChange={e => updateItem(item.id, { progress: parseInt(e.target.value, 10) })}
                                  className="flex-1 accent-purple-400"
                                />
                                <span className="text-xs text-purple-300 font-medium tabular-nums w-10 text-right">{item.progress}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => beginEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white" title="Bewerken">
                              <Icons.edit size={12} />
                            </button>
                            <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400" title="Verwijderen">
                              <Icons.trash size={12} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Nieuw item-form */}
            <div className="rounded-xl border border-dashed border-white/15 p-3 space-y-2">
              <input
                value={newItem[cat.key]?.title || ''}
                onChange={e => setNewItem(s => ({ ...s, [cat.key]: { ...s[cat.key] || { description: '', targetDate: '' }, title: e.target.value } }))}
                placeholder={`Nieuw doel voor "${cat.label}"…`}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
                onKeyDown={e => { if (e.key === 'Enter' && (newItem[cat.key]?.title?.trim())) addItem(cat.key) }}
              />
              {newItem[cat.key]?.title && (
                <>
                  <textarea
                    value={newItem[cat.key]?.description || ''}
                    onChange={e => setNewItem(s => ({ ...s, [cat.key]: { ...s[cat.key], description: e.target.value } }))}
                    rows={2}
                    placeholder="Toelichting (optioneel)"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30 resize-none"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <DatePicker
                      selected={newItem[cat.key]?.targetDate ? new Date(newItem[cat.key].targetDate) : null}
                      onChange={d => setNewItem(s => ({ ...s, [cat.key]: { ...s[cat.key], targetDate: d ? formatDateForAPI(d) : '' } }))}
                      placeholder="Streefdatum (optioneel)"
                    />
                    <button onClick={() => addItem(cat.key)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                      <Icons.plus size={12} /> Toevoegen
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )
      })}

      {/* Evaluaties (lezen — partners voegen toe via hun overview) */}
      {plan && plan.evaluations.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Icons.chat size={16} className="text-white/40" />
            Evaluaties
          </h2>
          <div className="space-y-3">
            {plan.evaluations.map(ev => (
              <div key={ev.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-medium text-white">{ev.evaluatorName}</p>
                  <span className="text-[11px] text-white/40">{new Date(ev.evaluatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{ev.notes}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
