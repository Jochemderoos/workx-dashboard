'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

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

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<WorkItem['status']>('NEW')
  const [priority, setPriority] = useState<WorkItem['priority']>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [clientName, setClientName] = useState('')
  const [caseNumber, setCaseNumber] = useState('')

  useEffect(() => { fetchData() }, [])

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

  const resetForm = () => {
    setTitle(''); setDescription(''); setStatus('NEW'); setPriority('MEDIUM')
    setDueDate(''); setEstimatedHours(''); setClientName(''); setCaseNumber('')
    setEditingItem(null); setShowForm(false)
  }

  const handleEdit = (item: WorkItem) => {
    setTitle(item.title)
    setDescription(item.description || '')
    setStatus(item.status)
    setPriority(item.priority)
    setDueDate(item.dueDate ? item.dueDate.split('T')[0] : '')
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
          dueDate: dueDate || null, estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
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
          <p className="text-white/40">Beheer zaken, taken en deadlines</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Icons.plus size={16} />
          Nieuw item
        </button>
      </div>

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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-workx-lime/30 transition-all"
          >
            <option value="all">Alle statussen</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
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
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as WorkItem['status'])}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-workx-lime/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkItem['status'])}
                    className="input-field"
                  >
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Prioriteit</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WorkItem['priority'])}
                    className="input-field"
                  >
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Deadline</label>
                  <div className="relative">
                    <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
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

              <div className="grid grid-cols-2 gap-4">
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
    </div>
  )
}
