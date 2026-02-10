'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import TopicRow from './TopicRow'
import WerkverdelingTable from './WerkverdelingTable'
import toast from 'react-hot-toast'

interface Topic {
  id: string
  title: string
  remarks: string | null
  isStandard: boolean
  sortOrder: number
  actions?: Action[]
}

interface Action {
  id: string
  description: string
  responsibleName: string
  isCompleted: boolean
  topicId?: string | null
}

interface Distribution {
  id?: string
  partnerName: string
  employeeName: string | null
  employeeId: string | null
}

interface Employee {
  id: string
  name: string
}

interface WeekSectionProps {
  weekId: string
  monthId: string
  dateLabel: string
  meetingDate: string
  topics: Topic[]
  actions: Action[]
  distributions: Distribution[]
  employees: Employee[]
  teamMembers: string[]
  defaultOpen?: boolean
  onDataChange: () => void
}

export default function WeekSection({
  weekId,
  monthId,
  dateLabel,
  topics,
  actions,
  distributions,
  employees,
  teamMembers,
  defaultOpen = false,
  onDataChange,
}: WeekSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isAddingTopic, setIsAddingTopic] = useState(false)
  const [newTopicTitle, setNewTopicTitle] = useState('')

  const basePath = `/api/notulen/${monthId}/weeks/${weekId}`

  const handleUpdateTopic = async (topicId: string, data: { title?: string; remarks?: string }) => {
    try {
      const res = await fetch(`${basePath}/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      toast.error('Kon agendapunt niet bijwerken')
    }
  }

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const res = await fetch(`${basePath}/topics/${topicId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Agendapunt verwijderd')
      onDataChange()
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return
    try {
      const res = await fetch(`${basePath}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTopicTitle.trim(), sortOrder: topics.length }),
      })
      if (!res.ok) throw new Error()
      setNewTopicTitle('')
      setIsAddingTopic(false)
      onDataChange()
    } catch {
      toast.error('Kon agendapunt niet toevoegen')
    }
  }

  const handleAddAction = async (topicId: string, description: string, responsibleName: string) => {
    try {
      const res = await fetch(`${basePath}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, responsibleName, topicId }),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      toast.error('Kon actiepunt niet toevoegen')
    }
  }

  const handleUpdateAction = async (actionId: string, data: { description?: string; responsibleName?: string; isCompleted?: boolean }) => {
    try {
      const res = await fetch(`${basePath}/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      toast.error('Kon actiepunt niet bijwerken')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    try {
      const res = await fetch(`${basePath}/actions/${actionId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const handleUpdateDistributions = async (dists: { partnerName: string; employeeName: string | null; employeeId: string | null }[]) => {
    try {
      const res = await fetch(`${basePath}/distributions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributions: dists }),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      toast.error('Kon werkverdeling niet bijwerken')
    }
  }

  // Orphaned actions = actions without a topicId (from old imports or general actions)
  const orphanedActions = actions.filter(a => !a.topicId)
  const allActions = actions
  const openActionsCount = allActions.filter(a => !a.isCompleted).length

  return (
    <div className="card overflow-hidden">
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 hover:from-yellow-500/15 hover:to-orange-500/10 transition-colors text-left"
      >
        <Icons.chevronRight size={16} className={`text-yellow-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
          <Icons.calendar className="text-yellow-400" size={16} />
        </div>
        <span className="font-medium text-yellow-200 flex-1">{dateLabel}</span>
        {openActionsCount > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400">
            {openActionsCount} open
          </span>
        )}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-5 space-y-6">
          {/* Topics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="grid grid-cols-[1fr_2fr_auto] gap-3 w-full text-xs font-medium text-gray-400 uppercase tracking-wider px-3">
                <span>Agenda</span>
                <span>Opmerkingen</span>
                <span className="w-10" />
              </div>
            </div>
            <div>
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  {...topic}
                  actions={allActions}
                  teamMembers={teamMembers}
                  onUpdate={handleUpdateTopic}
                  onDelete={handleDeleteTopic}
                  onAddAction={handleAddAction}
                  onUpdateAction={handleUpdateAction}
                  onDeleteAction={handleDeleteAction}
                />
              ))}
            </div>
            {/* Add topic */}
            {isAddingTopic ? (
              <div className="flex items-center gap-2 mt-2 px-3">
                <input
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') { setIsAddingTopic(false); setNewTopicTitle('') } }}
                  placeholder="Agendapunt titel..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                  autoFocus
                />
                <button onClick={handleAddTopic} className="p-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 transition-colors">
                  <Icons.check size={14} />
                </button>
                <button onClick={() => { setIsAddingTopic(false); setNewTopicTitle('') }} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">
                  <Icons.x size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTopic(true)}
                className="flex items-center gap-2 mt-2 px-3 py-2 text-sm text-gray-500 hover:text-workx-lime transition-colors"
              >
                <Icons.plus size={14} />
                <span>Agendapunt toevoegen</span>
              </button>
            )}
          </div>

          {/* Werkverdeling */}
          {distributions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-1">Werkverdelingsgesprekken</h4>
              <WerkverdelingTable
                distributions={distributions}
                employees={employees}
                onUpdate={handleUpdateDistributions}
              />
            </div>
          )}

          {/* Orphaned Actiepunten (without topic) */}
          {orphanedActions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                    <Icons.target className="text-orange-400" size={13} />
                  </div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actiepunten (algemeen)</h4>
                </div>
                <span className="text-xs text-gray-500">
                  {orphanedActions.filter(a => a.isCompleted).length}/{orphanedActions.length} afgerond
                </span>
              </div>

              <div className="space-y-1.5">
                {orphanedActions.map((action) => {
                  const names = action.responsibleName.split(',').map(n => n.trim()).filter(Boolean)
                  return (
                    <div key={action.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors group/action">
                      <button
                        onClick={() => handleUpdateAction(action.id, { isCompleted: !action.isCompleted })}
                        className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                          action.isCompleted
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5'
                        }`}
                      >
                        {action.isCompleted && <Icons.check size={12} className="text-green-400" />}
                      </button>
                      <span className={`text-sm flex-1 ${action.isCompleted ? 'text-gray-500 line-through' : 'text-white/80'}`}>
                        {action.description}
                      </span>
                      <div className="flex items-center gap-2">
                        {names.map((name) => {
                          const photo = getPhotoUrl(name)
                          return photo ? (
                            <img key={name} src={photo} alt={name} className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/10" title={name} />
                          ) : (
                            <span key={name} className="text-[11px] px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-400 font-medium">{name}</span>
                          )
                        })}
                        <button
                          onClick={() => handleDeleteAction(action.id)}
                          className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover/action:opacity-100 transition-all"
                        >
                          <Icons.trash size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
