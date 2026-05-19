'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  sortOrder: number
  createdAt: string
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    // Optimistic
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      title,
      description: null,
      dueDate: null,
      sortOrder: tasks.length,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, optimistic])
    try {
      const res = await fetch('/api/personal-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
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
    // Optimistic verwijder uit lijst
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await fetch(`/api/personal-tasks/${id}`, { method: 'DELETE' })
    } catch {
      toast.error('Kon taak niet afvinken')
      fetchTasks()
    } finally {
      completingRef.current.delete(id)
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('Deze taak verwijderen?')) return
    completeTask(id)
  }

  // Group tasks by bucket
  const grouped = useMemo(() => {
    const g: Record<BucketKey, Task[]> = {
      overdue: [], today: [], tomorrow: [], upcoming: [], undated: [],
    }
    for (const t of tasks) g[bucketOf(t)].push(t)
    for (const k of Object.keys(g) as BucketKey[]) {
      g[k].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return g
  }, [tasks])

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
            placeholder="Nieuwe taak — typ en druk Enter"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {newTitle.trim() && (
            <button
              onClick={addTask}
              className="px-3 py-1 rounded-lg bg-workx-lime text-workx-dark text-xs font-medium hover:bg-workx-lime/90 transition-colors"
            >
              Toevoegen
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
                        draggable={!isExpanded}
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
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : task.id)}
                              className="text-left text-sm text-white hover:text-workx-lime transition-colors block w-full truncate"
                              title="Klik om uit te klappen"
                            >
                              {task.title}
                            </button>
                            {!isExpanded && task.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
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

                          {/* Hover actions */}
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
      )}
    </div>
  )
}
