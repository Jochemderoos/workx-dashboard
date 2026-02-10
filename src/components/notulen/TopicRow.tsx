'use client'

import { useState, useRef, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Action {
  id: string
  description: string
  responsibleName: string
  isCompleted: boolean
  topicId?: string | null
}

interface TopicRowProps {
  id: string
  title: string
  remarks: string | null
  isStandard: boolean
  actions: Action[]
  teamMembers: string[]
  onUpdate: (id: string, data: { title?: string; remarks?: string }) => void
  onDelete: (id: string) => void
  onAddAction: (topicId: string, description: string, responsibleName: string) => void
  onUpdateAction: (actionId: string, data: { description?: string; responsibleName?: string; isCompleted?: boolean }) => void
  onDeleteAction: (actionId: string) => void
}

export default function TopicRow({
  id, title, remarks, isStandard, actions, teamMembers,
  onUpdate, onDelete, onAddAction, onUpdateAction, onDeleteAction
}: TopicRowProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingRemarks, setIsEditingRemarks] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [editRemarks, setEditRemarks] = useState(remarks || '')
  const titleRef = useRef<HTMLInputElement>(null)
  const remarksRef = useRef<HTMLTextAreaElement>(null)

  // Add action state
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [newActionDesc, setNewActionDesc] = useState('')
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([])
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.selectionStart = titleRef.current.value.length
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (isEditingRemarks && remarksRef.current) {
      remarksRef.current.focus()
      remarksRef.current.selectionStart = remarksRef.current.value.length
    }
  }, [isEditingRemarks])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowResponsibleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== title) {
      onUpdate(id, { title: editTitle.trim() })
    }
    setIsEditingTitle(false)
  }

  const handleRemarksSave = () => {
    if (editRemarks !== (remarks || '')) {
      onUpdate(id, { remarks: editRemarks })
    }
    setIsEditingRemarks(false)
  }

  const handleAddAction = () => {
    if (!newActionDesc.trim() || selectedResponsibles.length === 0) return
    onAddAction(id, newActionDesc.trim(), selectedResponsibles.join(', '))
    setNewActionDesc('')
    setSelectedResponsibles([])
    setIsAddingAction(false)
  }

  const toggleResponsible = (name: string) => {
    setSelectedResponsibles(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const topicActions = actions.filter(a => a.topicId === id)

  return (
    <div className="py-3 px-3 rounded-lg group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      {/* Topic row: Title | Remarks | Delete */}
      <div className="grid grid-cols-[1fr_2fr_auto] gap-3">
        {/* Agenda titel */}
        <div className="min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setEditTitle(title); setIsEditingTitle(false) } }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/30"
            />
          ) : (
            <p
              onClick={() => !isStandard && setIsEditingTitle(true)}
              className={`text-sm font-medium truncate ${isStandard ? 'text-workx-lime/80' : 'text-white cursor-pointer hover:text-workx-lime'} transition-colors`}
            >
              {title}
            </p>
          )}
        </div>

        {/* Opmerkingen */}
        <div className="min-w-0">
          {isEditingRemarks ? (
            <textarea
              ref={remarksRef}
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              onBlur={handleRemarksSave}
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditRemarks(remarks || ''); setIsEditingRemarks(false) } }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/30 resize-none"
              rows={2}
            />
          ) : (
            <p
              onClick={() => setIsEditingRemarks(true)}
              className="text-sm text-gray-400 cursor-pointer hover:text-white transition-colors whitespace-pre-wrap"
            >
              {remarks || <span className="text-white/20 italic">Klik om opmerking toe te voegen...</span>}
            </p>
          )}
        </div>

        {/* Actions: add action + delete topic */}
        <div className="flex items-start gap-1">
          <button
            onClick={() => setIsAddingAction(!isAddingAction)}
            className="p-1 text-gray-500 hover:text-orange-400 transition-colors"
            title="Actiepunt toevoegen"
          >
            <Icons.target size={14} />
          </button>
          {!isStandard && (
            <button
              onClick={() => onDelete(id)}
              className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Icons.trash size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Actions for this topic */}
      {topicActions.length > 0 && (
        <div className="mt-2 ml-0 space-y-1">
          {topicActions.map((action) => {
            const names = action.responsibleName.split(',').map(n => n.trim()).filter(Boolean)
            return (
              <div key={action.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors group/action">
                <button
                  onClick={() => onUpdateAction(action.id, { isCompleted: !action.isCompleted })}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                    action.isCompleted
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'border-orange-500/30 hover:border-orange-500/60'
                  }`}
                >
                  {action.isCompleted && <Icons.check size={10} className="text-green-400" />}
                </button>
                <span className={`text-xs flex-1 ${action.isCompleted ? 'text-gray-500 line-through' : 'text-white/70'}`}>
                  {action.description}
                </span>
                <div className="flex items-center gap-1">
                  {names.map((name) => {
                    const photo = getPhotoUrl(name)
                    return photo ? (
                      <img key={name} src={photo} alt={name} className="w-5 h-5 rounded-md object-cover ring-1 ring-white/10" title={name} />
                    ) : (
                      <span key={name} className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-medium">{name}</span>
                    )
                  })}
                </div>
                <button
                  onClick={() => onDeleteAction(action.id)}
                  className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover/action:opacity-100 transition-all"
                >
                  <Icons.trash size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add action form */}
      {isAddingAction && (
        <div className="mt-2 ml-0 p-3 rounded-xl bg-orange-500/[0.03] border border-orange-500/10">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 mt-1.5 rounded border border-orange-500/20 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <input
                value={newActionDesc}
                onChange={(e) => setNewActionDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedResponsibles.length > 0) handleAddAction()
                  if (e.key === 'Escape') { setIsAddingAction(false); setNewActionDesc(''); setSelectedResponsibles([]) }
                }}
                placeholder="Wat moet er gebeuren?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/30 transition-all"
                autoFocus
              />
              <div className="flex items-center gap-2">
                {/* Multi-select responsible dropdown */}
                <div className="relative flex-1" ref={dropdownRef}>
                  <button
                    onClick={() => setShowResponsibleDropdown(!showResponsibleDropdown)}
                    className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-left hover:border-orange-500/30 transition-all"
                  >
                    {selectedResponsibles.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {selectedResponsibles.map(name => {
                          const photo = getPhotoUrl(name)
                          return (
                            <span key={name} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 text-xs font-medium">
                              {photo && <img src={photo} alt="" className="w-4 h-4 rounded-sm object-cover" />}
                              {name}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleResponsible(name) }}
                                className="hover:text-red-400 ml-0.5"
                              >
                                <Icons.x size={10} />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-white/30">Verantwoordelijke(n) kiezen...</span>
                    )}
                    <Icons.chevronDown size={14} className="ml-auto text-gray-500 flex-shrink-0" />
                  </button>
                  {showResponsibleDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-full bg-workx-gray border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                      <div className="py-1 max-h-48 overflow-y-auto">
                        {teamMembers.map((name) => {
                          const isSelected = selectedResponsibles.includes(name)
                          const photo = getPhotoUrl(name)
                          return (
                            <button
                              key={name}
                              onClick={() => toggleResponsible(name)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                isSelected ? 'bg-orange-500/10 text-orange-400' : 'text-white/70 hover:bg-white/5'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-orange-500/20 border-orange-500/50' : 'border-white/20'
                              }`}>
                                {isSelected && <Icons.check size={10} className="text-orange-400" />}
                              </div>
                              {photo ? (
                                <img src={photo} alt="" className="w-5 h-5 rounded-md object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">{name.charAt(0)}</div>
                              )}
                              {name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAddAction}
                  disabled={!newActionDesc.trim() || selectedResponsibles.length === 0}
                  className="px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 font-medium text-xs disabled:opacity-30 transition-all"
                >
                  Toevoegen
                </button>
                <button
                  onClick={() => { setIsAddingAction(false); setNewActionDesc(''); setSelectedResponsibles([]) }}
                  className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                >
                  <Icons.x size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
