'use client'

import { useState, useRef, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'

interface TopicRowProps {
  id: string
  title: string
  remarks: string | null
  isStandard: boolean
  onUpdate: (id: string, data: { title?: string; remarks?: string }) => void
  onDelete: (id: string) => void
}

export default function TopicRow({ id, title, remarks, isStandard, onUpdate, onDelete }: TopicRowProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingRemarks, setIsEditingRemarks] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [editRemarks, setEditRemarks] = useState(remarks || '')
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

  return (
    <div className="grid grid-cols-[1fr_2fr_auto] gap-3 py-2.5 px-3 rounded-lg group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
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
  )
}
