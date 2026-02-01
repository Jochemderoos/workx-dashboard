'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { TEAM_PHOTOS, ADVOCATEN } from '@/lib/team-photos'

interface WorkItem {
  id: string
  title: string
  description: string | null
  status: 'NEW' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'ON_HOLD'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: string | null
  estimatedHours: number | null
  actualHours: number | null
  clientName: string | null
  caseNumber: string | null
  createdAt: string
  assignee: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}

// Workload types
type WorkloadLevel = 'green' | 'yellow' | 'orange' | 'red' | null

interface WorkloadEntry {
  personName: string
  date: string // YYYY-MM-DD
  level: WorkloadLevel
}

// Team photos en advocaten lijst komen nu uit @/lib/team-photos
// Workload data wordt uit API geladen

const workloadConfig = {
  green: { label: 'Rustig', color: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  yellow: { label: 'Normaal', color: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  orange: { label: 'Druk', color: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  red: { label: 'Zeer druk', color: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
}

const statusConfig = {
  NEW: { label: 'Nieuw', color: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', icon: Icons.plus },
  IN_PROGRESS: { label: 'Bezig', color: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Icons.play },
  PENDING_REVIEW: { label: 'Review', color: 'bg-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10', icon: Icons.eye },
  COMPLETED: { label: 'Klaar', color: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/10', icon: Icons.check },
  ON_HOLD: { label: 'On hold', color: 'bg-white/40', text: 'text-white/40', bg: 'bg-white/5', icon: Icons.pause },
}

const priorityConfig = {
  LOW: { label: 'Laag', color: 'bg-white/30', text: 'text-white/40' },
  MEDIUM: { label: 'Normaal', color: 'bg-blue-400', text: 'text-blue-400' },
  HIGH: { label: 'Hoog', color: 'bg-orange-400', text: 'text-orange-400' },
  URGENT: { label: 'Urgent', color: 'bg-red-400', text: 'text-red-400' },
}

export default function WerkOverzichtPage() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [pageMode, setPageMode] = useState<'zaken' | 'werkdruk'>('zaken')

  // Workload state
  const [workloadEntries, setWorkloadEntries] = useState<WorkloadEntry[]>([])
  const [editingWorkload, setEditingWorkload] = useState<{ person: string; date: string } | null>(null)
  const [canEditWorkload, setCanEditWorkload] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadDate, setUploadDate] = useState<Date | null>(new Date())
  const [isUploading, setIsUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<WorkItem['status']>('NEW')
  const [priority, setPriority] = useState<WorkItem['priority']>('MEDIUM')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [estimatedHours, setEstimatedHours] = useState('')
  const [clientName, setClientName] = useState('')
  const [caseNumber, setCaseNumber] = useState('')

  // Dropdown states for premium selects
  const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [openItemStatusDropdown, setOpenItemStatusDropdown] = useState<string | null>(null)

  // Calculate last 3 workdays
  const last3Workdays = useMemo(() => {
    const days: Date[] = []
    const today = new Date()
    let current = new Date(today)

    while (days.length < 3) {
      const dayOfWeek = current.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push(new Date(current))
      }
      current.setDate(current.getDate() - 1)
    }

    return days.reverse() // Oldest first
  }, [])

  // Get workload for a specific person and date
  const getWorkload = (person: string, date: Date): WorkloadLevel => {
    const dateStr = date.toISOString().split('T')[0]
    const entry = workloadEntries.find(e => e.personName === person && e.date === dateStr)
    return entry?.level || null
  }

  // Set workload for a person on a date - saves to API
  const saveWorkload = async (person: string, date: Date, level: WorkloadLevel) => {
    const dateStr = date.toISOString().split('T')[0]

    try {
      const res = await fetch('/api/workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName: person, date: dateStr, level })
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Kon werkdruk niet opslaan')
        return
      }

      // Update local state
      setWorkloadEntries(prev => {
        const filtered = prev.filter(e => !(e.personName === person && e.date === dateStr))
        if (level) {
          return [...filtered, { personName: person, date: dateStr, level }]
        }
        return filtered
      })
      toast.success(`Werkdruk bijgewerkt voor ${person.split(' ')[0]}`)
    } catch (error) {
      toast.error('Kon werkdruk niet opslaan')
    }
    setEditingWorkload(null)
  }

  // Count workload levels for today
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayEntries = workloadEntries.filter(e => e.date === today)
    return {
      green: todayEntries.filter(e => e.level === 'green').length,
      yellow: todayEntries.filter(e => e.level === 'yellow').length,
      orange: todayEntries.filter(e => e.level === 'orange').length,
      red: todayEntries.filter(e => e.level === 'red').length,
      notFilled: ADVOCATEN.length - todayEntries.length,
    }
  }, [workloadEntries])

  useEffect(() => {
    fetchData()
    fetchWorkload()
    checkEditPermission()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/work')
      if (res.ok) setWorkItems(await res.json())
    } catch (error) {
      toast.error('Kon gegevens niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkload = async () => {
    try {
      const res = await fetch('/api/workload')
      if (res.ok) {
        const data = await res.json()
        setWorkloadEntries(data.map((e: { personName: string; date: string; level: string }) => ({
          personName: e.personName,
          date: e.date,
          level: e.level as WorkloadLevel
        })))
      }
    } catch (error) {
      console.error('Kon werkdruk niet laden')
    }
  }

  // Upload RTF bestand en verwerk uren naar werkdruk
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadDate) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('date', uploadDate.toISOString().split('T')[0])

    try {
      const res = await fetch('/api/workload/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload mislukt')
      }

      toast.success(`${data.processed} medewerkers verwerkt`)
      setShowUploadModal(false)
      fetchWorkload() // Herlaad de werkdruk data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload mislukt')
    } finally {
      setIsUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const checkEditPermission = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const user = await res.json()
        setCanEditWorkload(user.role === 'PARTNER' || user.role === 'ADMIN')
      }
    } catch (error) {
      console.error('Kon gebruiker niet laden')
    }
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setStatus('NEW'); setPriority('MEDIUM')
    setDueDate(null); setEstimatedHours(''); setClientName(''); setCaseNumber('')
    setEditingItem(null); setShowForm(false)
  }

  const handleEdit = (item: WorkItem) => {
    setTitle(item.title)
    setDescription(item.description || '')
    setStatus(item.status)
    setPriority(item.priority)
    setDueDate(item.dueDate ? new Date(item.dueDate) : null)
    setEstimatedHours(item.estimatedHours?.toString() || '')
    setClientName(item.clientName || '')
    setCaseNumber(item.caseNumber || '')
    setEditingItem(item)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return toast.error('Titel is verplicht')
    try {
      const res = await fetch(editingItem ? `/api/work/${editingItem.id}` : '/api/work', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null, status, priority,
          dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null, estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
          clientName: clientName || null, caseNumber: caseNumber || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(editingItem ? 'Bijgewerkt' : 'Aangemaakt')
      resetForm()
      fetchData()
    } catch (error) {
      toast.error('Kon niet opslaan')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Verwijderen?')) return
    try {
      await fetch(`/api/work/${id}`, { method: 'DELETE' })
      toast.success('Verwijderd')
      fetchData()
    } catch (error) {
      toast.error('Kon niet verwijderen')
    }
  }

  const handleStatusChange = async (id: string, newStatus: WorkItem['status']) => {
    try {
      await fetch(`/api/work/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchData()
    } catch (error) {
      toast.error('Kon status niet bijwerken')
    }
  }

  const filteredItems = workItems.filter(item => statusFilter === 'all' || item.status === statusFilter)
  const groupedItems = Object.keys(statusConfig).reduce((acc, s) => {
    acc[s] = filteredItems.filter(item => item.status === s)
    return acc
  }, {} as Record<string, WorkItem[]>)

  const stats = {
    total: workItems.length,
    inProgress: workItems.filter(i => i.status === 'IN_PROGRESS').length,
    completed: workItems.filter(i => i.status === 'COMPLETED').length,
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-white/40">Werk laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
              <Icons.briefcase className="text-blue-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Werk</h1>
          </div>
          <p className="text-white/40">
            {pageMode === 'zaken' ? 'Beheer zaken, taken en deadlines' : 'Werkdruk overzicht van het team'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            <button
              onClick={() => setPageMode('zaken')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pageMode === 'zaken' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.briefcase size={16} />
              Zaken
            </button>
            <button
              onClick={() => setPageMode('werkdruk')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pageMode === 'werkdruk' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.activity size={16} />
              Werkdruk
            </button>
          </div>
          {pageMode === 'zaken' && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Icons.plus size={16} />
              Nieuw item
            </button>
          )}
        </div>
      </div>

      {/* WERKDRUK MODE */}
      {pageMode === 'werkdruk' && (
        <div className="space-y-6">
          {/* Upload Button */}
          {canEditWorkload && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Icons.upload size={16} />
                Uren uploaden
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                  <Icons.check className="text-green-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-green-400">{todayStats.green}</p>
                <p className="text-sm text-white/40">Rustig</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-3">
                  <Icons.minus className="text-yellow-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-yellow-400">{todayStats.yellow}</p>
                <p className="text-sm text-white/40">Normaal</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
                  <Icons.alertTriangle className="text-orange-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-orange-400">{todayStats.orange}</p>
                <p className="text-sm text-white/40">Druk</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                  <Icons.alertTriangle className="text-red-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-red-400">{todayStats.red}</p>
                <p className="text-sm text-white/40">Zeer druk</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <Icons.help className="text-white/40" size={18} />
                </div>
                <p className="text-2xl font-semibold text-white/40">{todayStats.notFilled}</p>
                <p className="text-sm text-white/40">Niet ingevuld</p>
              </div>
            </div>
          </div>

          {/* Workload Overview */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.activity className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white text-sm sm:text-base">Werkdruk laatste 3 werkdagen</h2>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-white/50">Rustig</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-white/50">Normaal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-white/50">Druk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-white/50">Zeer druk</span>
                </div>
              </div>
            </div>

            {/* Table - scrollable on mobile */}
            <div className="overflow-x-auto">
              <div className="min-w-[550px]">
                {/* Table header */}
                <div className="grid gap-4 px-5 py-3 bg-white/[0.02] border-b border-white/5 text-xs text-white/40 font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr repeat(3, 100px)' }}
                >
                  <div>Medewerker</div>
              {last3Workdays.map(day => (
                <div key={day.toISOString()} className="text-center">
                  {day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
              ))}
            </div>

            {/* Table body */}
            <div className="divide-y divide-white/5">
              {ADVOCATEN.map((person) => {
                const photoUrl = TEAM_PHOTOS[person]

                return (
                  <div
                    key={person}
                    className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors"
                    style={{ gridTemplateColumns: '1fr repeat(3, 100px)' }}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={photoUrl}
                        alt={person}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10"
                      />
                      <div>
                        <p className="font-medium text-white">{person}</p>
                      </div>
                    </div>
                    {last3Workdays.map(day => {
                      const dateStr = day.toISOString().split('T')[0]
                      const level = getWorkload(person, day)
                      const isEditing = editingWorkload?.person === person && editingWorkload?.date === dateStr
                      const isToday = day.toDateString() === new Date().toDateString()

                      return (
                        <div key={dateStr} className="flex justify-center">
                          {isEditing && canEditWorkload ? (
                            <div className="flex items-center gap-1 bg-workx-dark/80 border border-white/10 rounded-xl p-2">
                              {(['green', 'yellow', 'orange', 'red'] as const).map(l => (
                                <button
                                  key={l}
                                  onClick={() => saveWorkload(person, day, l)}
                                  className={`w-8 h-8 rounded-lg ${workloadConfig[l].bg} ${workloadConfig[l].border} border-2 hover:scale-110 transition-transform flex items-center justify-center`}
                                >
                                  {level === l && <Icons.check size={14} className={workloadConfig[l].text} />}
                                </button>
                              ))}
                              <button
                                onClick={() => setEditingWorkload(null)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40"
                              >
                                <Icons.x size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => canEditWorkload && setEditingWorkload({ person, date: dateStr })}
                              disabled={!canEditWorkload}
                              className={`w-full h-12 rounded-xl flex items-center justify-center transition-all ${
                                canEditWorkload ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
                              } ${
                                level
                                  ? `${workloadConfig[level].bg} ${workloadConfig[level].border} border`
                                  : canEditWorkload
                                    ? 'bg-white/5 border border-dashed border-white/10 hover:border-white/20'
                                    : 'bg-white/5 border border-white/5'
                              } ${isToday ? 'ring-2 ring-workx-lime/30 ring-offset-2 ring-offset-workx-dark' : ''}`}
                            >
                              {level ? (
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${workloadConfig[level].color}`} />
                                  <span className={`text-sm font-medium ${workloadConfig[level].text}`}>
                                    {workloadConfig[level].label}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-white/30">{canEditWorkload ? 'Invullen' : '-'}</span>
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              </div>
            </div>
            </div>
          </div>

          {/* Info card */}
          <div className="card p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.info className="text-blue-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Over werkdruk tracking</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Klik op een cel om de werkdruk van een medewerker voor die dag in te vullen.
                  Dit overzicht helpt om snel te zien wie er veel aan het hoofd heeft en wie ruimte heeft om bij te springen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZAKEN MODE */}
      {pageMode === 'zaken' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                  <Icons.layers className="text-blue-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-white">{stats.total}</p>
                <p className="text-sm text-white/40">Totaal</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-3">
                  <Icons.play className="text-yellow-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-yellow-400">{stats.inProgress}</p>
                <p className="text-sm text-white/40">In behandeling</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                  <Icons.check className="text-green-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-green-400">{stats.completed}</p>
                <p className="text-sm text-white/40">Afgerond</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                  <Icons.flag className="text-red-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-red-400">{workItems.filter(i => i.priority === 'URGENT').length}</p>
                <p className="text-sm text-white/40">Urgent</p>
              </div>
            </div>
          </div>

      {/* Filters & View toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Zoeken in zaken..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowStatusFilterDropdown(!showStatusFilterDropdown)}
              className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/30"
            >
              {statusFilter === 'all' ? (
                <span className="text-white/70">Alle statussen</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusConfig[statusFilter as keyof typeof statusConfig].color}`} />
                  <span>{statusConfig[statusFilter as keyof typeof statusConfig].label}</span>
                </div>
              )}
              <Icons.chevronDown size={16} className={`text-white/40 transition-transform ${showStatusFilterDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showStatusFilterDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilterDropdown(false)} />
                <div className="absolute left-0 top-full mt-2 w-48 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                  <div className="py-1">
                    <button
                      onClick={() => { setStatusFilter('all'); setShowStatusFilterDropdown(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${statusFilter === 'all' ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                        <Icons.layers size={12} className="text-white/50" />
                      </div>
                      <span>Alle statussen</span>
                      {statusFilter === 'all' && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                    </button>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => { setStatusFilter(key); setShowStatusFilterDropdown(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${statusFilter === key ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                      >
                        <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center`}>
                          <config.icon size={12} className={config.text} />
                        </div>
                        <span>{config.label}</span>
                        {statusFilter === key && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-workx-lime text-workx-dark' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Icons.list size={16} />
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'board' ? 'bg-workx-lime text-workx-dark' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Icons.grid size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="card p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Icons.briefcase className="text-blue-400/50" size={32} />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Geen items gevonden</h3>
              <p className="text-white/40 mb-4">Maak een nieuwe zaak of taak aan</p>
              <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
                <Icons.plus size={16} />
                Nieuw item
              </button>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const statusCfg = statusConfig[item.status]
              const priorityCfg = priorityConfig[item.priority]
              const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'COMPLETED'
              return (
                <div
                  key={item.id}
                  className="card p-5 group hover:border-white/10 transition-all"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusCfg.bg}`}>
                          <statusCfg.icon className={statusCfg.text} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white truncate">{item.title}</h3>
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${priorityCfg.color}`} title={priorityCfg.label} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                              {statusCfg.label}
                            </span>
                            {item.priority === 'URGENT' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-sm text-white/40 mb-3 line-clamp-1 ml-[52px]">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 ml-[52px]">
                        {item.clientName && (
                          <span className="flex items-center gap-1.5">
                            <Icons.user size={12} />
                            {item.clientName}
                          </span>
                        )}
                        {item.caseNumber && (
                          <span className="flex items-center gap-1.5">
                            <Icons.folder size={12} />
                            #{item.caseNumber}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-400' : ''}`}>
                            <Icons.clock size={12} />
                            {new Date(item.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                            {isOverdue && ' (verlopen)'}
                          </span>
                        )}
                        {item.estimatedHours && (
                          <span className="flex items-center gap-1.5">
                            <Icons.clock size={12} />
                            {item.estimatedHours}u
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenItemStatusDropdown(openItemStatusDropdown === item.id ? null : item.id) }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${statusCfg.bg} ${statusCfg.text} hover:opacity-80`}
                        >
                          <statusCfg.icon size={12} />
                          <span>{statusCfg.label}</span>
                          <Icons.chevronDown size={12} className={`transition-transform ${openItemStatusDropdown === item.id ? 'rotate-180' : ''}`} />
                        </button>
                        {openItemStatusDropdown === item.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenItemStatusDropdown(null)} />
                            <div className="absolute right-0 top-full mt-1 w-40 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                              <div className="py-1">
                                {Object.entries(statusConfig).map(([key, config]) => (
                                  <button
                                    key={key}
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, key as WorkItem['status']); setOpenItemStatusDropdown(null) }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-all ${item.status === key ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                                  >
                                    <div className={`w-5 h-5 rounded ${config.bg} flex items-center justify-center`}>
                                      <config.icon size={10} className={config.text} />
                                    </div>
                                    <span>{config.label}</span>
                                    {item.status === key && <Icons.check size={12} className="ml-auto text-workx-lime" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <Icons.edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <Icons.trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
          {Object.entries(statusConfig).map(([statusKey, config]) => (
            <div key={statusKey} className="min-w-[250px]">
              <div className="flex items-center gap-2 px-2 mb-4 sticky top-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                  <config.icon className={config.text} size={14} />
                </div>
                <span className="font-medium text-white text-sm">{config.label}</span>
                <span className="ml-auto text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {groupedItems[statusKey]?.length || 0}
                </span>
              </div>
              <div className="space-y-2 min-h-[300px] p-2 rounded-xl bg-white/[0.02] border border-white/5">
                {groupedItems[statusKey]?.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-white/20">Geen items</p>
                  </div>
                ) : (
                  groupedItems[statusKey]?.map((item, index) => {
                    const priorityCfg = priorityConfig[item.priority]
                    const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'COMPLETED'
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleEdit(item)}
                        className="card p-4 cursor-pointer hover:border-white/15 transition-all group"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${priorityCfg.color === 'bg-white/30' ? 'bg-white/10 text-white/50' : priorityCfg.color.replace('bg-', 'bg-') + '/10 ' + priorityCfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.color}`} />
                            {priorityCfg.label}
                          </span>
                          {isOverdue && (
                            <Icons.alertTriangle className="text-red-400" size={12} />
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-workx-lime transition-colors">
                          {item.title}
                        </h4>
                        {item.clientName && (
                          <p className="text-xs text-white/40 flex items-center gap-1.5 mb-2">
                            <Icons.user size={10} />
                            {item.clientName}
                          </p>
                        )}
                        {item.dueDate && (
                          <p className={`text-xs flex items-center gap-1.5 ${isOverdue ? 'text-red-400' : 'text-white/30'}`}>
                            <Icons.clock size={10} />
                            {new Date(item.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div
            className="bg-workx-gray rounded-2xl p-6 w-full max-w-lg border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Icons.briefcase className="text-blue-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">{editingItem ? 'Item bewerken' : 'Nieuw werk item'}</h2>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-2">Titel</label>
                <div className="relative">
                  <Icons.edit className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Korte beschrijving van de zaak"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Beschrijving</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details en notities..."
                  className="input-field resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Status</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/30"
                    >
                      <div className={`w-7 h-7 rounded-lg ${statusConfig[status].bg} flex items-center justify-center`}>
                        {(() => { const Icon = statusConfig[status].icon; return <Icon size={14} className={statusConfig[status].text} /> })()}
                      </div>
                      <span className="flex-1 text-white text-sm">{statusConfig[status].label}</span>
                      <Icons.chevronDown size={16} className={`text-white/40 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showStatusDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)} />
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                          <div className="py-1">
                            {Object.entries(statusConfig).map(([key, config]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => { setStatus(key as WorkItem['status']); setShowStatusDropdown(false) }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${status === key ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                              >
                                <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>
                                  <config.icon size={14} className={config.text} />
                                </div>
                                <span>{config.label}</span>
                                {status === key && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Prioriteit</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                      className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/30"
                    >
                      <div className={`w-3 h-3 rounded-full ${priorityConfig[priority].color}`} />
                      <span className="flex-1 text-white text-sm">{priorityConfig[priority].label}</span>
                      <Icons.chevronDown size={16} className={`text-white/40 transition-transform ${showPriorityDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showPriorityDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPriorityDropdown(false)} />
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                          <div className="py-1">
                            {Object.entries(priorityConfig).map(([key, config]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => { setPriority(key as WorkItem['priority']); setShowPriorityDropdown(false) }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${priority === key ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                              >
                                <div className={`w-3 h-3 rounded-full ${config.color}`} />
                                <span>{config.label}</span>
                                {priority === key && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Deadline</label>
                  <DatePicker
                    selected={dueDate}
                    onChange={(date) => setDueDate(date)}
                    placeholder="Selecteer deadline..."
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Geschatte uren</label>
                  <div className="relative">
                    <Icons.clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      placeholder="0"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Klant</label>
                  <div className="relative">
                    <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Klantnaam"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Zaaknummer</label>
                  <div className="relative">
                    <Icons.folder className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="text"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="2024-001"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={resetForm} className="flex-1 btn-secondary">
                  Annuleren
                </button>
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingItem.id)}
                    className="px-4 py-2.5 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                  >
                    <Icons.trash size={16} />
                  </button>
                )}
                <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
                  <Icons.check size={16} />
                  {editingItem ? 'Bijwerken' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Werkdruk Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowUploadModal(false)}>
          <div
            className="bg-workx-gray rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                  <Icons.upload className="text-workx-lime" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">Uren uploaden</h2>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-2">Datum voor werkdruk</label>
                <DatePicker
                  selected={uploadDate}
                  onChange={setUploadDate}
                  placeholder="Selecteer datum..."
                />
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Icons.info className="text-blue-400 mt-0.5" size={16} />
                  <div className="text-sm text-white/70">
                    <p className="font-medium text-blue-400 mb-1">Uren naar werkdruk</p>
                    <ul className="space-y-1 text-xs text-white/50">
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> ≤3 uur = Rustig</li>
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> ≤4 uur = Normaal</li>
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400" /> ≤5 uur = Druk</li>
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400" /> &gt;5 uur = Heel druk</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Urenoverzicht bestand (.docx / .rtf)</label>
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isUploading
                    ? 'border-workx-lime/50 bg-workx-lime/5'
                    : 'border-white/20 hover:border-workx-lime/50 hover:bg-white/5'
                }`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <>
                        <div className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-sm text-workx-lime">Verwerken...</p>
                      </>
                    ) : (
                      <>
                        <Icons.upload className="text-white/40 mb-2" size={24} />
                        <p className="text-sm text-white/60">Klik om bestand te selecteren</p>
                        <p className="text-xs text-white/30 mt-1">of sleep het hierheen</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".docx,.rtf,.doc"
                    onChange={handleFileUpload}
                    disabled={isUploading || !uploadDate}
                  />
                </label>
              </div>

              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full btn-secondary"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
