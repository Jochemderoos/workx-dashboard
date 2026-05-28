'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'

interface OnboardingItem {
  id: string
  templateId: string | null
  title: string
  description: string | null
  category: string
  sortOrder: number
  isCompleted: boolean
  completedAt: string | null
  notes: string | null
}

interface Employee {
  id: string
  name: string
  email: string | null
  startDate: string | null
  role: string | null
  isArchived: boolean
  createdAt: string
  items: OnboardingItem[]
}

interface Template {
  id: string
  title: string
  description: string | null
  category: string
  sortOrder: number
  isActive: boolean
}

const CATEGORY_META: Record<string, { icon: string; accent: string }> = {
  'Hardware': { icon: '💻', accent: 'text-cyan-700 dark:text-cyan-300' },
  'Accounts & Toegang': { icon: '🔐', accent: 'text-blue-700 dark:text-blue-300' },
  'Wegwijs': { icon: '🧭', accent: 'text-purple-700 dark:text-purple-300' },
  'HR & Beleid': { icon: '📋', accent: 'text-rose-700 dark:text-rose-300' },
  'Werkplek': { icon: '🪴', accent: 'text-emerald-700 dark:text-emerald-300' },
  'Eerste maand': { icon: '🚀', accent: 'text-amber-700 dark:text-amber-300' },
}

function catMeta(category: string) {
  return CATEGORY_META[category] || { icon: '✅', accent: 'text-workx-lime' }
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const hasAccess = role === 'PARTNER' || role === 'ADMIN'

  const [employees, setEmployees] = useState<Employee[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewEmployee, setShowNewEmployee] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null)

  // New employee form
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newStartDate, setNewStartDate] = useState<Date | null>(null)

  // New template form
  const [newTplTitle, setNewTplTitle] = useState('')
  const [newTplCategory, setNewTplCategory] = useState('Hardware')
  const [newTplDescription, setNewTplDescription] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const url = `/api/onboarding/employees${showArchived ? '?includeArchived=1' : ''}`
      const [empRes, tplRes] = await Promise.all([
        fetch(url),
        fetch('/api/onboarding/templates'),
      ])
      if (empRes.ok) {
        const data = await empRes.json()
        setEmployees(data)
        if (!selectedId && data.length > 0) setSelectedId(data[0].id)
        if (selectedId && !data.find((e: Employee) => e.id === selectedId)) {
          setSelectedId(data[0]?.id || null)
        }
      }
      if (tplRes.ok) setTemplates(await tplRes.json())
    } catch {
      toast.error('Kon data niet laden')
    } finally {
      setLoading(false)
    }
  }, [showArchived, selectedId])

  useEffect(() => { fetchAll() }, [showArchived]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => employees.find(e => e.id === selectedId) || null, [employees, selectedId])

  const grouped = useMemo(() => {
    if (!selected) return new Map<string, OnboardingItem[]>()
    const map = new Map<string, OnboardingItem[]>()
    for (const item of selected.items) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    map.forEach((items) => {
      items.sort((a: OnboardingItem, b: OnboardingItem) => a.sortOrder - b.sortOrder)
    })
    return map
  }, [selected])

  const progress = useMemo(() => {
    if (!selected) return { done: 0, total: 0, pct: 0 }
    const total = selected.items.length
    const done = selected.items.filter(i => i.isCompleted).length
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [selected])

  const addEmployee = async () => {
    if (!newName.trim()) {
      toast.error('Naam is verplicht')
      return
    }
    try {
      const res = await fetch('/api/onboarding/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim() || undefined,
          role: newRole.trim() || undefined,
          startDate: newStartDate ? newStartDate.toISOString() : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setEmployees(prev => [created, ...prev])
      setSelectedId(created.id)
      setShowNewEmployee(false)
      setNewName(''); setNewEmail(''); setNewRole(''); setNewStartDate(null)
      toast.success('Medewerker toegevoegd')
    } catch {
      toast.error('Kon medewerker niet toevoegen')
    }
  }

  const updateEmployee = async (id: string, patch: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...patch } as Employee : e))
    try {
      await fetch(`/api/onboarding/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch {
      toast.error('Kon niet opslaan')
      fetchAll()
    }
  }

  const deleteEmployee = async (id: string) => {
    if (!confirm('Deze medewerker en zijn/haar checklist permanent verwijderen?')) return
    try {
      await fetch(`/api/onboarding/employees/${id}`, { method: 'DELETE' })
      setEmployees(prev => prev.filter(e => e.id !== id))
      if (selectedId === id) {
        const next = employees.find(e => e.id !== id)
        setSelectedId(next?.id || null)
      }
      toast.success('Medewerker verwijderd')
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const toggleItem = async (item: OnboardingItem) => {
    if (!selected) return
    const newCompleted = !item.isCompleted
    setEmployees(prev => prev.map(e => e.id === selected.id ? {
      ...e,
      items: e.items.map(i => i.id === item.id ? { ...i, isCompleted: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null } : i),
    } : e))
    try {
      await fetch(`/api/onboarding/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newCompleted }),
      })
    } catch {
      toast.error('Kon niet opslaan')
      fetchAll()
    }
  }

  const updateItemNotes = async (item: OnboardingItem, notes: string) => {
    if (!selected) return
    setEmployees(prev => prev.map(e => e.id === selected.id ? {
      ...e,
      items: e.items.map(i => i.id === item.id ? { ...i, notes } : i),
    } : e))
    try {
      await fetch(`/api/onboarding/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    } catch {
      toast.error('Notitie niet opgeslagen')
    }
  }

  const deleteItem = async (item: OnboardingItem) => {
    if (!confirm(`'${item.title}' verwijderen uit deze checklist?`)) return
    if (!selected) return
    setEmployees(prev => prev.map(e => e.id === selected.id ? {
      ...e,
      items: e.items.filter(i => i.id !== item.id),
    } : e))
    try {
      await fetch(`/api/onboarding/items/${item.id}`, { method: 'DELETE' })
    } catch {
      toast.error('Kon niet verwijderen')
      fetchAll()
    }
  }

  const addTemplate = async () => {
    if (!newTplTitle.trim()) {
      toast.error('Titel is verplicht')
      return
    }
    try {
      const res = await fetch('/api/onboarding/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTplTitle.trim(),
          category: newTplCategory,
          description: newTplDescription.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setTemplates(prev => [...prev, created])
      setNewTplTitle(''); setNewTplDescription('')
      toast.success('Template toegevoegd')
    } catch {
      toast.error('Kon template niet toevoegen')
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Dit template verwijderen? Geldt alleen voor nieuwe medewerkers.')) return
    try {
      await fetch(`/api/onboarding/templates/${id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {
      toast.error('Kon template niet verwijderen')
    }
  }

  if (!session) return null
  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.lock size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Alleen toegankelijk voor partner/admin</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header met gradient */}
      <section className="relative overflow-hidden rounded-3xl border p-6 sm:p-8" style={{
        borderColor: 'rgba(180, 185, 50, 0.35)',
        background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
      }}>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            🎉
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Onboarding
            </p>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Welkom-bij-Workx checklist
            </h1>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              Per nieuwe medewerker een complete checklist. Vink af wat is gedaan, voeg notities toe, breid de standaardlijst uit als we iets nieuws bedenken.
            </p>
          </div>
          <button
            onClick={() => setShowNewEmployee(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg"
            style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)', boxShadow: '0 8px 20px rgba(249, 255, 133, 0.25)' }}
          >
            <Icons.userPlus size={16} />
            Nieuwe medewerker
          </button>
        </div>
      </section>

      {/* New employee form */}
      {showNewEmployee && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(180, 185, 50, 0.4)', background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Nieuwe medewerker</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Volledige naam *"
              autoFocus
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="E-mailadres"
              type="email"
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <input
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              placeholder="Functie (bv. Advocaat-stagiaire)"
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <DatePicker
              selected={newStartDate}
              onChange={(d) => setNewStartDate(d)}
              placeholder="Startdatum"
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => { setShowNewEmployee(false); setNewName(''); setNewEmail(''); setNewRole(''); setNewStartDate(null) }}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Annuleren
            </button>
            <button
              onClick={addEmployee}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
            >
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(180, 185, 50, 0.3)', borderTopColor: 'rgb(180, 185, 50)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Employee list */}
          <aside className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                Medewerkers
              </h2>
              <button
                onClick={() => setShowArchived(v => !v)}
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md transition-colors"
                style={{ background: showArchived ? 'rgba(249, 255, 133, 0.2)' : 'var(--color-bg-glass)', color: 'var(--color-text-tertiary)' }}
              >
                {showArchived ? '✓ incl. archief' : 'archief'}
              </button>
            </div>
            {employees.length === 0 && (
              <div className="rounded-xl p-4 text-xs" style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                Nog geen medewerkers. Klik op <em>Nieuwe medewerker</em> rechtsboven.
              </div>
            )}
            {employees.map(emp => {
              const total = emp.items.length
              const done = emp.items.filter(i => i.isCompleted).length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const isSelected = selectedId === emp.id
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className={`w-full text-left rounded-xl p-3 transition-all ${isSelected ? '' : 'hover:scale-[1.01]'}`}
                  style={{
                    background: isSelected ? 'rgba(249, 255, 133, 0.18)' : 'var(--color-bg-card)',
                    border: `1px solid ${isSelected ? 'rgba(180, 185, 50, 0.5)' : 'var(--color-border-subtle)'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {emp.name}
                      </p>
                      {emp.role && <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{emp.role}</p>}
                    </div>
                    {emp.isArchived && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider" style={{ background: 'var(--color-bg-glass)', color: 'var(--color-text-tertiary)' }}>
                        Klaar
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-glass)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct}%`,
                        background: pct === 100 ? 'rgb(34, 197, 94)' : 'rgb(249, 255, 133)',
                      }} />
                    </div>
                    <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {done}/{total}
                    </span>
                  </div>
                </button>
              )
            })}
          </aside>

          {/* Selected employee detail */}
          <main className="space-y-4">
            {!selected && employees.length > 0 && (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Selecteer links een medewerker</p>
              </div>
            )}
            {selected && (
              <>
                {/* Employee header met progress */}
                <div className="rounded-2xl p-5 sm:p-6 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{selected.name}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        {selected.role && <span>{selected.role}</span>}
                        {selected.email && <a href={`mailto:${selected.email}`} className="hover:underline" style={{ color: 'rgb(140, 150, 30)' }}>{selected.email}</a>}
                        {selected.startDate && (
                          <span>Start: {new Date(selected.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateEmployee(selected.id, { isArchived: !selected.isArchived })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: selected.isArchived ? 'rgba(249, 255, 133, 0.18)' : 'var(--color-bg-glass)',
                          color: selected.isArchived ? 'rgb(140, 150, 30)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {selected.isArchived ? '↺ Heractiveren' : '✓ Onboarding klaar'}
                      </button>
                      <button
                        onClick={() => deleteEmployee(selected.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                        style={{ background: 'var(--color-bg-glass)', color: 'rgb(239, 68, 68)' }}
                        title="Verwijderen"
                      >
                        <Icons.trash size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-5">
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="font-bold" style={{ color: progress.pct === 100 ? 'rgb(34, 197, 94)' : 'rgb(140, 150, 30)' }}>{progress.pct}%</span>
                        {' '}voltooid · {progress.done} van {progress.total} items
                      </p>
                      {progress.pct === 100 && (
                        <span className="text-xs font-semibold" style={{ color: 'rgb(34, 197, 94)' }}>🎉 Onboarding compleet!</span>
                      )}
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-glass)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${progress.pct}%`,
                        background: progress.pct === 100
                          ? 'linear-gradient(90deg, rgb(34, 197, 94), rgb(74, 222, 128))'
                          : 'linear-gradient(90deg, rgb(249, 255, 133), rgb(180, 185, 50))',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Items grouped by category */}
                <div className="space-y-4">
                  {Array.from(grouped.entries()).map(([category, items]) => {
                    const meta = catMeta(category)
                    const catDone = items.filter(i => i.isCompleted).length
                    return (
                      <div key={category} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
                        <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--color-bg-glass)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <h3 className={`text-sm font-bold flex items-center gap-2 ${meta.accent}`}>
                            <span className="text-base">{meta.icon}</span>
                            {category}
                          </h3>
                          <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                            {catDone}/{items.length}
                          </span>
                        </div>
                        <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          {items.map(item => {
                            const hasNotes = !!item.notes
                            const notesOpen = expandedNotesId === item.id
                            return (
                              <li key={item.id} className="px-5 py-3 group" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => toggleItem(item)}
                                    className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0"
                                    style={{
                                      background: item.isCompleted ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                                      border: `1.5px solid ${item.isCompleted ? 'rgba(34, 197, 94, 0.6)' : 'var(--color-border)'}`,
                                    }}
                                  >
                                    {item.isCompleted && <Icons.check size={11} style={{ color: 'rgb(34, 197, 94)' }} />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm ${item.isCompleted ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                                      {item.title}
                                    </p>
                                    {item.description && (
                                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                                        {item.description}
                                      </p>
                                    )}
                                    {item.isCompleted && item.completedAt && (
                                      <p className="text-[10px] mt-1" style={{ color: 'rgba(34, 197, 94, 0.7)' }}>
                                        ✓ Afgevinkt op {new Date(item.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </p>
                                    )}
                                    {notesOpen ? (
                                      <textarea
                                        autoFocus
                                        defaultValue={item.notes || ''}
                                        onBlur={(e) => { updateItemNotes(item, e.target.value); setExpandedNotesId(null) }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') setExpandedNotesId(null)
                                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur()
                                        }}
                                        placeholder="Notities…"
                                        className="w-full mt-2 rounded-lg px-3 py-2 text-xs focus:outline-none"
                                        style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                                        rows={3}
                                      />
                                    ) : hasNotes ? (
                                      <button
                                        onClick={() => setExpandedNotesId(item.id)}
                                        className="mt-2 text-xs text-left rounded-lg px-3 py-2 hover:opacity-80 transition-all w-full"
                                        style={{ background: 'rgba(249, 255, 133, 0.08)', border: '1px solid rgba(180, 185, 50, 0.3)', color: 'var(--color-text-primary)' }}
                                      >
                                        📝 {item.notes}
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!hasNotes && !notesOpen && (
                                      <button
                                        onClick={() => setExpandedNotesId(item.id)}
                                        className="p-1 rounded text-xs transition-colors"
                                        style={{ color: 'var(--color-text-tertiary)' }}
                                        title="Notitie toevoegen"
                                      >
                                        <Icons.edit size={12} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteItem(item)}
                                      className="p-1 rounded text-xs transition-colors"
                                      style={{ color: 'rgb(239, 68, 68)' }}
                                      title="Item verwijderen"
                                    >
                                      <Icons.trash size={12} />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* Templates beheer */}
      <section className="rounded-2xl border p-5" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
        <button
          onClick={() => setShowTemplates(v => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Icons.settings size={16} style={{ color: 'rgb(140, 150, 30)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Standaard-lijst beheren</h3>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              ({templates.length} items)
            </span>
          </div>
          <Icons.chevronDown size={14} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
        {showTemplates && (
          <div className="mt-4 space-y-3">
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Wijzigingen aan de standaard-lijst gelden alleen voor <strong>nieuwe</strong> medewerkers. Bestaande checklists blijven onveranderd.
            </p>
            <div className="space-y-2">
              {Object.keys(CATEGORY_META).map(category => {
                const items = templates.filter(t => t.category === category)
                if (items.length === 0) return null
                const meta = catMeta(category)
                return (
                  <div key={category}>
                    <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${meta.accent}`}>
                      {meta.icon} {category}
                    </p>
                    <ul className="space-y-1">
                      {items.map(t => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm px-3 py-1.5 rounded-md group hover:bg-[var(--color-bg-glass)]" style={{ color: 'var(--color-text-primary)' }}>
                          <span className="truncate">{t.title}{t.description && <span className="text-xs ml-2" style={{ color: 'var(--color-text-tertiary)' }}>· {t.description}</span>}</span>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 transition-all"
                            style={{ color: 'rgb(239, 68, 68)' }}
                            title="Verwijderen"
                          >
                            <Icons.trash size={11} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Nieuw item toevoegen</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <input
                  value={newTplTitle}
                  onChange={e => setNewTplTitle(e.target.value)}
                  placeholder="Titel"
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <select
                  value={newTplCategory}
                  onChange={e => setNewTplCategory(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {Object.keys(CATEGORY_META).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input
                value={newTplDescription}
                onChange={e => setNewTplDescription(e.target.value)}
                placeholder="Beschrijving (optioneel)"
                className="w-full mt-2 rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={addTemplate}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
                >
                  Toevoegen aan standaard-lijst
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
