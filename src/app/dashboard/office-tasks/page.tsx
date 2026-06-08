'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import TextReveal from '@/components/ui/TextReveal'
import PhotoDropdown from '@/components/ui/PhotoDropdown'
import LabelDropdown from '@/components/ui/LabelDropdown'

interface Task {
  id: string
  category: string
  title: string
  description: string | null
  assigneeId: string | null
  assigneeName: string | null
  frequency: string
  isArchived: boolean
  lastCompletedAt: string | null
  lastCompletedById: string | null
  lastCompletedByName: string | null
  completedAt: string | null
  completedById: string | null
  completedByName: string | null
  completions: Array<{ id: string; completedByName: string; completedAt: string; note: string | null }>
}

interface Assignee {
  id: string
  name: string
  avatarUrl: string | null
}

const CATEGORIES = [
  { key: 'administratie', label: 'Administratie & facturatie', color: 'purple' },
  { key: 'documenten', label: 'Documenten & verwerking', color: 'indigo' },
  { key: 'juridisch', label: 'Juridische ondersteuning', color: 'emerald' },
  { key: 'kantoorbeheer', label: 'Kantoorbeheer & bestellingen', color: 'amber' },
  { key: 'facilitair', label: 'Facilitaire taken', color: 'pink' },
  { key: 'communicatie', label: 'Communicatie', color: 'cyan' },
  { key: 'post', label: 'Post & logistiek', color: 'orange' },
  { key: 'overig', label: 'Overig', color: 'gray' },
] as const

const FREQUENCY_LABELS: Record<string, string> = {
  once: 'Eenmalig',
  daily: 'Dagelijks',
  weekly: 'Wekelijks',
  biweekly: 'Tweewekelijks',
  monthly: 'Maandelijks',
  quarterly: 'Kwartaal',
  yearly: 'Jaarlijks',
}

// Bepalen of een recurring task nog "open" is op basis van laatste afvinking
function isTaskOpen(task: Task): boolean {
  if (task.frequency === 'once') return !task.completedAt
  if (!task.lastCompletedAt) return true
  const last = new Date(task.lastCompletedAt)
  const now = new Date()
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  switch (task.frequency) {
    case 'daily': return diffDays >= 1
    case 'weekly': return diffDays >= 7
    case 'biweekly': return diffDays >= 14
    case 'monthly': return diffDays >= 30
    case 'quarterly': return diffDays >= 91
    case 'yearly': return diffDays >= 365
    default: return true
  }
}

export default function OfficeTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [accessError, setAccessError] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState<string>('alle')
  const [showOnlyOpen, setShowOnlyOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Task>>({})
  const [newDraft, setNewDraft] = useState<{ category: string; title: string; frequency: string; assigneeId: string }>({
    category: 'administratie', title: '', frequency: 'weekly', assigneeId: '',
  })
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/office-tasks').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/office-tasks/assignees').then(r => r.ok ? r.json() : []),
    ])
      .then(([t, a]) => {
        setTasks(Array.isArray(t) ? t : [])
        setAssignees(Array.isArray(a) ? a : [])
      })
      .catch(err => {
        if (err === 403) setAccessError(true)
        else toast.error('Kon office tasks niet laden')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const complete = async (taskId: string) => {
    try {
      const res = await fetch('/api/office-tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      if (!res.ok) throw new Error()
      const { task } = await res.json()
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...task } : t))
    } catch {
      toast.error('Afvinken mislukt')
    }
  }

  const uncomplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/office-tasks/complete?taskId=${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...updated } : t))
    } catch {
      toast.error('Ongedaan maken mislukt')
    }
  }

  const updateTask = async (id: string, patch: Partial<Task>) => {
    try {
      const res = await fetch('/api/office-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updated } : t))
    } catch {
      toast.error('Opslaan mislukt')
    }
  }

  const addTask = async () => {
    if (!newDraft.title.trim()) return
    try {
      const assignee = assignees.find(a => a.id === newDraft.assigneeId)
      const res = await fetch('/api/office-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDraft,
          assigneeName: assignee?.name || null,
        }),
      })
      if (!res.ok) throw new Error()
      const task = await res.json()
      setTasks(ts => [...ts, { ...task, completions: [] }])
      setNewDraft({ category: 'administratie', title: '', frequency: 'weekly', assigneeId: '' })
      setShowNewForm(false)
      toast.success('Taak toegevoegd')
    } catch {
      toast.error('Toevoegen mislukt')
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('Taak verwijderen?')) return
    try {
      const res = await fetch(`/api/office-tasks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTasks(ts => ts.filter(t => t.id !== id))
      toast.success('Verwijderd')
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterAssignee !== 'alle' && t.assigneeId !== filterAssignee && filterAssignee !== 'unassigned') return false
      if (filterAssignee === 'unassigned' && t.assigneeId) return false
      if (showOnlyOpen && !isTaskOpen(t)) return false
      return true
    })
  }, [tasks, filterAssignee, showOnlyOpen])

  const byCategory = useMemo(() => {
    const m: Record<string, Task[]> = {}
    for (const t of filteredTasks) (m[t.category] ||= []).push(t)
    return m
  }, [filteredTasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const open = tasks.filter(isTaskOpen).length
    const today = tasks.filter(t => t.lastCompletedAt && new Date(t.lastCompletedAt).toDateString() === new Date().toDateString()).length
    return { total, open, today }
  }, [tasks])

  if (isLoading) {
    return <div className="max-w-6xl"><div className="card p-8 text-center text-white/50">Laden…</div></div>
  }

  if (accessError) {
    return (
      <div className="max-w-2xl">
        <div className="card p-8 text-center">
          <Icons.lock className="mx-auto text-white/30 mb-3" size={32} />
          <p className="text-white/70">Deze pagina is voor het office-team (Hanna, Bente, Lotte, Jochem) + partners.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6 fade-in">
      {/* Hero */}
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center">
              <Icons.briefcase className="text-amber-300" size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                <TextReveal>Office Tasks</TextReveal>
              </h1>
              <p className="text-sm text-white/60 mt-0.5">Verantwoordelijkheden + voortgang van het office-team</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-amber-300 tabular-nums">{stats.open}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">open</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{stats.today}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">vandaag afgerond</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white/70 tabular-nums">{stats.total}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">totaal taken</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + add */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterAssignee('alle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterAssignee === 'alle' ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            Iedereen
          </button>
          {assignees.map(a => {
            const photo = getPhotoUrl(a.name, a.avatarUrl)
            const initials = a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const active = filterAssignee === a.id
            return (
              <button
                key={a.id}
                onClick={() => setFilterAssignee(a.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  active ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px] font-semibold text-amber-200">{initials}</div>
                )}
                {a.name.split(' ')[0]}
              </button>
            )
          })}
          <button
            onClick={() => setFilterAssignee('unassigned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterAssignee === 'unassigned' ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            Zonder verantwoordelijke
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/60 ml-auto">
          <input type="checkbox" checked={showOnlyOpen} onChange={e => setShowOnlyOpen(e.target.checked)} className="accent-amber-500" />
          Alleen open
        </label>
        <button onClick={() => setShowNewForm(s => !s)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <Icons.plus size={12} /> Nieuwe taak
        </button>
      </div>

      {/* Nieuw taak form */}
      {showNewForm && (
        <div className="card p-4 space-y-3 border-amber-500/30">
          <p className="text-sm font-semibold text-white">Nieuwe taak</p>
          <input
            value={newDraft.title}
            onChange={e => setNewDraft(s => ({ ...s, title: e.target.value }))}
            placeholder="Titel"
            className="input-field"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={newDraft.category}
              onChange={e => setNewDraft(s => ({ ...s, category: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/50 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c.key} value={c.key} className="bg-slate-900">{c.label}</option>)}
            </select>
            <select
              value={newDraft.frequency}
              onChange={e => setNewDraft(s => ({ ...s, frequency: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/50 focus:outline-none"
            >
              {Object.entries(FREQUENCY_LABELS).map(([k, label]) => <option key={k} value={k} className="bg-slate-900">{label}</option>)}
            </select>
            <select
              value={newDraft.assigneeId}
              onChange={e => setNewDraft(s => ({ ...s, assigneeId: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/50 focus:outline-none"
            >
              <option value="" className="bg-slate-900">— Geen verantwoordelijke —</option>
              {assignees.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addTask} className="btn-primary text-sm py-1.5 px-3">Toevoegen</button>
            <button onClick={() => setShowNewForm(false)} className="btn-secondary text-sm py-1.5 px-3">Annuleren</button>
          </div>
        </div>
      )}

      {/* Categorieën */}
      {CATEGORIES.map(cat => {
        const items = byCategory[cat.key] || []
        if (items.length === 0) return null
        const accentBorder = {
          purple: 'border-purple-500/30', indigo: 'border-indigo-500/30',
          emerald: 'border-emerald-500/30', amber: 'border-amber-500/30',
          pink: 'border-pink-500/30', cyan: 'border-cyan-500/30',
          orange: 'border-orange-500/30', gray: 'border-white/15',
        }[cat.color]
        const accentText = {
          purple: 'text-purple-300', indigo: 'text-indigo-300',
          emerald: 'text-emerald-300', amber: 'text-amber-300',
          pink: 'text-pink-300', cyan: 'text-cyan-300',
          orange: 'text-orange-300', gray: 'text-white/50',
        }[cat.color]

        return (
          <section key={cat.key} className={`rounded-2xl border bg-white/[0.02] p-4 ${accentBorder}`}>
            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${accentText}`}>{cat.label} · {items.length}</h2>
            <div className="space-y-1.5">
              {items.map(t => {
                const open = isTaskOpen(t)
                const assigneePhoto = t.assigneeName ? getPhotoUrl(t.assigneeName) : null
                const editing = editingId === t.id
                return (
                  <div key={t.id} className={`rounded-lg border p-2.5 flex items-center gap-3 ${
                    open
                      ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      : 'border-emerald-500/15 bg-emerald-500/[0.04]'
                  }`}>
                    {/* Checkbox */}
                    <button
                      onClick={() => open ? complete(t.id) : uncomplete(t.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        open
                          ? 'border-white/30 hover:border-amber-400'
                          : 'bg-emerald-500 border-emerald-500'
                      }`}
                      title={open ? 'Afvinken' : 'Ongedaan maken'}
                    >
                      {!open && <Icons.check size={12} className="text-white" />}
                    </button>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <input
                          autoFocus
                          value={editDraft.title || ''}
                          onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                          onBlur={async () => {
                            if (editDraft.title) await updateTask(t.id, { title: editDraft.title })
                            setEditingId(null)
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              if (editDraft.title) await updateTask(t.id, { title: editDraft.title })
                              setEditingId(null)
                            }
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/50 focus:outline-none"
                        />
                      ) : (
                        <p className={`text-sm font-medium ${open ? 'text-white' : 'text-white/50 line-through'}`}>{t.title}</p>
                      )}
                      {!open && t.lastCompletedByName && (
                        <div className="mt-0.5 text-[10px] text-emerald-300">
                          ✓ door {t.lastCompletedByName.split(' ')[0]}, {new Date(t.lastCompletedAt!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>

                    {/* Frequency inline-edit */}
                    <LabelDropdown
                      value={t.frequency}
                      options={Object.entries(FREQUENCY_LABELS).map(([key, label]) => ({ key, label }))}
                      onChange={(k) => updateTask(t.id, { frequency: k })}
                    />

                    {/* Assignee — foto-dropdown */}
                    <PhotoDropdown
                      value={t.assigneeId}
                      options={assignees.map(a => ({ id: a.id, label: a.name, photoUrl: getPhotoUrl(a.name, a.avatarUrl) }))}
                      onChange={async (newId) => {
                        const a = assignees.find(x => x.id === newId)
                        await updateTask(t.id, { assigneeId: newId, assigneeName: a?.name || null })
                      }}
                      emptyOption="Niet toegewezen"
                    />

                    {/* Acties */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => { setEditingId(t.id); setEditDraft({ title: t.title }) }}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white"
                        title="Bewerken"
                      >
                        <Icons.edit size={11} />
                      </button>
                      <button
                        onClick={() => deleteTask(t.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400"
                        title="Verwijderen"
                      >
                        <Icons.trash size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {filteredTasks.length === 0 && (
        <div className="card p-8 text-center text-white/40 italic">
          {showOnlyOpen ? 'Geen open taken — alles op orde 🎉' : 'Geen taken gevonden met deze filter.'}
        </div>
      )}
    </div>
  )
}
