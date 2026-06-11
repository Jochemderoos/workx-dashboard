'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DatePicker from '@/components/ui/DatePicker'

interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
}

interface Executor {
  id: string
  user: { id: string; name: string; avatarUrl: string | null }
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
  partnerTask?: {
    id: string
    chapter: { id: string; name: string; sortOrder: number }
    executors: Executor[]
  } | null
}

interface NewsletterAssignment {
  id: string
  assigneeId: string
  deadline: string
  topic: string | null
  status: string
  assignee: {
    id: string
    name: string
    avatarUrl: string | null
  }
  createdBy: {
    id: string
    name: string
  }
}

interface WieDoetWatProps {
  canEdit: boolean
  currentUserId?: string
}

export default function WieDoetWat({ canEdit, currentUserId }: WieDoetWatProps) {
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

  // Newsletter assignment state
  const [newsletterAssignments, setNewsletterAssignments] = useState<NewsletterAssignment[]>([])
  const [nlAssigneeId, setNlAssigneeId] = useState('')
  const [nlDeadline, setNlDeadline] = useState('')
  const [nlTopic, setNlTopic] = useState('')
  const [showNlDropdown, setShowNlDropdown] = useState(false)
  const [nlDeleteId, setNlDeleteId] = useState<string | null>(null)
  const [showNlDeleteConfirm, setShowNlDeleteConfirm] = useState(false)
  const [nlExpanded, setNlExpanded] = useState(false)

  // Welke chapter-kaders open zijn (default: alle open). Ingeklapt = compacte titel.
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [respRes, nlRes] = await Promise.all([
        fetch('/api/responsibilities'),
        fetch('/api/newsletter-assignments'),
      ])
      if (respRes.ok) {
        const data = await respRes.json()
        setResponsibilities(data.responsibilities || [])
        setTeamMembers(
          (data.teamMembers || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            avatarUrl: u.avatarUrl,
          }))
        )
      }
      if (nlRes.ok) {
        const nlData = await nlRes.json()
        setNewsletterAssignments(nlData || [])
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

    const member = teamMembers.find(m => m.id === newResponsibleId)
    const tempId = `temp-${Date.now()}`
    const optimistic: Responsibility = {
      id: tempId,
      task: newTask.trim(),
      sortOrder: responsibilities.length,
      responsible: { id: newResponsibleId, name: member?.name || '', avatarUrl: member?.avatarUrl || null },
    }

    // Optimistic update
    setResponsibilities(prev => [...prev, optimistic])
    const savedTask = newTask.trim()
    const savedResponsibleId = newResponsibleId
    setNewTask('')
    setNewResponsibleId('')

    try {
      const res = await fetch('/api/responsibilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: savedTask, responsibleId: savedResponsibleId }),
      })
      if (res.ok) {
        const newResp = await res.json()
        setResponsibilities(prev => prev.map(r => r.id === tempId ? newResp : r))
        toast.success('Verantwoordelijkheid toegevoegd')
      } else {
        setResponsibilities(prev => prev.filter(r => r.id !== tempId))
        toast.error('Kon niet toevoegen')
      }
    } catch {
      setResponsibilities(prev => prev.filter(r => r.id !== tempId))
      toast.error('Er ging iets mis')
    }
  }

  const handleEdit = async (id: string) => {
    if (!editTask.trim() || !editResponsibleId) return

    const member = teamMembers.find(m => m.id === editResponsibleId)
    const previous = responsibilities.find(r => r.id === id)

    // Optimistic update
    setResponsibilities(prev => prev.map(r => r.id === id ? {
      ...r,
      task: editTask.trim(),
      responsible: { id: editResponsibleId, name: member?.name || '', avatarUrl: member?.avatarUrl || null },
    } : r))
    setEditingId(null)

    try {
      const res = await fetch('/api/responsibilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, task: editTask.trim(), responsibleId: editResponsibleId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setResponsibilities(prev => prev.map(r => r.id === id ? updated : r))
        toast.success('Bijgewerkt')
      } else {
        if (previous) setResponsibilities(prev => prev.map(r => r.id === id ? previous : r))
        toast.error('Kon niet bijwerken')
      }
    } catch {
      if (previous) setResponsibilities(prev => prev.map(r => r.id === id ? previous : r))
      toast.error('Er ging iets mis')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const previous = responsibilities.find(r => r.id === deleteId)
    const prevIndex = responsibilities.findIndex(r => r.id === deleteId)

    // Optimistic update
    setResponsibilities(prev => prev.filter(r => r.id !== deleteId))
    setShowDeleteConfirm(false)
    setDeleteId(null)

    try {
      const res = await fetch(`/api/responsibilities?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Verwijderd')
      } else {
        if (previous) {
          setResponsibilities(prev => {
            const copy = [...prev]
            copy.splice(prevIndex, 0, previous)
            return copy
          })
        }
        toast.error('Kon niet verwijderen')
      }
    } catch {
      if (previous) {
        setResponsibilities(prev => {
          const copy = [...prev]
          copy.splice(prevIndex, 0, previous)
          return copy
        })
      }
      toast.error('Er ging iets mis')
    }
  }

  const startEdit = (r: Responsibility) => {
    setEditingId(r.id)
    setEditTask(r.task)
    setEditResponsibleId(r.responsible.id)
  }

  // Newsletter assignment handlers
  const isNewsletterItem = (r: Responsibility) =>
    r.task.toLowerCase().includes('nieuwsbrief')

  const newsletterResponsibility = responsibilities.find(isNewsletterItem)

  const canEditNewsletter = canEdit ||
    (!!currentUserId && !!newsletterResponsibility && newsletterResponsibility.responsible.id === currentUserId)

  const handleAddNewsletterAssignment = async () => {
    if (!nlAssigneeId || !nlDeadline) {
      toast.error('Kies een teamlid en deadline')
      return
    }

    try {
      const res = await fetch('/api/newsletter-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: nlAssigneeId,
          deadline: nlDeadline,
          topic: nlTopic.trim() || null,
        }),
      })
      if (res.ok) {
        const newAssignment = await res.json()
        setNewsletterAssignments(prev => [...prev, newAssignment].sort(
          (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        ))
        setNlAssigneeId('')
        setNlDeadline('')
        setNlTopic('')
        toast.success('Artikel-opdracht toegevoegd')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Kon niet toevoegen')
      }
    } catch {
      toast.error('Er ging iets mis')
    }
  }

  const handleToggleNewsletterStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'SUBMITTED' ? 'PENDING' : 'SUBMITTED'
    try {
      const res = await fetch('/api/newsletter-assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNewsletterAssignments(prev =>
          prev.map(a => a.id === id ? updated : a)
        )
        toast.success(newStatus === 'SUBMITTED' ? 'Gemarkeerd als ingeleverd' : 'Teruggezet naar open')
      }
    } catch {
      toast.error('Er ging iets mis')
    }
  }

  const handleDeleteNewsletterAssignment = async () => {
    if (!nlDeleteId) return
    try {
      const res = await fetch(`/api/newsletter-assignments?id=${nlDeleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setNewsletterAssignments(prev => prev.filter(a => a.id !== nlDeleteId))
        toast.success('Opdracht verwijderd')
      }
    } catch {
      toast.error('Er ging iets mis')
    } finally {
      setShowNlDeleteConfirm(false)
      setNlDeleteId(null)
    }
  }

  const handleSendReminder = async (assignmentId: string, assigneeName: string) => {
    try {
      const res = await fetch('/api/newsletter-assignments/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      if (res.ok) {
        toast.success(`Herinnering verstuurd naar ${assigneeName}`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Kon herinnering niet versturen')
      }
    } catch {
      toast.error('Er ging iets mis')
    }
  }

  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date()
  }

  const selectedMember = teamMembers.find(m => m.id === newResponsibleId)
  const editSelectedMember = teamMembers.find(m => m.id === editResponsibleId)
  const nlSelectedMember = teamMembers.find(m => m.id === nlAssigneeId)

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

      {/* Responsibilities — gegroepeerd per categorie (kaders) */}
      {responsibilities.length === 0 && !canEdit && (
        <div className="card p-12 text-center">
          <span className="text-4xl mb-4 block">📋</span>
          <p className="text-gray-400">Nog geen verantwoordelijkheden toegevoegd</p>
        </div>
      )}

      <ResponsibilitiesByChapter
        responsibilities={responsibilities}
        canEdit={canEdit}
        editingId={editingId}
        editTask={editTask}
        editResponsibleId={editResponsibleId}
        editSelectedMember={editSelectedMember}
        showEditDropdown={showEditDropdown}
        setEditTask={setEditTask}
        setShowEditDropdown={setShowEditDropdown}
        setEditResponsibleId={setEditResponsibleId}
        teamMembers={teamMembers}
        handleEdit={handleEdit}
        startEdit={startEdit}
        setEditingId={setEditingId}
        setDeleteId={setDeleteId}
        setShowDeleteConfirm={setShowDeleteConfirm}
        collapsedChapters={collapsedChapters}
        onRefetch={fetchData}
        toggleChapter={(id) => setCollapsedChapters(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id); else next.add(id)
          return next
        })}
      />

      {/* Newsletter Articles - Standalone Section */}
      <div className="card relative overflow-hidden border-workx-lime/20 shadow-[0_0_30px_rgba(249,255,133,0.15)]">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-workx-lime/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-workx-lime/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          {/* Header — klikbaar om uit te klappen */}
          <button
            onClick={() => setNlExpanded(v => !v)}
            className={`w-full p-5 sm:p-6 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors ${nlExpanded ? 'border-b border-workx-lime/10' : ''}`}
            aria-expanded={nlExpanded}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center flex-shrink-0">
                <Icons.fileText size={20} className="text-workx-lime" />
              </div>
              <div className="text-left min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-white">Nieuwsbrief artikelen</h3>
                <p className="text-xs text-gray-400 truncate">
                  {newsletterAssignments.length === 0
                    ? 'Klap uit om planning per medewerker te zien'
                    : (() => {
                        const pending = newsletterAssignments.filter(a => a.status === 'PENDING')
                        const next = pending.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0]
                        if (!next) return 'Alle artikelen ingeleverd 🎉'
                        const dl = new Date(next.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                        return `Volgende: ${next.assignee.name} · ${dl}`
                      })()
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {newsletterAssignments.length > 0 && !nlExpanded && (
                <div className="flex gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-workx-lime tabular-nums">{newsletterAssignments.filter(a => a.status === 'SUBMITTED').length}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Klaar</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-yellow-400 tabular-nums">{newsletterAssignments.filter(a => a.status === 'PENDING').length}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Open</p>
                  </div>
                </div>
              )}
              <Icons.chevronDown size={18} className={`text-white/40 transition-transform ${nlExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Assignments list — alleen tonen bij uitgeklapt */}
          {nlExpanded && (
          <>
          {/* Stats rij bij uitgeklapt */}
          {newsletterAssignments.length > 0 && (
            <div className="px-6 sm:px-8 pt-4 flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-workx-lime">{newsletterAssignments.filter(a => a.status === 'SUBMITTED').length}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ingeleverd</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{newsletterAssignments.filter(a => a.status === 'PENDING').length}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Open</p>
              </div>
            </div>
          )}

          {/* Assignments list */}
          <div className="p-6 sm:p-8">
            {newsletterAssignments.length > 0 ? (
              <div className="space-y-3">
                {newsletterAssignments.map((a) => {
                  const overdue = a.status === 'PENDING' && isOverdue(a.deadline)
                  const submitted = a.status === 'SUBMITTED'
                  return (
                    <div key={a.id} className={`card relative overflow-hidden transition-all hover:border-white/20 ${submitted ? 'border-green-500/20' : overdue ? 'border-red-500/20' : ''}`}>
                      {/* Subtle left accent */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${submitted ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-workx-lime/40'}`} />

                      <div className="relative p-4 sm:p-5 pl-5 sm:pl-6">
                        <div className="flex items-start gap-3">
                          {/* Assignee photo */}
                          <div className="flex-shrink-0 mt-0.5">
                            {getPhotoUrl(a.assignee.name, a.assignee.avatarUrl) ? (
                              <img loading="lazy" src={getPhotoUrl(a.assignee.name, a.assignee.avatarUrl)!} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center text-sm font-bold text-workx-lime ring-2 ring-white/10">
                                {a.assignee.name.charAt(0)}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-white">{a.assignee.name}</p>
                              {/* Status badge */}
                              {canEditNewsletter ? (
                                <button
                                  onClick={() => handleToggleNewsletterStatus(a.id, a.status)}
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition-all cursor-pointer hover:scale-105 ${
                                    submitted
                                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                      : overdue
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                  }`}
                                  title="Klik om status te wijzigen"
                                >
                                  {submitted ? 'Ingeleverd' : 'Open'}
                                </button>
                              ) : (
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                                  submitted
                                    ? 'bg-green-500/20 text-green-400'
                                    : overdue
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {submitted ? 'Ingeleverd' : 'Open'}
                                </span>
                              )}
                            </div>

                            {/* Topic */}
                            {a.topic && (
                              <p className="text-sm text-gray-300 mb-1.5">{a.topic}</p>
                            )}

                            {/* Deadline */}
                            <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-400' : submitted ? 'text-green-400/70' : 'text-gray-400'}`}>
                              <Icons.calendar size={12} />
                              <span>Deadline: {formatDeadline(a.deadline)}</span>
                              {overdue && !submitted && (
                                <span className="ml-1 text-red-400 font-medium">(te laat)</span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          {canEditNewsletter && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Reminder button - only for PENDING */}
                              {a.status === 'PENDING' && (
                                <button
                                  onClick={() => handleSendReminder(a.id, a.assignee.name)}
                                  className="p-2 rounded-lg hover:bg-yellow-500/10 text-gray-500 hover:text-yellow-400 transition-colors"
                                  title="Herinnering sturen"
                                  aria-label="Herinnering sturen"
                                >
                                  <Icons.bell size={14} />
                                </button>
                              )}
                              {/* Delete button */}
                              <button
                                onClick={() => { setNlDeleteId(a.id); setShowNlDeleteConfirm(true) }}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                                title="Verwijderen"
                                aria-label="Verwijderen"
                              >
                                <Icons.trash size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Icons.fileText size={24} className="text-gray-500" />
                </div>
                <p className="text-sm text-gray-400">Nog geen artikelen ingepland</p>
                {canEditNewsletter && (
                  <p className="text-xs text-gray-500 mt-1">Gebruik het formulier hieronder om artikelen in te plannen</p>
                )}
              </div>
            )}
          </div>

          {/* Add form - only for newsletter responsible / PARTNER / ADMIN */}
          {canEditNewsletter && (
            <div className="border-t border-workx-lime/10">
              <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
                <h5 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Icons.plus size={14} className="text-workx-lime" />
                  Nieuw artikel inplannen
                </h5>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                {/* Onderwerp (topic) - prominent field */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Onderwerp artikel</label>
                  <input
                    type="text"
                    value={nlTopic}
                    onChange={(e) => setNlTopic(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50 focus:ring-1 focus:ring-workx-lime/30 transition-colors"
                    placeholder="Bijv. Kantoorupdate, Interview nieuwe collega, Juridisch artikel..."
                  />
                </div>

                {/* Teamlid dropdown */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Wie schrijft het artikel?</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowNlDropdown(!showNlDropdown)}
                      className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left hover:border-white/20 transition-colors"
                    >
                      {nlSelectedMember ? (
                        <>
                          {getPhotoUrl(nlSelectedMember.name, nlSelectedMember.avatarUrl) ? (
                            <img loading="lazy" src={getPhotoUrl(nlSelectedMember.name, nlSelectedMember.avatarUrl)!} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-workx-lime/30" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-workx-lime/20 flex items-center justify-center text-sm font-bold text-workx-lime">{nlSelectedMember.name.charAt(0)}</div>
                          )}
                          <span className="text-white font-medium">{nlSelectedMember.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Icons.users size={14} className="text-gray-500" />
                          </div>
                          <span className="text-gray-500">Kies een teamlid...</span>
                        </>
                      )}
                      <Icons.chevronDown size={16} className="ml-auto text-gray-400" />
                    </button>
                    {showNlDropdown && (
                      <div className="absolute z-50 bottom-full mb-2 w-full bg-workx-dark/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl shadow-black/50 max-h-[40vh] overflow-y-auto">
                        {teamMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setNlAssigneeId(m.id); setShowNlDropdown(false) }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          >
                            {getPhotoUrl(m.name, m.avatarUrl) ? (
                              <img loading="lazy" src={getPhotoUrl(m.name, m.avatarUrl)!} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-workx-lime/20 flex items-center justify-center text-sm font-bold text-workx-lime">{m.name.charAt(0)}</div>
                            )}
                            <span className="text-white text-sm font-medium">{m.name}</span>
                            {m.id === nlAssigneeId && <Icons.check size={14} className="ml-auto text-workx-lime" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Deadline - fancy DatePicker */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Deadline</label>
                  <DatePicker
                    selected={nlDeadline ? new Date(nlDeadline + 'T12:00:00') : null}
                    onChange={(date) => {
                      if (date) {
                        const y = date.getFullYear()
                        const m = String(date.getMonth() + 1).padStart(2, '0')
                        const d = String(date.getDate()).padStart(2, '0')
                        setNlDeadline(`${y}-${m}-${d}`)
                      } else {
                        setNlDeadline('')
                      }
                    }}
                    placeholder="Kies een deadline..."
                    minDate={new Date()}
                    isClearable
                  />
                </div>

                <button
                  onClick={handleAddNewsletterAssignment}
                  disabled={!nlAssigneeId || !nlDeadline}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Icons.plus size={16} />
                  Artikel inplannen
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
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
                      <img loading="lazy" src={getPhotoUrl(selectedMember.name, selectedMember.avatarUrl)!} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-workx-lime/30" />
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
                <div className="absolute z-50 bottom-full mb-2 w-full bg-workx-dark/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl shadow-black/50 max-h-[50vh] overflow-y-auto">
                  {teamMembers.map(m => {
                    const photoUrl = getPhotoUrl(m.name, m.avatarUrl)
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setNewResponsibleId(m.id); setShowDropdown(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                      >
                        {photoUrl ? (
                          <img loading="lazy" src={photoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
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

      {/* Delete confirmation - responsibilities */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteId(null) }}
        onConfirm={handleDelete}
        title="Verwijderen"
        message="Weet je zeker dat je deze verantwoordelijkheid wilt verwijderen?"
        confirmText="Verwijderen"
        type="danger"
      />

      {/* Delete confirmation - newsletter assignment */}
      <ConfirmDialog
        isOpen={showNlDeleteConfirm}
        onClose={() => { setShowNlDeleteConfirm(false); setNlDeleteId(null) }}
        onConfirm={handleDeleteNewsletterAssignment}
        title="Opdracht verwijderen"
        message="Weet je zeker dat je deze artikel-opdracht wilt verwijderen?"
        confirmText="Verwijderen"
        type="danger"
      />
    </div>
  )
}

// ── Groepering per chapter (kaders) ─────────────────────────────────────

interface ResponsibilitiesByChapterProps {
  responsibilities: Responsibility[]
  canEdit: boolean
  editingId: string | null
  editTask: string
  editResponsibleId: string
  editSelectedMember: TeamMember | null | undefined
  showEditDropdown: boolean
  setEditTask: (v: string) => void
  setShowEditDropdown: (v: boolean) => void
  setEditResponsibleId: (v: string) => void
  teamMembers: TeamMember[]
  handleEdit: (id: string) => void
  startEdit: (r: Responsibility) => void
  setEditingId: (v: string | null) => void
  setDeleteId: (v: string | null) => void
  setShowDeleteConfirm: (v: boolean) => void
  collapsedChapters: Set<string>
  toggleChapter: (id: string) => void
  onRefetch: () => void
}

// Eén taak met alle eindverantwoordelijken + executors samengevoegd
interface TaskGroup {
  partnerTaskId: string | null
  taskLabel: string
  endResponsibles: { id: string; name: string; avatarUrl: string | null }[]
  executors: Executor[]
  // Voor losse Responsibilities (zonder partnerTask): houd de oorspronkelijke
  // Responsibility-id zodat edit/delete blijft werken.
  looseResponsibilityId?: string
}

function ResponsibilitiesByChapter({
  responsibilities,
  canEdit,
  editingId,
  editTask,
  editResponsibleId,
  editSelectedMember,
  showEditDropdown,
  setEditTask,
  setShowEditDropdown,
  setEditResponsibleId,
  teamMembers,
  handleEdit,
  startEdit,
  setEditingId,
  setDeleteId,
  setShowDeleteConfirm,
  collapsedChapters,
  toggleChapter,
  onRefetch,
}: ResponsibilitiesByChapterProps) {
  // Eerst groepen per chapter, daarbinnen per partnerTaskId (zodat
  // meerdere personen voor dezelfde taak op één rij komen).
  const groups = useMemo(() => {
    const chapterMap = new Map<string, { id: string; name: string; sortOrder: number; tasks: Map<string, TaskGroup> }>()
    const LOOSE_KEY = '__loose__'

    for (const r of responsibilities) {
      const chap = r.partnerTask?.chapter
      const cKey = chap?.id || LOOSE_KEY
      if (!chapterMap.has(cKey)) {
        chapterMap.set(cKey, {
          id: cKey,
          name: chap?.name || 'Algemeen',
          sortOrder: chap?.sortOrder ?? 9999,
          tasks: new Map(),
        })
      }
      const chapterEntry = chapterMap.get(cKey)!

      // Group key: partnerTaskId of een unieke per-Responsibility key
      const tKey = r.partnerTask?.id || `loose-${r.id}`
      if (!chapterEntry.tasks.has(tKey)) {
        chapterEntry.tasks.set(tKey, {
          partnerTaskId: r.partnerTask?.id || null,
          taskLabel: r.task,
          endResponsibles: [],
          executors: r.partnerTask?.executors || [],
          looseResponsibilityId: r.partnerTask?.id ? undefined : r.id,
        })
      }
      chapterEntry.tasks.get(tKey)!.endResponsibles.push(r.responsible)
    }

    return Array.from(chapterMap.values())
      .map(c => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        tasks: Array.from(c.tasks.values()),
      }))
      .sort((a, b) => {
        if (a.id === LOOSE_KEY) return 1
        if (b.id === LOOSE_KEY) return -1
        return a.sortOrder - b.sortOrder
      })
  }, [responsibilities])

  if (responsibilities.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map(group => {
        const collapsed = collapsedChapters.has(group.id)
        return (
          <section
            key={group.id}
            className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            {/* Kader-header */}
            <button
              onClick={() => toggleChapter(group.id)}
              className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-gradient-to-r from-workx-lime/10 via-workx-lime/5 to-transparent border-b border-workx-lime/15 hover:from-workx-lime/15 hover:via-workx-lime/8 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-workx-lime animate-pulse" />
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">{group.name}</h3>
                <span className="text-[10px] uppercase tracking-wider text-white/40 tabular-nums">
                  {group.tasks.length}
                </span>
              </div>
              <Icons.chevronDown size={14} className={`text-white/40 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            </button>

            {!collapsed && (
              <>
                {/* Sub-header met legenda */}
                <div className="px-4 sm:px-5 py-1.5 border-b border-white/5 bg-white/[0.01] flex items-center gap-3 text-[9px] uppercase tracking-wider">
                  <span className="text-amber-300/70 font-semibold">Eindverantwoordelijk</span>
                  <span className="text-white/30">·</span>
                  <span className="text-workx-lime/70 font-semibold">Verantwoordelijk teamlid</span>
                </div>

                <div className="divide-y divide-white/5">
                  {group.tasks.map(t => (
                    <TaskRow
                      key={t.partnerTaskId || `loose-${t.looseResponsibilityId}`}
                      group={t}
                      canEdit={canEdit}
                      teamMembers={teamMembers}
                      editingId={editingId}
                      editTask={editTask}
                      editResponsibleId={editResponsibleId}
                      editSelectedMember={editSelectedMember}
                      showEditDropdown={showEditDropdown}
                      setEditTask={setEditTask}
                      setShowEditDropdown={setShowEditDropdown}
                      setEditResponsibleId={setEditResponsibleId}
                      handleEdit={handleEdit}
                      startEdit={startEdit}
                      setEditingId={setEditingId}
                      setDeleteId={setDeleteId}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                      onRefetch={onRefetch}
                      responsibilities={responsibilities}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ── Eén task-rij: end-responsibles + executors + add-executor dropdown ──

function TaskRow({
  group, canEdit, teamMembers,
  editingId, editTask, editResponsibleId, editSelectedMember, showEditDropdown,
  setEditTask, setShowEditDropdown, setEditResponsibleId,
  handleEdit, startEdit, setEditingId, setDeleteId, setShowDeleteConfirm,
  onRefetch, responsibilities,
}: {
  group: TaskGroup
  canEdit: boolean
  teamMembers: TeamMember[]
  editingId: string | null
  editTask: string
  editResponsibleId: string
  editSelectedMember: TeamMember | null | undefined
  showEditDropdown: boolean
  setEditTask: (v: string) => void
  setShowEditDropdown: (v: boolean) => void
  setEditResponsibleId: (v: string) => void
  handleEdit: (id: string) => void
  startEdit: (r: Responsibility) => void
  setEditingId: (v: string | null) => void
  setDeleteId: (v: string | null) => void
  setShowDeleteConfirm: (v: boolean) => void
  onRefetch: () => void
  responsibilities: Responsibility[]
}) {
  const [showExecutorMenu, setShowExecutorMenu] = useState(false)
  const [busy, setBusy] = useState(false)

  // Voor losse responsibilities: vind de echte Responsibility om edit/delete te triggeren
  const looseResp = group.looseResponsibilityId
    ? responsibilities.find(r => r.id === group.looseResponsibilityId)
    : null
  const isEditing = looseResp && editingId === looseResp.id

  const executorUserIds = new Set(group.executors.map(e => e.user.id))
  const availableExecutors = teamMembers.filter(m => !executorUserIds.has(m.id))

  const addExecutor = async (userId: string) => {
    if (!group.partnerTaskId) {
      toast.error('Kan uitvoerder alleen toevoegen aan gepubliceerde taken')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/partner-tasks/${group.partnerTaskId}/executors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error()
      setShowExecutorMenu(false)
      onRefetch()
    } catch {
      toast.error('Kon uitvoerder niet toevoegen')
    } finally {
      setBusy(false)
    }
  }

  const removeExecutor = async (userId: string) => {
    if (!group.partnerTaskId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/partner-tasks/${group.partnerTaskId}/executors?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onRefetch()
    } catch {
      toast.error('Kon uitvoerder niet verwijderen')
    } finally {
      setBusy(false)
    }
  }

  // Inline-edit view (alleen voor losse responsibilities)
  if (isEditing && looseResp) {
    return (
      <div className="p-4 space-y-2.5">
        <input
          type="text"
          value={editTask}
          onChange={(e) => setEditTask(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/50"
          placeholder="Verantwoordelijkheid..."
        />
        <div className="relative">
          <button
            onClick={() => setShowEditDropdown(!showEditDropdown)}
            className="w-full flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-left hover:border-white/30 transition-colors"
          >
            {editSelectedMember ? (
              <>
                {getPhotoUrl(editSelectedMember.name, editSelectedMember.avatarUrl) ? (
                  <img loading="lazy" src={getPhotoUrl(editSelectedMember.name, editSelectedMember.avatarUrl)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-bold text-workx-lime">{editSelectedMember.name.charAt(0)}</div>
                )}
                <span className="text-sm text-white">{editSelectedMember.name}</span>
              </>
            ) : (
              <span className="text-xs text-gray-500">Kies verantwoordelijke…</span>
            )}
            <Icons.chevronDown size={12} className="ml-auto text-gray-400" />
          </button>
          {showEditDropdown && (
            <div className="absolute z-50 bottom-full mb-1 w-full bg-workx-dark border border-white/20 rounded-xl shadow-2xl max-h-[40vh] overflow-y-auto">
              {teamMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setEditResponsibleId(m.id); setShowEditDropdown(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors"
                >
                  {getPhotoUrl(m.name, m.avatarUrl) ? (
                    <img loading="lazy" src={getPhotoUrl(m.name, m.avatarUrl)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-bold text-workx-lime">{m.name.charAt(0)}</div>
                  )}
                  <span className="text-white text-xs">{m.name}</span>
                  {m.id === editResponsibleId && <Icons.check size={12} className="ml-auto text-workx-lime" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleEdit(looseResp.id)} className="btn-primary text-xs px-3 py-1.5">Opslaan</button>
          <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Annuleren</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group p-3 sm:p-4 hover:bg-white/[0.02] transition-colors">
      {/* Taak-titel */}
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base text-white font-medium leading-tight">{group.taskLabel}</p>
        </div>
        {canEdit && looseResp && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => startEdit(looseResp)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Bewerken"
            >
              <Icons.edit size={12} />
            </button>
            <button
              onClick={() => { setDeleteId(looseResp.id); setShowDeleteConfirm(true) }}
              className="p-1 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
              title="Verwijderen"
            >
              <Icons.trash size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Avatars: eindverantwoordelijken (amber-ring) en uitvoerders (lime-ring) */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Eindverantwoordelijken */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {group.endResponsibles.map(p => (
              <PersonAvatar key={p.id} name={p.name} avatarUrl={p.avatarUrl} ring="amber" />
            ))}
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-amber-300/70 font-semibold leading-tight">Eindverantwoordelijk</span>
            <span className="text-[11px] text-white/80 leading-tight">
              {group.endResponsibles.map(p => p.name.split(' ')[0]).join(' · ')}
            </span>
          </div>
        </div>

        {/* Uitvoerders */}
        {group.executors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {group.executors.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => removeExecutor(ex.user.id)}
                  disabled={busy}
                  className="group/avatar relative"
                  title={`${ex.user.name} (klik om weg te halen)`}
                >
                  <PersonAvatar name={ex.user.name} avatarUrl={ex.user.avatarUrl} ring="lime" />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white items-center justify-center hidden group-hover/avatar:flex">×</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-workx-lime/70 font-semibold leading-tight">Verantwoordelijk teamlid</span>
              <span className="text-[11px] text-white/80 leading-tight">
                {group.executors.map(e => e.user.name.split(' ')[0]).join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* + Uitvoerder dropdown (alleen voor gepubliceerde partnerTasks) */}
        {group.partnerTaskId && (
          <div className="relative">
            <button
              onClick={() => setShowExecutorMenu(v => !v)}
              disabled={busy || availableExecutors.length === 0}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-white/60 hover:text-white transition-colors disabled:opacity-40 flex items-center gap-1"
              title="Verantwoordelijk teamlid toevoegen"
            >
              <Icons.plus size={10} /> Teamlid
            </button>
            {showExecutorMenu && availableExecutors.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 min-w-[200px] bg-workx-dark border border-white/20 rounded-xl shadow-2xl max-h-[40vh] overflow-y-auto">
                {availableExecutors.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addExecutor(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors text-left"
                  >
                    {getPhotoUrl(m.name, m.avatarUrl) ? (
                      <img loading="lazy" src={getPhotoUrl(m.name, m.avatarUrl)!} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-bold text-workx-lime">{m.name.charAt(0)}</div>
                    )}
                    <span className="text-white text-xs">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PersonAvatar({ name, avatarUrl, ring }: { name: string; avatarUrl: string | null; ring: 'amber' | 'lime' }) {
  const ringColor = ring === 'amber' ? 'ring-amber-300/50' : 'ring-workx-lime/50'
  const bgColor = ring === 'amber' ? 'bg-amber-300/20 text-amber-200' : 'bg-workx-lime/20 text-workx-lime'
  const photo = getPhotoUrl(name, avatarUrl)
  return photo ? (
    <img
      loading="lazy"
      src={photo}
      alt={name}
      title={name}
      className={`w-7 h-7 rounded-full object-cover ring-2 ${ringColor} ring-workx-dark`}
    />
  ) : (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${ringColor} ring-workx-dark ${bgColor}`} title={name}>
      {name.charAt(0)}
    </div>
  )
}
