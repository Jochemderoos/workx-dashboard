'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { parseTaskDate } from '@/lib/parse-task-date'

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  sortOrder: number
  createdAt: string
  source?: 'personal' | 'meeting'
  meetingActionId?: string
  meetingWeekId?: string
  meetingMonthId?: string
  meetingDateLabel?: string
}

type BucketKey = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'undated'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function bucketOf(task: Task): BucketKey {
  if (!task.dueDate) return 'undated'
  const due = startOfDay(new Date(task.dueDate))
  const today = startOfDay(new Date())
  const diff = (due.getTime() - today.getTime()) / 86400000
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return 'upcoming'
}

function formatDateBadge(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = startOfDay(new Date())
  const due = startOfDay(d)
  const diff = (due.getTime() - today.getTime()) / 86400000
  if (diff === 0) return 'vandaag'
  if (diff === 1) return 'morgen'
  if (diff === -1) return 'gisteren'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function toIsoDate(d: Date | null) {
  if (!d) return null
  return startOfDay(d).toISOString()
}

const BUCKETS: { key: BucketKey; label: string; accent: string; bg: string }[] = [
  { key: 'overdue', label: 'Verlopen', accent: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { key: 'today', label: 'Vandaag', accent: 'text-workx-lime', bg: 'bg-workx-lime/5 border-workx-lime/20' },
  { key: 'tomorrow', label: 'Morgen', accent: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/20' },
  { key: 'upcoming', label: 'Komend', accent: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/20' },
  { key: 'undated', label: 'Geen datum', accent: 'text-gray-400', bg: 'bg-white/[0.02] border-white/10' },
]

export default function EigenTakenPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterDateKey, setFilterDateKey] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const completingRef = useRef<Set<string>>(new Set())

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/personal-tasks')
      if (res.ok) setTasks(await res.json())
    } catch {
      toast.error('Kon taken niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Live parse: detecteer datum in de titel-tekst voor preview
  const parsedNew = useMemo(() => parseTaskDate(newTitle), [newTitle])
  // Handmatige keuze heeft voorrang op auto-detect
  const effectiveNewDueDate = newDueDate || parsedNew.dueDate

  const addTask = async () => {
    const raw = newTitle.trim()
    if (!raw) return
    const parsed = parseTaskDate(raw)
    const title = parsed.title
    const dueDate = newDueDate || parsed.dueDate
    setNewTitle('')
    setNewDueDate(null)
    // Optimistic
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      title,
      description: null,
      dueDate: dueDate ? dueDate.toISOString() : null,
      sortOrder: tasks.length,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, optimistic])
    try {
      const res = await fetch('/api/personal-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueDate: dueDate ? dueDate.toISOString() : null }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setTasks(prev => prev.map(t => t.id === optimistic.id ? saved : t))
    } catch {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id))
      toast.error('Kon taak niet toevoegen')
    }
  }

  const patchTask = async (id: string, patch: Partial<{ title: string; description: string | null; dueDate: string | null }>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } as Task : t))
    try {
      await fetch(`/api/personal-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch {
      toast.error('Kon niet opslaan')
      fetchTasks()
    }
  }

  const completeTask = async (id: string) => {
    if (completingRef.current.has(id)) return
    completingRef.current.add(id)
    const task = tasks.find(t => t.id === id)
    // Optimistic verwijder uit lijst
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      if (task?.source === 'meeting' && task.meetingMonthId && task.meetingWeekId && task.meetingActionId) {
        // Notulen-actiepunt afvinken via notulen-API (isCompleted=true)
        await fetch(
          `/api/notulen/${task.meetingMonthId}/weeks/${task.meetingWeekId}/actions/${task.meetingActionId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCompleted: true }),
          }
        )
      } else {
        await fetch(`/api/personal-tasks/${id}`, { method: 'DELETE' })
      }
    } catch {
      toast.error('Kon taak niet afvinken')
      fetchTasks()
    } finally {
      completingRef.current.delete(id)
    }
  }

  const deleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task?.source === 'meeting') {
      toast('Notulen-taken verwijder je in het partneroverleg zelf', { icon: 'ℹ️' })
      return
    }
    if (!confirm('Deze taak verwijderen?')) return
    completeTask(id)
  }

  // Group tasks by bucket
  const grouped = useMemo(() => {
    const g: Record<BucketKey, Task[]> = {
      overdue: [], today: [], tomorrow: [], upcoming: [], undated: [],
    }
    const source = filterDateKey
      ? tasks.filter(t => {
          if (!t.dueDate) return false
          const d = startOfDay(new Date(t.dueDate))
          return d.toISOString().slice(0, 10) === filterDateKey
        })
      : tasks
    for (const t of source) g[bucketOf(t)].push(t)
    for (const k of Object.keys(g) as BucketKey[]) {
      g[k].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return g
  }, [tasks, filterDateKey])

  // Week-overzicht: huidige week (ma t/m zo) met taken per dag
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date())
    const dayIdx = today.getDay() // 0=zondag, 1=maandag…
    const offset = dayIdx === 0 ? -6 : 1 - dayIdx
    const monday = new Date(today); monday.setDate(monday.getDate() + offset)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i); return d
    })
  }, [])

  const tasksByDayKey = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const d of weekDays) map[d.toISOString().slice(0, 10)] = []
    for (const t of tasks) {
      if (!t.dueDate) continue
      const key = startOfDay(new Date(t.dueDate)).toISOString().slice(0, 10)
      if (map[key]) map[key].push(t)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [tasks, weekDays])

  // Drag handlers (binnen dezelfde bucket)
  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    if (!draggedId || draggedId === taskId) return
    const dragged = tasks.find(t => t.id === draggedId)
    const target = tasks.find(t => t.id === taskId)
    if (!dragged || !target) return
    if (bucketOf(dragged) !== bucketOf(target)) return
    e.preventDefault()
    setDropTargetId(taskId)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDropTargetId(null)
    if (!draggedId || draggedId === targetId) return
    const dragged = tasks.find(t => t.id === draggedId)
    const target = tasks.find(t => t.id === targetId)
    if (!dragged || !target) return
    const bucket = bucketOf(dragged)
    if (bucket !== bucketOf(target)) return

    // Reorder binnen bucket
    const bucketTasks = grouped[bucket]
    const fromIdx = bucketTasks.findIndex(t => t.id === draggedId)
    const toIdx = bucketTasks.findIndex(t => t.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...bucketTasks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // Update sortOrder optimistic
    const newOrders = new Map<string, number>()
    reordered.forEach((t, i) => newOrders.set(t.id, i * 10))
    setTasks(prev => prev.map(t => newOrders.has(t.id) ? { ...t, sortOrder: newOrders.get(t.id)! } : t))

    // Verstuur volledige bucket-volgorde
    try {
      await fetch('/api/personal-tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(t => t.id) }),
      })
    } catch {
      toast.error('Kon volgorde niet opslaan')
      fetchTasks()
    }
  }

  if (!session) return null

  return (
    <div className="min-h-screen relative max-w-3xl">
      <div className="absolute top-0 right-[-5%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.check size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Eigen taken</h1>
            <p className="text-sm text-white/40">Persoonlijk — alleen jij ziet dit</p>
          </div>
        </div>
      </div>

      {/* Add row (Notion-stijl) */}
      <div className="mb-6">
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 focus-within:border-workx-lime/50 transition-colors">
          <Icons.plus size={16} className="text-gray-500 shrink-0" />
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask() }}
            placeholder='Nieuwe taak — typ bv. "morgen Jochem mailen" en druk Enter'
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none min-w-0"
          />
          {newTitle.trim() && (
            <button
              onClick={addTask}
              className="px-3 py-1 rounded-lg bg-workx-lime text-workx-dark text-xs font-medium hover:bg-workx-lime/90 transition-colors shrink-0"
            >
              Toevoegen
            </button>
          )}
        </div>

        {/* Datum-chips + datumkiezer */}
        <div className="flex items-center gap-2 mt-2 flex-wrap pl-1">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-1">Datum</span>
          <button
            onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setNewDueDate(d) }}
            className="text-[11px] px-2.5 py-1 rounded-full border bg-white/5 text-gray-400 border-white/10 hover:text-workx-lime hover:border-workx-lime/40 transition-colors"
          >
            Vandaag
          </button>
          <button
            onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); setNewDueDate(d) }}
            className="text-[11px] px-2.5 py-1 rounded-full border bg-white/5 text-gray-400 border-white/10 hover:text-blue-300 hover:border-blue-500/40 transition-colors"
          >
            Morgen
          </button>
          <div className="inline-block">
            <DatePicker
              selected={newDueDate}
              onChange={(date) => setNewDueDate(date as Date | null)}
              placeholder="Kies datum"
              isClearable
            />
          </div>
          {effectiveNewDueDate && (
            <span className={`text-[11px] flex items-center gap-1 ${newDueDate ? 'text-workx-lime' : 'text-workx-lime/70'}`}>
              <Icons.check size={10} />
              {newDueDate ? 'gekozen: ' : 'herkend: '}
              {(() => {
                const today = new Date(); today.setHours(0, 0, 0, 0)
                const d = new Date(effectiveNewDueDate); d.setHours(0, 0, 0, 0)
                const diff = (d.getTime() - today.getTime()) / 86400000
                if (diff === 0) return 'vandaag'
                if (diff === 1) return 'morgen'
                if (diff === -1) return 'gisteren'
                return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
              })()}
            </span>
          )}
          {newDueDate && (
            <button
              onClick={() => setNewDueDate(null)}
              className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
            >
              Datum weghalen
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl py-16 text-center">
          <Icons.check size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">Nog geen taken. Voeg er hierboven een toe.</p>
        </div>
      ) : (
        <>
        {/* Week-overzicht */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Deze week</h2>
            {filterDateKey && (
              <button
                onClick={() => setFilterDateKey(null)}
                className="text-[10px] text-workx-lime hover:underline flex items-center gap-1"
              >
                <Icons.x size={10} /> Filter weghalen
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
            {weekDays.map(d => {
              const key = d.toISOString().slice(0, 10)
              const dayTasks = tasksByDayKey[key]
              const today = startOfDay(new Date())
              const isToday = d.getTime() === today.getTime()
              const isPast = d.getTime() < today.getTime()
              const isFiltered = filterDateKey === key
              const dayName = d.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '')
              return (
                <button
                  key={key}
                  onClick={() => setFilterDateKey(isFiltered ? null : key)}
                  className={`text-left rounded-xl p-2 border min-h-[100px] transition-all min-w-0 ${
                    isFiltered
                      ? 'bg-workx-lime/15 border-workx-lime/50 ring-1 ring-workx-lime/40'
                      : isToday
                        ? 'bg-workx-lime/5 border-workx-lime/30 hover:bg-workx-lime/10'
                        : isPast
                          ? 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                  }`}
                  title={d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-workx-lime' : 'text-gray-500'}`}>{dayName}</span>
                    <span className={`text-sm font-bold ${isToday ? 'text-workx-lime' : isPast ? 'text-gray-600' : 'text-white'}`}>{d.getDate()}</span>
                  </div>
                  {dayTasks.length === 0 ? (
                    <p className="text-[10px] text-gray-600 italic">—</p>
                  ) : (
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <p key={t.id} className={`text-[10px] truncate ${isPast ? 'text-gray-500 line-through' : 'text-white/70'}`}>
                          {t.title}
                        </p>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="text-[10px] text-gray-500">+{dayTasks.length - 3} meer</p>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          {BUCKETS.map(b => {
            const items = grouped[b.key]
            if (items.length === 0) return null
            return (
              <div key={b.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${b.accent}`}>{b.label}</span>
                  <span className="text-xs text-gray-600">{items.length}</span>
                </div>
                <div className={`rounded-xl border ${b.bg}`}>
                  {items.map(task => {
                    const isExpanded = expandedId === task.id
                    const isDragging = draggedId === task.id
                    const isDropTarget = dropTargetId === task.id
                    return (
                      <div
                        key={task.id}
                        draggable={!isExpanded && task.source !== 'meeting'}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', task.id)
                          setDraggedId(task.id)
                        }}
                        onDragEnd={() => { setDraggedId(null); setDropTargetId(null) }}
                        onDragOver={(e) => handleDragOver(e, task.id)}
                        onDragLeave={() => setDropTargetId(null)}
                        onDrop={(e) => handleDrop(e, task.id)}
                        className={`group relative border-b last:border-b-0 border-white/5 ${
                          isDragging ? 'opacity-30' : ''
                        } ${isDropTarget ? 'bg-workx-lime/10' : 'hover:bg-white/[0.02]'} transition-colors`}
                      >
                        <div className="flex items-start gap-2 px-3 py-2.5">
                          {/* Drag handle */}
                          <div
                            className="text-gray-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing pt-1 select-none"
                            title="Sleep om te verplaatsen"
                          >
                            <Icons.menu size={12} />
                          </div>

                          {/* Checkbox = afvinken (verwijdert) */}
                          <button
                            onClick={() => completeTask(task.id)}
                            className="mt-0.5 w-5 h-5 rounded-md border border-white/20 hover:border-workx-lime hover:bg-workx-lime/10 flex items-center justify-center transition-all shrink-0 group/cb"
                            title="Klaar — verwijder taak"
                          >
                            <Icons.check size={11} className="text-transparent group-hover/cb:text-workx-lime transition-colors" />
                          </button>

                          {/* Titel + expand */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => task.source === 'meeting' ? undefined : setExpandedId(isExpanded ? null : task.id)}
                                className={`text-left text-sm text-white transition-colors truncate flex-1 ${task.source === 'meeting' ? 'cursor-default' : 'hover:text-workx-lime cursor-pointer'}`}
                                title={task.source === 'meeting' ? 'Notulen-actiepunt — wordt afgevinkt in partneroverleg of hier' : 'Klik om uit te klappen'}
                              >
                                {task.title}
                              </button>
                              {task.source === 'meeting' && (
                                <a
                                  href={`/dashboard/partners/notulen?month=${task.meetingMonthId}&week=${task.meetingWeekId}`}
                                  className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 transition-colors flex-shrink-0 font-medium"
                                  title={`Uit partneroverleg ${task.meetingDateLabel}`}
                                >
                                  notulen
                                </a>
                              )}
                            </div>
                            {!isExpanded && task.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                            )}
                            {task.source === 'meeting' && task.meetingDateLabel && (
                              <p className="text-[10px] text-gray-500 mt-0.5">{task.meetingDateLabel}</p>
                            )}
                          </div>

                          {/* Date badge */}
                          {task.dueDate && !isExpanded && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${
                              bucketOf(task) === 'overdue' ? 'bg-red-500/15 text-red-400' :
                              bucketOf(task) === 'today' ? 'bg-workx-lime/15 text-workx-lime' :
                              bucketOf(task) === 'tomorrow' ? 'bg-blue-500/15 text-blue-400' :
                              'bg-white/10 text-gray-400'
                            }`}>
                              {formatDateBadge(task.dueDate)}
                            </span>
                          )}

                          {/* Hover actions — alleen voor eigen taken */}
                          {task.source !== 'meeting' && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                                title={isExpanded ? 'Inklappen' : 'Uitklappen'}
                              >
                                {isExpanded ? <Icons.chevronDown size={14} /> : <Icons.edit size={12} />}
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Verwijderen"
                              >
                                <Icons.trash size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded edit panel */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pl-12 space-y-2 border-t border-white/5 pt-2">
                            <input
                              value={task.title}
                              onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))}
                              onBlur={(e) => patchTask(task.id, { title: e.target.value.trim() || task.title })}
                              placeholder="Titel"
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/50"
                            />
                            <textarea
                              value={task.description || ''}
                              onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, description: e.target.value } : t))}
                              onBlur={(e) => patchTask(task.id, { description: e.target.value })}
                              placeholder="Voeg meer details toe…"
                              rows={3}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-workx-lime/50 resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <Icons.calendar size={12} className="text-gray-500" />
                              <DatePicker
                                selected={task.dueDate ? new Date(task.dueDate) : null}
                                onChange={(date) => patchTask(task.id, { dueDate: toIsoDate(date as Date | null) })}
                                placeholder="Datum kiezen"
                                isClearable
                              />
                              {task.dueDate && (
                                <button
                                  onClick={() => patchTask(task.id, { dueDate: null })}
                                  className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                >
                                  Datum weghalen
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
