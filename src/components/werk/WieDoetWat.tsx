'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
}

interface Responsibility {
  id: string
  task: string
  sortOrder: number
  responsible: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

interface WieDoetWatProps {
  canEdit: boolean
}

export default function WieDoetWat({ canEdit }: WieDoetWatProps) {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [newTask, setNewTask] = useState('')
  const [newResponsibleId, setNewResponsibleId] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState('')
  const [editResponsibleId, setEditResponsibleId] = useState('')
  const [showEditDropdown, setShowEditDropdown] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [respRes, teamRes] = await Promise.all([
        fetch('/api/responsibilities'),
        fetch('/api/team'),
      ])
      if (respRes.ok) setResponsibilities(await respRes.json())
      if (teamRes.ok) {
        const data = await teamRes.json()
        const members = (Array.isArray(data) ? data : data.users || [])
          .filter((u: any) => u.isActive !== false)
          .map((u: any) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))
          .sort((a: TeamMember, b: TeamMember) => a.name.localeCompare(b.name))
        setTeamMembers(members)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newTask.trim() || !newResponsibleId) {
      toast.error('Vul een taak in en kies een verantwoordelijke')
      return
    }

    try {
      const res = await fetch('/api/responsibilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: newTask.trim(), responsibleId: newResponsibleId }),
      })
      if (res.ok) {
        const newResp = await res.json()
        setResponsibilities(prev => [...prev, newResp])
        setNewTask('')
        setNewResponsibleId('')
        toast.success('Verantwoordelijkheid toegevoegd')
      } else {
        toast.error('Kon niet toevoegen')
      }
    } catch {
      toast.error('Er ging iets mis')
    }
  }

  const handleEdit = async (id: string) => {
    if (!editTask.trim() || !editResponsibleId) return

    try {
      const res = await fetch('/api/responsibilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, task: editTask.trim(), responsibleId: editResponsibleId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setResponsibilities(prev => prev.map(r => r.id === id ? updated : r))
        setEditingId(null)
        toast.success('Bijgewerkt')
      }
    } catch {
      toast.error('Er ging iets mis')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/responsibilities?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setResponsibilities(prev => prev.filter(r => r.id !== deleteId))
        toast.success('Verwijderd')
      }
    } catch {
      toast.error('Er ging iets mis')
    } finally {
      setShowDeleteConfirm(false)
      setDeleteId(null)
    }
  }

  const startEdit = (r: Responsibility) => {
    setEditingId(r.id)
    setEditTask(r.task)
    setEditResponsibleId(r.responsible.id)
  }

  const selectedMember = teamMembers.find(m => m.id === newResponsibleId)
  const editSelectedMember = teamMembers.find(m => m.id === editResponsibleId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-workx-lime/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Wie doet Wat</h2>
              <p className="text-sm text-gray-400">Overzicht van verantwoordelijkheden binnen het team</p>
            </div>
          </div>
        </div>
      </div>

      {/* Responsibilities list */}
      <div className="space-y-3">
        {responsibilities.length === 0 && !canEdit && (
          <div className="card p-12 text-center">
            <span className="text-4xl mb-4 block">📋</span>
            <p className="text-gray-400">Nog geen verantwoordelijkheden toegevoegd</p>
          </div>
        )}

        {responsibilities.map((r) => (
          <div
            key={r.id}
            className="group card relative overflow-hidden transition-all hover:border-white/20"
          >
            {/* Subtle glow behind avatar */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-workx-lime/5 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

            {editingId === r.id ? (
              /* Edit mode */
              <div className="relative p-4 sm:p-5 space-y-3">
                <input
                  type="text"
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50 focus:ring-1 focus:ring-workx-lime/30"
                  placeholder="Verantwoordelijkheid..."
                />
                <div className="relative">
                  <button
                    onClick={() => setShowEditDropdown(!showEditDropdown)}
                    className="w-full flex items-center gap-3 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-left hover:border-white/30 transition-colors"
                  >
                    {editSelectedMember ? (
                      <>
                        {getPhotoUrl(editSelectedMember.name, editSelectedMember.avatarUrl) ? (
                          <img src={getPhotoUrl(editSelectedMember.name, editSelectedMember.avatarUrl)!} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-bold text-workx-lime">{editSelectedMember.name.charAt(0)}</div>
                        )}
                        <span className="text-white">{editSelectedMember.name}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">Kies verantwoordelijke...</span>
                    )}
                    <Icons.chevronDown size={14} className="ml-auto text-gray-400" />
                  </button>
                  {showEditDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-workx-dark border border-white/20 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {teamMembers.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setEditResponsibleId(m.id); setShowEditDropdown(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
                        >
                          {getPhotoUrl(m.name, m.avatarUrl) ? (
                            <img src={getPhotoUrl(m.name, m.avatarUrl)!} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-bold text-workx-lime">{m.name.charAt(0)}</div>
                          )}
                          <span className="text-white text-sm">{m.name}</span>
                          {m.id === editResponsibleId && <Icons.check size={14} className="ml-auto text-workx-lime" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(r.id)} className="btn-primary text-sm px-4 py-2">Opslaan</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-sm px-4 py-2">Annuleren</button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="relative p-4 sm:p-5 flex items-center gap-4">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {getPhotoUrl(r.responsible.name, r.responsible.avatarUrl) ? (
                    <img
                      src={getPhotoUrl(r.responsible.name, r.responsible.avatarUrl)!}
                      alt={r.responsible.name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-2 ring-white/10 group-hover:ring-workx-lime/30 transition-all shadow-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-workx-lime/30 transition-all">
                      <span className="text-lg font-bold text-workx-lime">{r.responsible.name.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-base sm:text-lg leading-tight">{r.task}</p>
                  <p className="text-sm text-workx-lime/80 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-workx-lime/60" />
                    {r.responsible.name}
                  </p>
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => startEdit(r)}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Bewerken"
                    >
                      <Icons.edit size={16} />
                    </button>
                    <button
                      onClick={() => { setDeleteId(r.id); setShowDeleteConfirm(true) }}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      title="Verwijderen"
                    >
                      <Icons.trash size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new responsibility - only for PARTNER/ADMIN */}
      {canEdit && (
        <div className="card p-5 sm:p-6 border-dashed border-white/20">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <Icons.plus size={14} />
            Nieuwe verantwoordelijkheid
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTask && newResponsibleId) handleAdd() }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50 focus:ring-1 focus:ring-workx-lime/30 transition-colors"
              placeholder="Beschrijf de taak of verantwoordelijkheid..."
            />

            {/* Team member dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left hover:border-white/20 transition-colors"
              >
                {selectedMember ? (
                  <>
                    {getPhotoUrl(selectedMember.name, selectedMember.avatarUrl) ? (
                      <img src={getPhotoUrl(selectedMember.name, selectedMember.avatarUrl)!} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-workx-lime/30" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-workx-lime/20 flex items-center justify-center text-sm font-bold text-workx-lime">{selectedMember.name.charAt(0)}</div>
                    )}
                    <span className="text-white font-medium">{selectedMember.name}</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <Icons.users size={14} className="text-gray-500" />
                    </div>
                    <span className="text-gray-500">Kies een verantwoordelijke...</span>
                  </>
                )}
                <Icons.chevronDown size={16} className="ml-auto text-gray-400" />
              </button>

              {showDropdown && (
                <div className="absolute z-50 mt-2 w-full bg-workx-dark/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl shadow-black/50 max-h-72 overflow-y-auto">
                  {teamMembers.map(m => {
                    const photoUrl = getPhotoUrl(m.name, m.avatarUrl)
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setNewResponsibleId(m.id); setShowDropdown(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-workx-lime/20 flex items-center justify-center text-sm font-bold text-workx-lime">{m.name.charAt(0)}</div>
                        )}
                        <span className="text-white text-sm font-medium">{m.name}</span>
                        {m.id === newResponsibleId && <Icons.check size={14} className="ml-auto text-workx-lime" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleAdd}
              disabled={!newTask.trim() || !newResponsibleId}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icons.plus size={16} />
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteId(null) }}
        onConfirm={handleDelete}
        title="Verwijderen"
        message="Weet je zeker dat je deze verantwoordelijkheid wilt verwijderen?"
        confirmText="Verwijderen"
        type="danger"
      />
    </div>
  )
}
