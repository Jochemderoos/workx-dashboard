'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'

interface TeamUser {
  id: string
  name: string
  role: string
}

interface Task {
  id: string
  title: string
  description: string | null
  deadline: string | null
  priority: string
  status: string
  assignedBy: string
  completedAt: string | null
  createdAt: string
  assigner: { id: string; name: string }
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; sort: number }> = {
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', sort: 0 },
  hoog: { label: 'Hoog', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', sort: 1 },
  normaal: { label: 'Normaal', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', sort: 2 },
  laag: { label: 'Laag', color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', sort: 3 },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Icons.check }> = {
  open: { label: 'Open', color: 'text-blue-400', bg: 'bg-blue-500/15', icon: Icons.circle },
  bezig: { label: 'Bezig', color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Icons.clock },
  klaar: { label: 'Klaar', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: Icons.check },
}

export default function WerkstudentPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' })

  const fetchTasks = useCallback(async () => {
    try {
      const [taskRes, teamRes] = await Promise.all([
        fetch('/api/werkstudent'),
        fetch('/api/claude/users'),
      ])
      if (taskRes.ok) setTasks(await taskRes.json())
      if (teamRes.ok) {
        const users = await teamRes.json()
        setTeamUsers(users.filter((u: TeamUser) => u.role !== 'EXTERNAL'))
      }
    } catch {
      toast.error('Kon opdrachten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    try {
      const payload = { ...form, deadline: form.deadline || null, assignerId: form.assignerId || undefined }
      if (editingTask) {
        const res = await fetch('/api/werkstudent', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTask.id, ...payload }),
        })
        if (!res.ok) throw new Error()
        toast.success('Opdracht bijgewerkt')
      } else {
        const res = await fetch('/api/werkstudent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success('Opdracht aangemaakt')
      }
      setForm({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' })
      setShowForm(false)
      setEditingTask(null)
      fetchTasks()
    } catch {
      toast.error('Kon opdracht niet opslaan')
    }
  }

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'open' ? 'bezig' : task.status === 'bezig' ? 'klaar' : 'open'
    try {
      await fetch('/api/werkstudent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      })
      fetchTasks()
      if (nextStatus === 'klaar') toast.success('Opdracht afgerond!')
    } catch {
      toast.error('Kon status niet bijwerken')
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze opdracht wilt verwijderen?')) return
    try {
      await fetch(`/api/werkstudent?id=${id}`, { method: 'DELETE' })
      toast.success('Opdracht verwijderd')
      fetchTasks()
    } catch {
      toast.error('Kon opdracht niet verwijderen')
    }
  }

  const startEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
      priority: task.priority,
      assignerId: task.assignedBy,
    })
    setShowForm(true)
  }

  const activeTasks = tasks.filter(t => t.status !== 'klaar')
  const completedTasks = tasks.filter(t => t.status === 'klaar')

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  }

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: '#f9ff85' }} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Werkstudent
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Opdrachten en taken voor de werkstudent
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingTask(null); setForm({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' }) }}
          className="btn-primary flex items-center gap-2"
        >
          <Icons.plus size={16} />
          Nieuwe opdracht
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal', value: tasks.length, color: 'text-blue-400', bg: 'from-blue-500/10 to-cyan-500/10' },
          { label: 'Open', value: activeTasks.filter(t => t.status === 'open').length, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5' },
          { label: 'Bezig', value: activeTasks.filter(t => t.status === 'bezig').length, color: 'text-amber-400', bg: 'from-amber-500/10 to-orange-500/5' },
          { label: 'Afgerond', value: completedTasks.length, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-green-500/5' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingTask(null) }}>
          <div className="card p-6 w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {editingTask ? 'Opdracht bewerken' : 'Nieuwe opdracht'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="input-field"
                  placeholder="Bijv. CAO inventarisatie"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Beschrijving</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Wat moet er precies gebeuren?"
                />
              </div>
              {/* Opdrachtgever */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Opdrachtgever</label>
                <div className="flex flex-wrap gap-2">
                  {teamUsers.map(u => {
                    const photo = getPhotoUrl(u.name)
                    const isSelected = form.assignerId === u.id
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, assignerId: u.id }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          isSelected
                            ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30'
                            : 'border-transparent'
                        }`}
                        style={{
                          background: isSelected ? undefined : 'var(--color-bg-tertiary)',
                          color: isSelected ? undefined : 'var(--color-text-tertiary)',
                        }}
                      >
                        {photo ? (
                          <Image src={photo} alt={u.name} width={20} height={20} className="w-5 h-5 rounded-lg object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-[9px] font-medium text-white">{u.name.charAt(0)}</span>
                          </div>
                        )}
                        {u.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Leeg = jijzelf als opdrachtgever</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="input-field !rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Prioriteit</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="input-field"
                  >
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingTask ? 'Opslaan' : 'Toevoegen'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingTask(null) }} className="btn-secondary flex-1">
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.clipboard className="text-cyan-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Nog geen opdrachten
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Klik op &quot;Nieuwe opdracht&quot; om een taak voor de werkstudent aan te maken.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeTasks
            .sort((a, b) => (PRIORITY_CONFIG[a.priority]?.sort ?? 2) - (PRIORITY_CONFIG[b.priority]?.sort ?? 2))
            .map(task => {
              const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normaal
              const stat = STATUS_CONFIG[task.status] || STATUS_CONFIG.open
              const StatusIcon = stat.icon
              const overdue = task.status !== 'klaar' && isOverdue(task.deadline)

              return (
                <div key={task.id} className="card group hover:scale-[1.005] transition-all duration-200">
                  <div className="flex items-start gap-4 p-4 sm:p-5">
                    {/* Status toggle */}
                    <button
                      onClick={() => toggleStatus(task)}
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${stat.bg} hover:scale-110`}
                      title={`Status: ${stat.label} → klik om te wijzigen`}
                    >
                      <StatusIcon size={14} className={stat.color} />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${task.status === 'klaar' ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${pri.bg} ${pri.color} ${pri.border}`}>
                          {pri.label}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {(() => {
                          const photo = getPhotoUrl(task.assigner.name)
                          return (
                            <span className="flex items-center gap-1.5">
                              {photo ? (
                                <Image src={photo} alt={task.assigner.name} width={20} height={20} className="w-5 h-5 rounded-lg object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-[9px] font-medium text-white">{task.assigner.name.charAt(0)}</span>
                                </div>
                              )}
                              <span style={{ color: 'var(--color-text-secondary)' }}>{task.assigner.name.split(' ')[0]}</span>
                            </span>
                          )
                        })()}
                        {task.deadline && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${overdue ? 'bg-red-500/10 text-red-400 font-medium' : ''}`} style={!overdue ? { background: 'var(--color-bg-tertiary)' } : undefined}>
                            <Icons.calendar size={12} />
                            {formatDate(task.deadline)}
                            {overdue && ' (verlopen)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => startEdit(task)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        title="Bewerken"
                      >
                        <Icons.edit size={15} />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors"
                        title="Verwijderen"
                      >
                        <Icons.trash size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm font-medium mb-3 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Icons.chevronRight
              size={14}
              className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}
            />
            Afgerond ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-60">
              {completedTasks.map(task => {
                const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normaal
                return (
                  <div key={task.id} className="card group">
                    <div className="flex items-start gap-4 p-4">
                      <button
                        onClick={() => toggleStatus(task)}
                        className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15 hover:scale-110 transition-all"
                        title="Heropenen"
                      >
                        <Icons.check size={14} className="text-emerald-400" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-through" style={{ color: 'var(--color-text-tertiary)' }}>
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {(() => {
                            const photo = getPhotoUrl(task.assigner.name)
                            return (
                              <span className="flex items-center gap-1.5">
                                {photo ? (
                                  <Image src={photo} alt={task.assigner.name} width={18} height={18} className="w-[18px] h-[18px] rounded object-cover" />
                                ) : (
                                  <Icons.user size={12} />
                                )}
                                {task.assigner.name.split(' ')[0]}
                              </span>
                            )
                          })()}
                          {task.completedAt && (
                            <span className="flex items-center gap-1">
                              <Icons.check size={12} />
                              {formatDate(task.completedAt)}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${pri.bg} ${pri.color}`}>
                            {pri.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => deleteTask(task.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors">
                          <Icons.trash size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
