'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
  role: string
}

interface Assignment {
  userId: string
  user: { id: string; name: string; avatarUrl: string | null }
}

interface PartnerTask {
  id: string
  chapterId: string
  task: string
  responsibleId: string | null
  sortOrder: number
  isPublic: boolean
  assignments: Assignment[]
}

interface Chapter {
  id: string
  name: string
  sortOrder: number
  tasks: PartnerTask[]
}

export default function VerantwoordelijkPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const hasAccess = role === 'PARTNER' || role === 'ADMIN'

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null)
  const [newTaskByChapter, setNewTaskByChapter] = useState<Record<string, string>>({})
  const [newChapterName, setNewChapterName] = useState('')
  const [addingChapter, setAddingChapter] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/partner-tasks')
      if (res.ok) {
        const data = await res.json()
        setChapters(data.chapters)
        setTeam(data.teamMembers)
      }
    } catch {
      toast.error('Kon gegevens niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) fetchData()
    else setLoading(false)
  }, [hasAccess, fetchData])

  const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/partner-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('update mislukt')
      await fetchData()
    } catch {
      toast.error('Kon niet opslaan')
    }
  }

  const toggleResponsible = async (task: PartnerTask, userId: string) => {
    const current = task.assignments.map(a => a.userId)
    const next = current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId]
    await updateTask(task.id, { responsibleIds: next })
  }

  const clearResponsibles = async (task: PartnerTask) => {
    await updateTask(task.id, { responsibleIds: [] })
  }

  const togglePublic = async (task: PartnerTask) => {
    if (!task.isPublic && task.assignments.length === 0) {
      toast.error('Kies eerst iemand voor deze taak')
      return
    }
    await updateTask(task.id, { isPublic: !task.isPublic })
    toast.success(task.isPublic ? 'Niet meer zichtbaar in Wie doet Wat' : 'Gepubliceerd naar Wie doet Wat')
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Weet je zeker dat je deze taak wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/partner-tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete mislukt')
      await fetchData()
      toast.success('Taak verwijderd')
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const addTask = async (chapterId: string) => {
    const label = (newTaskByChapter[chapterId] || '').trim()
    if (!label) return
    try {
      const res = await fetch('/api/partner-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, task: label }),
      })
      if (!res.ok) throw new Error('add mislukt')
      setNewTaskByChapter(prev => ({ ...prev, [chapterId]: '' }))
      await fetchData()
    } catch {
      toast.error('Kon niet toevoegen')
    }
  }

  const addChapter = async () => {
    const name = newChapterName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/partner-task-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('add chapter mislukt')
      setNewChapterName('')
      setAddingChapter(false)
      await fetchData()
    } catch {
      toast.error('Kon hoofdstuk niet toevoegen')
    }
  }

  const deleteChapter = async (chapter: Chapter) => {
    if (!confirm(`Hele hoofdstuk "${chapter.name}" en alle ${chapter.tasks.length} taak/taken verwijderen?`)) return
    try {
      const res = await fetch(`/api/partner-task-chapters/${chapter.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete chapter mislukt')
      await fetchData()
      toast.success('Hoofdstuk verwijderd')
    } catch {
      toast.error('Kon hoofdstuk niet verwijderen')
    }
  }

  const renameChapter = async (chapter: Chapter) => {
    const newName = prompt('Nieuwe naam voor hoofdstuk:', chapter.name)?.trim()
    if (!newName || newName === chapter.name) return
    try {
      const res = await fetch(`/api/partner-task-chapters/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error('rename mislukt')
      await fetchData()
    } catch {
      toast.error('Kon naam niet wijzigen')
    }
  }

  // Per persoon: alle taken verzamelen, gegroepeerd per hoofdstuk.
  // Alleen partners + Hanna (mensen met PARTNER/ADMIN-rol, plus assignments).
  const perPerson = useMemo(() => {
    const map = new Map<string, { user: TeamMember; byChapter: Map<string, string[]>; total: number }>()
    team.forEach(m => map.set(m.id, { user: m, byChapter: new Map(), total: 0 }))
    chapters.forEach(ch => {
      ch.tasks.forEach(t => {
        t.assignments.forEach(a => {
          const entry = map.get(a.userId)
          if (!entry) return
          if (!entry.byChapter.has(ch.name)) entry.byChapter.set(ch.name, [])
          entry.byChapter.get(ch.name)!.push(t.task)
          entry.total += 1
        })
      })
    })
    // Sorteer: meeste taken eerst, daarna alfabetisch
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.user.name.localeCompare(b.user.name))
  }, [chapters, team])

  if (!session) return null
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Icons.lock size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400">Alleen toegankelijk voor partners en Hanna</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.users size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Verantwoordelijk (partner)</h1>
            <p className="text-sm text-white/40">
              Verdeel de aandachtsgebieden onder het team. Klik op{' '}
              <span className="text-workx-lime">Publiceren</span> om een taak ook in{' '}
              <a href="/dashboard/werk" className="underline hover:text-workx-lime">Wie doet Wat</a> te tonen.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Per-persoon overzicht — dynamisch obv assignments */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Overzicht per persoon</h2>
              <span className="text-xs text-gray-500">
                {perPerson.filter(p => p.total > 0).length} van {perPerson.length} teamleden hebben taken
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {perPerson.map(({ user, byChapter, total }) => {
                const photo = getPhotoUrl(user.name)
                const empty = total === 0
                return (
                  <div
                    key={user.id}
                    className={`rounded-2xl border p-4 ${
                      empty
                        ? 'bg-white/[0.02] border-dashed border-white/10'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {photo ? (
                        <img src={photo} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center text-sm font-bold text-workx-lime">
                          {user.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {user.role === 'PARTNER' ? 'Partner' : user.role === 'ADMIN' ? 'Admin' : user.role}
                          {' · '}
                          {empty ? 'nog geen taken' : `${total} ${total === 1 ? 'taak' : 'taken'}`}
                        </p>
                      </div>
                    </div>
                    {empty ? (
                      <p className="text-xs text-gray-500 italic">Nog niets toegewezen.</p>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(byChapter.entries()).map(([chapterName, tasks]) => (
                          <div key={chapterName}>
                            <p className="text-[10px] uppercase tracking-wider text-workx-lime/70 font-medium mb-1">
                              {chapterName}
                            </p>
                            <ul className="space-y-0.5">
                              {tasks.map((task, i) => (
                                <li key={i} className="text-xs text-white/80 leading-snug pl-2 border-l border-white/10">
                                  {task}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Totale overzicht — alle hoofdstukken en taken */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Alle verdelingen per hoofdstuk</h2>
            <div className="space-y-6">
          {chapters.map(chapter => (
            <div key={chapter.id} className="bg-white/[0.03] border border-white/10 rounded-2xl">
              {/* Chapter header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02] rounded-t-2xl">
                <h2 className="text-lg font-semibold text-white">{chapter.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{chapter.tasks.length} taken</span>
                  <button
                    onClick={() => renameChapter(chapter)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Naam wijzigen"
                  >
                    <Icons.edit size={14} />
                  </button>
                  <button
                    onClick={() => deleteChapter(chapter)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Hoofdstuk verwijderen"
                  >
                    <Icons.trash size={14} />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div className="divide-y divide-white/5">
                {chapter.tasks.map(task => (
                  <div key={task.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02]">
                    {/* Task label */}
                    <div className="flex-1 min-w-0">
                      {editingTaskId === task.id ? (
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onBlur={() => {
                            const v = editLabel.trim()
                            if (v && v !== task.task) updateTask(task.id, { task: v })
                            setEditingTaskId(null)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setEditingTaskId(null)
                          }}
                          autoFocus
                          className="w-full bg-white/5 border border-workx-lime/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingTaskId(task.id); setEditLabel(task.task) }}
                          className="text-sm text-white text-left hover:text-workx-lime transition-colors"
                          title="Klik om te bewerken"
                        >
                          {task.task}
                        </button>
                      )}
                    </div>

                    {/* Responsible dropdown (multi-select) */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenMenuTaskId(openMenuTaskId === task.id ? null : task.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all min-w-[180px] ${
                          task.assignments.length > 0
                            ? 'bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-dashed border-white/20'
                        }`}
                      >
                        {task.assignments.length > 0 ? (
                          <>
                            <div className="flex -space-x-1.5">
                              {task.assignments.slice(0, 3).map(a => (
                                getPhotoUrl(a.user.name) ? (
                                  <img
                                    key={a.userId}
                                    src={getPhotoUrl(a.user.name)!}
                                    alt={a.user.name}
                                    title={a.user.name}
                                    className="w-5 h-5 rounded-md object-cover ring-1 ring-workx-dark"
                                  />
                                ) : (
                                  <div
                                    key={a.userId}
                                    title={a.user.name}
                                    className="w-5 h-5 rounded-md bg-workx-lime/20 flex items-center justify-center text-[10px] font-bold ring-1 ring-workx-dark"
                                  >
                                    {a.user.name.charAt(0)}
                                  </div>
                                )
                              ))}
                            </div>
                            <span className="flex-1 text-left truncate">
                              {task.assignments.length === 1
                                ? task.assignments[0].user.name
                                : `${task.assignments[0].user.name} +${task.assignments.length - 1}`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Icons.userPlus size={12} />
                            <span className="flex-1 text-left">Kies persoon</span>
                          </>
                        )}
                        <Icons.chevronDown size={12} />
                      </button>
                      {openMenuTaskId === task.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuTaskId(null)} />
                          <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-workx-dark border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                              Klik om toe te voegen of weg te halen
                            </div>
                            {task.assignments.length > 0 && (
                              <button
                                onClick={() => clearResponsibles(task)}
                                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
                              >
                                <Icons.x size={12} />
                                Alle verantwoordelijken weghalen
                              </button>
                            )}
                            {team.map(m => {
                              const selected = task.assignments.some(a => a.userId === m.id)
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => toggleResponsible(task, m.id)}
                                  className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2 ${
                                    selected ? 'bg-workx-lime/10 text-workx-lime' : 'text-white'
                                  }`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                    selected ? 'bg-workx-lime border-workx-lime' : 'border-white/20'
                                  }`}>
                                    {selected && <Icons.check size={9} className="text-workx-dark" />}
                                  </div>
                                  {getPhotoUrl(m.name) ? (
                                    <img src={getPhotoUrl(m.name)!} alt={m.name} className="w-5 h-5 rounded-md object-cover" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                      {m.name.charAt(0)}
                                    </div>
                                  )}
                                  <span className="flex-1 truncate">{m.name}</span>
                                  {m.role === 'PARTNER' && <span className="text-[9px] text-workx-lime/60">P</span>}
                                  {m.role === 'ADMIN' && <span className="text-[9px] text-blue-400/60">A</span>}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Publish button */}
                    <button
                      onClick={() => togglePublic(task)}
                      disabled={task.assignments.length === 0 && !task.isPublic}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                        task.isPublic
                          ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                      title={task.isPublic ? 'Op Wie doet Wat — klik om weer te verbergen' : 'Publiceer naar Wie doet Wat'}
                    >
                      {task.isPublic ? <Icons.check size={12} /> : <Icons.send size={12} />}
                      {task.isPublic ? 'Gepubliceerd' : 'Publiceer'}
                    </button>

                    {/* Delete task */}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      title="Taak verwijderen"
                    >
                      <Icons.trash size={14} />
                    </button>
                  </div>
                ))}

                {/* Add task inline */}
                <div className="px-5 py-2 flex items-center gap-2">
                  <input
                    value={newTaskByChapter[chapter.id] || ''}
                    onChange={e => setNewTaskByChapter(prev => ({ ...prev, [chapter.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(chapter.id) }}
                    placeholder="Nieuwe taak toevoegen…"
                    className="flex-1 bg-transparent border-b border-white/10 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-workx-lime/50"
                  />
                  <button
                    onClick={() => addTask(chapter.id)}
                    disabled={!(newTaskByChapter[chapter.id] || '').trim()}
                    className="px-3 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium hover:bg-workx-lime/20 transition-colors disabled:opacity-40"
                  >
                    Toevoegen
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add chapter */}
          <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-2xl p-4">
            {addingChapter ? (
              <div className="flex items-center gap-2">
                <input
                  value={newChapterName}
                  onChange={e => setNewChapterName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addChapter() }}
                  placeholder="Naam van hoofdstuk"
                  autoFocus
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50"
                />
                <button
                  onClick={addChapter}
                  className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
                >
                  Toevoegen
                </button>
                <button
                  onClick={() => { setAddingChapter(false); setNewChapterName('') }}
                  className="px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingChapter(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-workx-lime transition-colors"
              >
                <Icons.plus size={14} />
                Nieuw hoofdstuk toevoegen
              </button>
            )}
          </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
