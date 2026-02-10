'use client'

import { useState, useRef, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Action {
  id: string
  description: string
  responsibleName: string
  isCompleted: boolean
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
  onUpdateAction: (actionId: string, data: { description?: string; responsibleName?: string; isCompleted?: boolean }) => void
  onDeleteAction: (actionId: string) => void
  onAddAction: (topicId: string, description: string, responsibleName: string) => void
}

export default function TopicRow({
  id, title, remarks, isStandard, actions, teamMembers,
  onUpdate, onDelete, onUpdateAction, onDeleteAction, onAddAction,
}: TopicRowProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingRemarks, setIsEditingRemarks] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [editRemarks, setEditRemarks] = useState(remarks || '')
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [newActionDesc, setNewActionDesc] = useState('')
  const [newActionResponsible, setNewActionResponsible] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const remarksRef = useRef<HTMLTextAreaElement>(null)

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
    if (!newActionDesc.trim() || !newActionResponsible) return
    onAddAction(id, newActionDesc.trim(), newActionResponsible)
    setNewActionDesc('')
    setNewActionResponsible('')
    setIsAddingAction(false)
  }

  return (
    <div className="py-3 px-3 rounded-lg group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      {/* Main row: Agenda | Opmerkingen | Delete */}
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

        {/* Delete (niet voor standaard topics) */}
        <div className="flex items-start">
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
      {actions.length > 0 && (
        <div className="mt-2 ml-0 pl-3 border-l-2 border-orange-500/20 space-y-1.5">
          {actions.map((action) => {
            const photo = getPhotoUrl(action.responsibleName)
            return (
              <div key={action.id} className="flex items-center gap-2 group/action">
                <button
                  onClick={() => onUpdateAction(action.id, { isCompleted: !action.isCompleted })}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    action.isCompleted
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'border-orange-500/30 hover:border-orange-500/60'
                  }`}
                >
                  {action.isCompleted && <Icons.check size={10} className="text-green-400" />}
                </button>
                <span className={`text-xs flex-1 ${action.isCompleted ? 'text-gray-500 line-through' : 'text-orange-300/80'}`}>
                  {action.description}
                </span>
                {photo ? (
                  <img src={photo} alt={action.responsibleName} className="w-5 h-5 rounded-md object-cover ring-1 ring-white/10" title={action.responsibleName} />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">{action.responsibleName}</span>
                )}
                <button
                  onClick={() => onDeleteAction(action.id)}
                  className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover/action:opacity-100 transition-all"
                >
                  <Icons.x size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add action button / form */}
      {isAddingAction ? (
        <div className="mt-2 ml-0 pl-3 border-l-2 border-orange-500/20">
          <div className="flex items-center gap-2">
            <input
              value={newActionDesc}
              onChange={(e) => setNewActionDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newActionResponsible) handleAddAction(); if (e.key === 'Escape') { setIsAddingAction(false); setNewActionDesc(''); setNewActionResponsible('') } }}
              placeholder="Actiepunt..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500/30"
              autoFocus
            />
            <select
              value={newActionResponsible}
              onChange={(e) => setNewActionResponsible(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500/30"
            >
              <option value="">Wie?</option>
              {teamMembers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button
              onClick={handleAddAction}
              disabled={!newActionDesc.trim() || !newActionResponsible}
              className="p-1 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-30 transition-colors"
            >
              <Icons.check size={12} />
            </button>
            <button
              onClick={() => { setIsAddingAction(false); setNewActionDesc(''); setNewActionResponsible('') }}
              className="p-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
            >
              <Icons.x size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingAction(true)}
          className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100 pl-3"
        >
          <Icons.plus size={11} />
          Actiepunt
        </button>
      )}
    </div>
  )
}
