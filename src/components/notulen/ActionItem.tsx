'use client'

import { useState, useRef, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'

interface ActionItemProps {
  id: string
  description: string
  responsibleName: string
  isCompleted: boolean
  teamMembers: string[]
  onUpdate: (id: string, data: { description?: string; responsibleName?: string; isCompleted?: boolean }) => void
  onDelete: (id: string) => void
}

export default function ActionItem({ id, description, responsibleName, isCompleted, teamMembers, onUpdate, onDelete }: ActionItemProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [editDesc, setEditDesc] = useState(description)
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditingDesc && descRef.current) {
      descRef.current.focus()
      descRef.current.selectionStart = descRef.current.value.length
    }
  }, [isEditingDesc])

  const handleDescSave = () => {
    if (editDesc.trim() && editDesc !== description) {
      onUpdate(id, { description: editDesc.trim() })
    }
    setIsEditingDesc(false)
  }

  return (
    <div className={`flex items-start gap-3 py-2 px-3 rounded-lg group hover:bg-white/[0.02] transition-colors ${isCompleted ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={() => onUpdate(id, { isCompleted: !isCompleted })}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted
            ? 'bg-green-500/20 border-green-500/50 text-green-400'
            : 'border-white/20 hover:border-workx-lime/50'
        }`}
      >
        {isCompleted && <Icons.check size={12} />}
      </button>

      {/* Description */}
      <div className="flex-1 min-w-0">
        {isEditingDesc ? (
          <textarea
            ref={descRef}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onBlur={handleDescSave}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDescSave() } if (e.key === 'Escape') { setEditDesc(description); setIsEditingDesc(false) } }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/30 resize-none"
            rows={2}
          />
        ) : (
          <p
            onClick={() => setIsEditingDesc(true)}
            className={`text-sm cursor-pointer hover:text-workx-lime transition-colors ${isCompleted ? 'line-through text-gray-500' : 'text-white/80'}`}
          >
            {description}
          </p>
        )}
      </div>

      {/* Responsible dropdown */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowResponsibleDropdown(!showResponsibleDropdown)}
          className="px-2 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
        >
          {responsibleName || 'Wie?'}
        </button>
        {showResponsibleDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowResponsibleDropdown(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-workx-dark border border-white/10 rounded-lg shadow-xl py-1 w-40 max-h-48 overflow-y-auto">
              {teamMembers.map((name) => (
                <button
                  key={name}
                  onClick={() => { onUpdate(id, { responsibleName: name }); setShowResponsibleDropdown(false) }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    responsibleName === name ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(id)}
        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
      >
        <Icons.x size={14} />
      </button>
    </div>
  )
}
