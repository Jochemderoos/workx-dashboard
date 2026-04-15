'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import { useTeam } from '@/lib/hooks/useData'
import { getAnnouncementIcon } from '@/lib/announcement-icon'

interface TeamMember {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
}

export interface AnnouncementInitial {
  id: string
  title: string | null
  message: string
  recipients: string // "ALL" or JSON array
  priority: string
  icon: string | null
}

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  initial?: AnnouncementInitial | null
  onSaved?: () => void
}

const ICON_CHOICES = [
  '📢', '🚨', '🎉', '🥂', '🎁', '🎂', '🍰', '💐',
  '🍻', '🍕', '🍽️', '☕', '👋', '👶', '💍', '🤝',
  '📅', '⏰', '🎓', '📁', '📄', '🧾', '💶', '⚖️',
  '🌴', '🤒', '🏢', '💻', '🖨️', '📧', '📞', '🚗',
  '🚲', '🚆', '☀️', '🌧️', '🙏', '⭐', '❤️', '✅',
]

export function AnnouncementModal({ isOpen, onClose, initial, onSaved }: AnnouncementModalProps) {
  const isEdit = !!initial
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [icon, setIcon] = useState<string | null>(null)
  const [iconAuto, setIconAuto] = useState(true) // true = let getAnnouncementIcon decide
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const { data: teamData } = useTeam()

  const teamMembers: TeamMember[] = (teamData || []).filter(
    (m: TeamMember) => m.role !== 'EXTERNAL'
  )

  // Reset / load state when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setTitle(initial.title ?? '')
      setMessage(initial.message)
      setPriority((initial.priority === 'urgent' ? 'urgent' : 'normal') as 'normal' | 'urgent')
      setIcon(initial.icon)
      setIconAuto(initial.icon === null)
      if (initial.recipients === 'ALL') {
        setSelectedIds(teamMembers.map((m) => m.id))
      } else {
        try {
          const ids = JSON.parse(initial.recipients)
          setSelectedIds(Array.isArray(ids) ? ids : [])
        } catch {
          setSelectedIds([])
        }
      }
    } else {
      setTitle('')
      setMessage('')
      setSelectedIds([])
      setPriority('normal')
      setIcon(null)
      setIconAuto(true)
    }
    setSending(false)
    setSuccess(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initial])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const allSelected = teamMembers.length > 0 && selectedIds.length === teamMembers.length
  const previewIcon = iconAuto ? getAnnouncementIcon(message, priority) : (icon || '📢')

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(teamMembers.map((m) => m.id))
    }
  }

  const handleSend = async () => {
    if (!message.trim() || selectedIds.length === 0) return

    setSending(true)
    try {
      const recipientIds = allSelected ? ['ALL'] : selectedIds
      const payload = {
        title: title.trim() || null,
        message,
        recipientIds,
        priority,
        icon: iconAuto ? null : icon,
      }

      const res = await fetch(
        isEdit ? `/api/announcements/${initial!.id}` : '/api/announcements',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (res.ok) {
        setSuccess(true)
        onSaved?.()
        setTimeout(() => {
          onClose()
        }, 1200)
      }
    } catch (error) {
      console.error('Error saving announcement:', error)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-workx-gray border border-white/10 rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(700px, calc(100vh - 2rem))' }}
      >
        {/* Fixed header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center">
              <span className="text-lg">{previewIcon}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEdit ? 'Melding bewerken' : 'Melding versturen'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? 'Werk de melding bij' : 'Stuur een bericht naar het team'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icons.x size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto workx-scrollbar p-5 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-workx-lime/20 flex items-center justify-center mb-4">
                <Icons.check size={32} className="text-workx-lime" />
              </div>
              <p className="text-lg font-semibold text-white">
                {isEdit ? 'Melding bijgewerkt!' : 'Melding verstuurd!'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {isEdit ? 'De wijzigingen zijn opgeslagen' : 'Het team is op de hoogte gebracht'}
              </p>
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Titel <span className="text-gray-500 font-normal">(optioneel)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="bv. Lustrum Alert"
                  maxLength={60}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Leeg laten = jouw naam wordt gebruikt als titel.
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bericht</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Typ je melding..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all resize-none"
                />
              </div>

              {/* Icon picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Icoon</label>
                  <button
                    onClick={() => {
                      setIconAuto(true)
                      setIcon(null)
                    }}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                      iconAuto
                        ? 'bg-workx-lime/20 text-workx-lime border border-workx-lime/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Auto
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {ICON_CHOICES.map((emoji) => {
                    const isSelected = !iconAuto && icon === emoji
                    return (
                      <button
                        key={emoji}
                        onClick={() => {
                          setIcon(emoji)
                          setIconAuto(false)
                        }}
                        className={`aspect-square flex items-center justify-center rounded-xl text-lg transition-all ${
                          isSelected
                            ? 'bg-workx-lime/20 border border-workx-lime/60 ring-1 ring-workx-lime/30'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Priority toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prioriteit</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPriority('normal')}
                    className={`flex-1 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                      priority === 'normal'
                        ? 'bg-workx-lime/20 text-workx-lime border border-workx-lime/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Normaal
                  </button>
                  <button
                    onClick={() => setPriority('urgent')}
                    className={`flex-1 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                      priority === 'urgent'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              {/* Team member selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    Ontvangers ({selectedIds.length}/{teamMembers.length})
                  </label>
                  <button
                    onClick={selectAll}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                      allSelected
                        ? 'bg-workx-lime/20 text-workx-lime border border-workx-lime/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {allSelected ? 'Deselecteer iedereen' : 'Selecteer iedereen'}
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {teamMembers.map((member) => {
                    const isSelected = selectedIds.includes(member.id)
                    const photoUrl = getPhotoUrl(member.name, member.avatarUrl)
                    const initials = member.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()

                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${
                          isSelected
                            ? 'bg-workx-lime/15 border border-workx-lime/40 ring-1 ring-workx-lime/20'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="relative">
                          {photoUrl ? (
                            <Image
                              src={photoUrl}
                              alt={member.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-workx-lime/30 to-workx-lime/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-workx-lime">{initials}</span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-workx-lime flex items-center justify-center">
                              <Icons.check size={12} className="text-workx-dark" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center truncate w-full ${
                          isSelected ? 'text-workx-lime font-medium' : 'text-gray-400'
                        }`}>
                          {member.name.split(' ')[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fixed footer */}
        {!success && (
          <div className="p-5 border-t border-white/10 flex-shrink-0">
            <button
              onClick={handleSend}
              disabled={!message.trim() || selectedIds.length === 0 || sending}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                !message.trim() || selectedIds.length === 0 || sending
                  ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                  : priority === 'urgent'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                    : 'bg-workx-lime hover:bg-workx-lime/90 text-workx-dark shadow-lg shadow-workx-lime/20'
              }`}
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <>
                  <Icons.send size={16} />
                  {isEdit ? 'Wijzigingen opslaan' : 'Verstuur melding'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default AnnouncementModal
