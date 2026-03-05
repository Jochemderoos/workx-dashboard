'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import ExpandableText from '@/components/ui/ExpandableText'
import { getPhotoUrl, PARTNERS, ADVOCATEN } from '@/lib/team-photos'

// Team members voor waarnemer dropdown (exclusief Hanna en Lotte)
const WAARNEMER_OPTIONS = [...PARTNERS, ...ADVOCATEN].filter(
  n => n !== 'Hanna Blaauboer' && n !== 'Lotte van Sint Truiden'
)

interface HandoverCase {
  id?: string
  dossiernaam: string
  contactpersoon: string | null
  beschrijving: string | null
  waarnemers: string
}

interface Handover {
  id: string
  userId: string
  periodStart: string
  periodEnd: string
  note: string | null
  user: { id: string; name: string; avatarUrl: string | null }
  cases: HandoverCase[]
}

interface CurrentUser {
  id: string
  name: string
  role: string
}

// ─── Waarnemer multi-select dropdown (portal-based) ───

interface WaarnemerDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  selectedNames: string[]
  onToggle: (name: string) => void
  onClose: () => void
}

function WaarnemerDropdown({ anchorRef, selectedNames, onToggle, onClose }: WaarnemerDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownHeight = 280
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    const minWidth = 260
    const dropdownWidth = Math.max(rect.width, minWidth)
    const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)

    setStyle({
      position: 'fixed',
      left: Math.max(8, left),
      width: dropdownWidth,
      top: showAbove ? undefined : rect.bottom + 4,
      bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
      zIndex: 9999,
    })
  }, [anchorRef])

  useEffect(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="bg-workx-dark border border-white/10 rounded-lg shadow-2xl py-1 max-h-64 overflow-y-auto"
    >
      {WAARNEMER_OPTIONS.map((name) => {
        const isSelected = selectedNames.includes(name)
        const photo = getPhotoUrl(name)
        return (
          <button
            key={name}
            onClick={() => onToggle(name)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              isSelected ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
              isSelected ? 'bg-workx-lime/20 border-workx-lime/50' : 'border-white/20'
            }`}>
              {isSelected && <Icons.check size={10} className="text-workx-lime" />}
            </div>
            {photo && (
              <img src={photo} alt={name} className="w-5 h-5 rounded-md object-cover" />
            )}
            <span>{name}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// ─── Persoon selectie dropdown voor nieuw document ───

interface PersonDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  selected: string | null
  onSelect: (name: string, userId: string) => void
  onClose: () => void
  teamMembers: { id: string; name: string }[]
}

function PersonDropdown({ anchorRef, selected, onSelect, onClose, teamMembers }: PersonDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownHeight = 300
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    const minWidth = 260
    const dropdownWidth = Math.max(rect.width, minWidth)
    const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)

    setStyle({
      position: 'fixed',
      left: Math.max(8, left),
      width: dropdownWidth,
      top: showAbove ? undefined : rect.bottom + 4,
      bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
      zIndex: 9999,
    })
  }, [anchorRef])

  useEffect(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="bg-workx-dark border border-white/10 rounded-lg shadow-2xl py-1 max-h-72 overflow-y-auto"
    >
      {teamMembers.map((member) => {
        const isSelected = selected === member.name
        const photo = getPhotoUrl(member.name)
        return (
          <button
            key={member.id}
            onClick={() => { onSelect(member.name, member.id); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              isSelected ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {photo && (
              <img src={photo} alt={member.name} className="w-6 h-6 rounded-md object-cover" />
            )}
            {!photo && (
              <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                {member.name.charAt(0)}
              </div>
            )}
            <span>{member.name}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// ─── Delete confirmation modal ───

function DeleteModal({ onConfirm, onCancel, userName }: { onConfirm: () => void; onCancel: () => void; userName: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-workx-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-2">Document verwijderen?</h3>
        <p className="text-gray-400 text-sm mb-6">
          Weet je zeker dat je het overdrachtsdocument van <span className="text-white font-medium">{userName}</span> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all">
            Annuleren
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm transition-all">
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New document modal ───

function NewDocumentModal({
  teamMembers,
  onSave,
  onCancel,
}: {
  teamMembers: { id: string; name: string }[]
  onSave: (data: { userId: string; periodStart: string; periodEnd: string; note: string }) => void
  onCancel: () => void
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [periodStartDate, setPeriodStartDate] = useState<Date | null>(null)
  const [periodEndDate, setPeriodEndDate] = useState<Date | null>(null)
  const [note, setNote] = useState('')
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const personBtnRef = useRef<HTMLButtonElement>(null)

  const formatToISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-[12vh] overflow-y-auto" onClick={onCancel}>
      <div className="bg-workx-dark border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl mb-8" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Nieuw overdrachtsdocument</h3>

        <div className="space-y-4">
          {/* Persoon */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Persoon</label>
            <button
              ref={personBtnRef}
              onClick={() => setShowPersonDropdown(!showPersonDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/20 transition-colors"
            >
              {selectedName ? (
                <div className="flex items-center gap-2">
                  {getPhotoUrl(selectedName) && (
                    <img src={getPhotoUrl(selectedName)!} alt={selectedName} className="w-5 h-5 rounded-md object-cover" />
                  )}
                  <span>{selectedName}</span>
                </div>
              ) : (
                <span className="text-gray-500">Selecteer persoon...</span>
              )}
              <Icons.chevronDown size={14} className="text-gray-500" />
            </button>
            {showPersonDropdown && (
              <PersonDropdown
                anchorRef={personBtnRef}
                selected={selectedName}
                onSelect={(name, userId) => { setSelectedName(name); setSelectedUserId(userId) }}
                onClose={() => setShowPersonDropdown(false)}
                teamMembers={teamMembers}
              />
            )}
          </div>

          {/* Periode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Van</label>
              <DatePicker
                selected={periodStartDate}
                onChange={setPeriodStartDate}
                placeholder="Startdatum..."
                maxDate={periodEndDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Tot</label>
              <DatePicker
                selected={periodEndDate}
                onChange={setPeriodEndDate}
                placeholder="Einddatum..."
                minDate={periodStartDate || undefined}
              />
            </div>
          </div>

          {/* Notitie */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Notitie (optioneel)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-workx-lime/50 resize-none"
              placeholder="Bijv. 'Verlof tot 15 maart'"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all">
            Annuleren
          </button>
          <button
            onClick={() => {
              if (selectedUserId && periodStartDate && periodEndDate) {
                onSave({ userId: selectedUserId, periodStart: formatToISO(periodStartDate), periodEnd: formatToISO(periodEndDate), note })
              }
            }}
            disabled={!selectedUserId || !periodStartDate || !periodEndDate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Icons.plus size={14} />
            Aanmaken
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Waarnemer badges (read-only display + remove) ───

function WaarnemerBadges({
  waarnemers,
  onRemove,
  onOpenDropdown,
  buttonRef,
}: {
  waarnemers: string[]
  onRemove: (name: string) => void
  onOpenDropdown: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {waarnemers.map(name => {
        const photo = getPhotoUrl(name)
        return (
          <div key={name} className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-lg bg-workx-lime/10 border border-workx-lime/20">
            {photo ? (
              <img src={photo} alt={name} className="w-4 h-4 rounded object-cover" />
            ) : (
              <div className="w-4 h-4 rounded bg-workx-lime/20 flex items-center justify-center text-workx-lime text-[8px] font-bold">
                {name.charAt(0)}
              </div>
            )}
            <span className="text-[11px] text-workx-lime font-medium">{name.split(' ')[0]}</span>
            <button
              onClick={() => onRemove(name)}
              className="p-0.5 rounded hover:bg-white/10 text-workx-lime/60 hover:text-workx-lime transition-colors"
            >
              <Icons.x size={8} />
            </button>
          </div>
        )
      })}
      <button
        ref={buttonRef}
        onClick={onOpenDropdown}
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all text-[11px]"
      >
        <Icons.plus size={10} />
      </button>
    </div>
  )
}

// ─── Case row component ───

function CaseRow({
  caseData,
  caseKey,
  onUpdate,
  onDelete,
  onOpenDropdown,
  waarnemerBtnRef,
}: {
  caseData: HandoverCase
  caseKey: string
  onUpdate: (updated: HandoverCase) => void
  onDelete: () => void
  onOpenDropdown: () => void
  waarnemerBtnRef: (el: HTMLButtonElement | null) => void
}) {
  const waarnemerNames = caseData.waarnemers ? caseData.waarnemers.split(', ').filter(Boolean) : []

  const handleRemoveWaarnemer = (name: string) => {
    const newNames = waarnemerNames.filter(n => n !== name)
    onUpdate({ ...caseData, waarnemers: newNames.join(', ') })
  }

  return (
    <>
      {/* Desktop: grid row */}
      <div className="hidden sm:grid grid-cols-[1fr_0.8fr_1.5fr_1fr_auto] gap-3 px-4 py-3 items-start hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-b-0">
        <input
          value={caseData.dossiernaam}
          onChange={e => onUpdate({ ...caseData, dossiernaam: e.target.value })}
          className="bg-transparent text-sm text-white border-b border-transparent hover:border-white/10 focus:border-workx-lime/50 focus:outline-none py-0.5 w-full"
          placeholder="Dossiernaam"
        />
        <input
          value={caseData.contactpersoon || ''}
          onChange={e => onUpdate({ ...caseData, contactpersoon: e.target.value || null })}
          className="bg-transparent text-sm text-gray-400 border-b border-transparent hover:border-white/10 focus:border-workx-lime/50 focus:outline-none py-0.5 w-full"
          placeholder="Contactpersoon"
        />
        <ExpandableText
          text={caseData.beschrijving}
          onChange={val => onUpdate({ ...caseData, beschrijving: val || null })}
          placeholder="Status / beschrijving"
          maxLines={2}
        />
        <WaarnemerBadges
          waarnemers={waarnemerNames}
          onRemove={handleRemoveWaarnemer}
          onOpenDropdown={onOpenDropdown}
          buttonRef={waarnemerBtnRef}
        />
        <button
          onClick={onDelete}
          className="p-1 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors mt-0.5"
        >
          <Icons.trash size={14} />
        </button>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden px-3 py-3 border-b border-white/5 last:border-b-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <input
              value={caseData.dossiernaam}
              onChange={e => onUpdate({ ...caseData, dossiernaam: e.target.value })}
              className="bg-transparent text-sm font-medium text-white border-b border-transparent focus:border-workx-lime/50 focus:outline-none py-0.5 w-full"
              placeholder="Dossiernaam"
            />
            <input
              value={caseData.contactpersoon || ''}
              onChange={e => onUpdate({ ...caseData, contactpersoon: e.target.value || null })}
              className="bg-transparent text-xs text-gray-500 border-b border-transparent focus:border-workx-lime/50 focus:outline-none py-0.5 w-full"
              placeholder="Contactpersoon"
            />
          </div>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <Icons.trash size={14} />
          </button>
        </div>
        {caseData.beschrijving ? (
          <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{caseData.beschrijving}</p>
        ) : (
          <p className="text-xs text-white/20 italic">Geen beschrijving</p>
        )}
        <WaarnemerBadges
          waarnemers={waarnemerNames}
          onRemove={handleRemoveWaarnemer}
          onOpenDropdown={onOpenDropdown}
          buttonRef={waarnemerBtnRef}
        />
      </div>
    </>
  )
}

// ─── Format date helpers ───

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Main page ───

export default function OverdrachtPage() {
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([])
  const [editedCases, setEditedCases] = useState<Record<string, HandoverCase[]>>({})
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [openWaarnemerDropdown, setOpenWaarnemerDropdown] = useState<string | null>(null) // caseKey
  const waarnemerBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Fetch user + handovers + team
  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, handoverRes, teamRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/handovers'),
          fetch('/api/responsibilities'),
        ])

        if (userRes.ok) {
          const user = await userRes.json()
          setCurrentUser({ id: user.id, name: user.name, role: user.role })
        }

        if (handoverRes.ok) {
          const data = await handoverRes.json()
          setHandovers(data)
          if (data.length > 0 && !activeTab) {
            setActiveTab(data[0].id)
          }
        }

        if (teamRes.ok) {
          const { teamMembers: tm } = await teamRes.json()
          setTeamMembers(tm)
        }
      } catch (error) {
        console.error('Laden mislukt:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Get cases for editing (local state)
  const getCases = (handoverId: string): HandoverCase[] => {
    if (editedCases[handoverId]) return editedCases[handoverId]
    const h = handovers.find(h => h.id === handoverId)
    return h?.cases || []
  }

  const updateLocalCase = (handoverId: string, index: number, updated: HandoverCase) => {
    const cases = [...getCases(handoverId)]
    cases[index] = updated
    setEditedCases(prev => ({ ...prev, [handoverId]: cases }))
    setHasChanges(prev => ({ ...prev, [handoverId]: true }))
  }

  const deleteLocalCase = (handoverId: string, index: number) => {
    const cases = getCases(handoverId).filter((_, i) => i !== index)
    setEditedCases(prev => ({ ...prev, [handoverId]: cases }))
    setHasChanges(prev => ({ ...prev, [handoverId]: true }))
  }

  const addLocalCase = (handoverId: string) => {
    const cases = [...getCases(handoverId), { dossiernaam: '', contactpersoon: null, beschrijving: null, waarnemers: '' }]
    setEditedCases(prev => ({ ...prev, [handoverId]: cases }))
    setHasChanges(prev => ({ ...prev, [handoverId]: true }))
  }

  const handleToggleWaarnemer = (handoverId: string, caseIndex: number, name: string) => {
    const cases = getCases(handoverId)
    const c = cases[caseIndex]
    const current = c.waarnemers ? c.waarnemers.split(', ').filter(Boolean) : []
    const newNames = current.includes(name)
      ? current.filter(n => n !== name)
      : [...current, name]
    updateLocalCase(handoverId, caseIndex, { ...c, waarnemers: newNames.join(', ') })
  }

  const cancelChanges = (handoverId: string) => {
    setEditedCases(prev => {
      const next = { ...prev }
      delete next[handoverId]
      return next
    })
    setHasChanges(prev => ({ ...prev, [handoverId]: false }))
  }

  // Save changes
  const saveHandover = async (handoverId: string) => {
    const cases = getCases(handoverId)
    setIsSaving(true)
    try {
      const h = handovers.find(h => h.id === handoverId)
      if (!h) return

      const res = await fetch(`/api/handovers/${handoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: h.periodStart,
          periodEnd: h.periodEnd,
          note: h.note,
          cases: cases.filter(c => c.dossiernaam.trim()).map(c => ({
            dossiernaam: c.dossiernaam,
            contactpersoon: c.contactpersoon,
            beschrijving: c.beschrijving,
            waarnemers: c.waarnemers,
          })),
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setHandovers(prev => prev.map(h => h.id === handoverId ? updated : h))
        setEditedCases(prev => {
          const next = { ...prev }
          delete next[handoverId]
          return next
        })
        setHasChanges(prev => ({ ...prev, [handoverId]: false }))
      }
    } catch (error) {
      console.error('Opslaan mislukt:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Create new document
  const createHandover = async (data: { userId: string; periodStart: string; periodEnd: string; note: string }) => {
    try {
      const res = await fetch('/api/handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, cases: [] }),
      })

      if (res.ok) {
        const newHandover = await res.json()
        setHandovers(prev => [...prev, newHandover])
        setActiveTab(newHandover.id)
        setShowNewModal(false)
      }
    } catch (error) {
      console.error('Aanmaken mislukt:', error)
    }
  }

  // Delete document
  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/handovers/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setHandovers(prev => prev.filter(h => h.id !== deleteId))
        if (activeTab === deleteId) {
          setActiveTab(handovers.find(h => h.id !== deleteId)?.id || null)
        }
        setDeleteId(null)
      }
    } catch (error) {
      console.error('Verwijderen mislukt:', error)
    }
  }

  // "Mijn Waarnemingen" — zoek zaken waar ingelogde gebruiker als waarnemer staat
  const myObservations = currentUser
    ? handovers.flatMap(h =>
        h.cases
          .filter(c => {
            const names = c.waarnemers.split(', ').map(n => n.trim().toLowerCase())
            const myName = currentUser.name.toLowerCase()
            // Match on full name or first name
            return names.some(n => n === myName || n === myName.split(' ')[0].toLowerCase())
          })
          .map(c => ({ ...c, fromUser: h.user.name, handoverId: h.id }))
      )
    : []

  // Search results — zoek over ALLE overdrachten
  const searchResults = searchQuery.trim().length >= 2
    ? handovers.flatMap(h =>
        h.cases
          .filter(c => {
            const q = searchQuery.toLowerCase()
            return (
              c.dossiernaam.toLowerCase().includes(q) ||
              (c.contactpersoon && c.contactpersoon.toLowerCase().includes(q)) ||
              (c.beschrijving && c.beschrijving.toLowerCase().includes(q)) ||
              c.waarnemers.toLowerCase().includes(q)
            )
          })
          .map(c => ({
            ...c,
            fromUser: h.user.name,
            handoverId: h.id,
            periodStart: h.periodStart,
            periodEnd: h.periodEnd,
          }))
      )
    : null

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-gray-400">Laden...</p>
        </div>
      </div>
    )
  }

  const activeHandover = handovers.find(h => h.id === activeTab)

  return (
    <div className="space-y-6 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center">
            <Icons.fileText className="text-purple-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Overdracht</h1>
            <p className="text-sm text-gray-500">Waarneming bij afwezigheid</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all"
        >
          <Icons.plus size={16} />
          Nieuw document
        </button>
      </div>

      {/* Search bar — prominent with lime glow */}
      <div className="relative group/search">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-workx-lime/40 via-yellow-400/30 to-workx-lime/40 rounded-2xl blur-md opacity-70 group-hover/search:opacity-100 transition-opacity pointer-events-none" />
        <div className="relative flex items-center bg-workx-dark/95 rounded-2xl border border-workx-lime/30 px-4 py-3 gap-3">
          <Icons.search size={18} className="text-workx-lime flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Zoek in alle overdrachten (dossiernaam, contactpersoon, beschrijving, waarnemer)..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <Icons.x size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Mijn Waarnemingen */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icons.eye size={14} />
          Mijn Waarnemingen
        </h2>
        {myObservations.length === 0 ? (
          <p className="text-gray-500 text-sm">Je hebt momenteel geen waarnemingen</p>
        ) : (
          <div className="grid gap-2">
            {myObservations.map((obs, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-purple-500/20 transition-colors cursor-pointer"
                onClick={() => setActiveTab(obs.handoverId)}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icons.briefcase size={14} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{obs.dossiernaam}</span>
                    <span className="text-[10px] text-gray-500">van {obs.fromUser}</span>
                  </div>
                  {obs.contactpersoon && (
                    <span className="text-xs text-gray-500">Contact: {obs.contactpersoon}</span>
                  )}
                  {obs.beschrijving && (
                    <ExpandableText
                      text={obs.beschrijving}
                      maxLines={3}
                      readOnly
                      className="mt-1 [&_p]:!text-xs [&_p]:!text-gray-400"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search results */}
      {searchResults !== null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Icons.search size={14} className="text-purple-400" />
            <span className="text-sm text-gray-400">
              {searchResults.length === 0
                ? `Geen resultaten voor "${searchQuery}"`
                : `${searchResults.length} resultaat${searchResults.length !== 1 ? 'en' : ''} voor "${searchQuery}"`
              }
            </span>
          </div>
          {searchResults.map((result, i) => {
            const waarnemerNames = result.waarnemers ? result.waarnemers.split(', ').filter(Boolean) : []
            return (
              <div
                key={`${result.handoverId}-${result.id || i}`}
                className="rounded-2xl border border-white/10 bg-white/[0.02] hover:border-purple-500/20 transition-colors cursor-pointer overflow-hidden"
                onClick={() => { setActiveTab(result.handoverId); setSearchQuery('') }}
              >
                {/* Top: van wie + periode */}
                <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.01] flex items-center gap-2.5">
                  {getPhotoUrl(result.fromUser) && (
                    <img src={getPhotoUrl(result.fromUser)!} alt={result.fromUser} className="w-6 h-6 rounded-lg object-cover" />
                  )}
                  <span className="text-xs text-gray-500">
                    Overdracht van <span className="text-white font-medium">{result.fromUser}</span>
                  </span>
                  <span className="text-[10px] text-gray-600 ml-auto">
                    {formatDateShort(result.periodStart)} - {formatDateShort(result.periodEnd)}
                  </span>
                </div>
                {/* Content */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{result.dossiernaam}</p>
                      {result.contactpersoon && (
                        <p className="text-xs text-gray-500 mt-0.5">Contact: {result.contactpersoon}</p>
                      )}
                    </div>
                  </div>
                  {result.beschrijving && (
                    <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed line-clamp-3">{result.beschrijving}</p>
                  )}
                  {/* Waarnemer(s) — prominent */}
                  {waarnemerNames.length > 0 ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">Waarnemer{waarnemerNames.length > 1 ? 's' : ''}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {waarnemerNames.map(name => {
                          const photo = getPhotoUrl(name)
                          return (
                            <div key={name} className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              {photo ? (
                                <img src={photo} alt={name} className="w-5 h-5 rounded-md object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-300 text-[9px] font-bold">
                                  {name.charAt(0)}
                                </div>
                              )}
                              <span className="text-xs text-purple-300 font-medium">{name.split(' ')[0]}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Waarnemer</span>
                      <span className="text-xs text-gray-600 italic">Niet toegewezen</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Tabs + Content */}
      {searchResults !== null ? null : handovers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Icons.fileText size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Geen overdrachtsdocumenten</p>
          <p className="text-sm mt-1">Maak een nieuw document aan om te beginnen</p>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5">
            {handovers.map(h => (
              <button
                key={h.id}
                onClick={() => setActiveTab(h.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === h.id
                    ? 'bg-white/[0.05] text-white border-b-2 border-workx-lime'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                }`}
              >
                {getPhotoUrl(h.user.name) && (
                  <img src={getPhotoUrl(h.user.name)!} alt={h.user.name} className="w-5 h-5 rounded-md object-cover" />
                )}
                <span>{h.user.name.split(' ')[0]}</span>
                <span className="text-[10px] text-gray-600">
                  {formatDateShort(h.periodStart)} - {formatDateShort(h.periodEnd)}
                </span>
              </button>
            ))}
          </div>

          {/* Active document */}
          {activeHandover && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              {/* Document header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getPhotoUrl(activeHandover.user.name) && (
                    <img
                      src={getPhotoUrl(activeHandover.user.name)!}
                      alt={activeHandover.user.name}
                      className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10"
                    />
                  )}
                  <div>
                    <h3 className="text-white font-semibold">{activeHandover.user.name}</h3>
                    <p className="text-xs text-gray-500">
                      {formatDateLong(activeHandover.periodStart)} — {formatDateLong(activeHandover.periodEnd)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(activeHandover.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
                >
                  <Icons.trash size={12} />
                  Verwijderen
                </button>
              </div>

              {/* Note */}
              {activeHandover.note && (
                <div className="px-5 py-3 border-b border-white/5 bg-blue-500/5">
                  <p className="text-sm text-blue-300">{activeHandover.note}</p>
                </div>
              )}

              {/* Cases table header (desktop only) */}
              <div className="hidden sm:grid grid-cols-[1fr_0.8fr_1.5fr_1fr_auto] gap-3 px-4 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5 bg-white/[0.01]">
                <span>Dossiernaam</span>
                <span>Contactpersoon</span>
                <span>Beschrijving / status</span>
                <span>Waarnemer(s)</span>
                <span className="w-6" />
              </div>

              {/* Cases */}
              <div>
                {getCases(activeHandover.id).map((c, i) => {
                  const caseKey = `${activeHandover.id}-${c.id || `new-${i}`}`
                  return (
                    <CaseRow
                      key={c.id || `new-${i}`}
                      caseData={c}
                      caseKey={caseKey}
                      onUpdate={(updated) => updateLocalCase(activeHandover.id, i, updated)}
                      onDelete={() => deleteLocalCase(activeHandover.id, i)}
                      onOpenDropdown={() => setOpenWaarnemerDropdown(openWaarnemerDropdown === caseKey ? null : caseKey)}
                      waarnemerBtnRef={(el) => { waarnemerBtnRefs.current[caseKey] = el }}
                    />
                  )
                })}
              </div>

              {/* Waarnemer dropdown — rendered at parent level like WerkverdelingTable */}
              {openWaarnemerDropdown && waarnemerBtnRefs.current[openWaarnemerDropdown] && (() => {
                // Parse handoverId and caseIndex from the key
                const parts = openWaarnemerDropdown.split('-')
                const handoverId = activeHandover.id
                const cases = getCases(handoverId)
                const caseIndex = cases.findIndex((c, i) => {
                  const key = `${handoverId}-${c.id || `new-${i}`}`
                  return key === openWaarnemerDropdown
                })
                if (caseIndex === -1) return null
                const c = cases[caseIndex]
                const selectedNames = c.waarnemers ? c.waarnemers.split(', ').filter(Boolean) : []
                return (
                  <WaarnemerDropdown
                    anchorRef={{ current: waarnemerBtnRefs.current[openWaarnemerDropdown] }}
                    selectedNames={selectedNames}
                    onToggle={(name) => handleToggleWaarnemer(handoverId, caseIndex, name)}
                    onClose={() => setOpenWaarnemerDropdown(null)}
                  />
                )
              })()}

              {/* Add row + Save/Cancel */}
              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={() => addLocalCase(activeHandover.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-xs transition-all"
                >
                  <Icons.plus size={12} />
                  Dossier toevoegen
                </button>

                {hasChanges[activeHandover.id] && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cancelChanges(activeHandover.id)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={() => saveHandover(activeHandover.id)}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                          Opslaan...
                        </>
                      ) : (
                        <>
                          <Icons.check size={14} />
                          Opslaan
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewDocumentModal
          teamMembers={teamMembers}
          onSave={createHandover}
          onCancel={() => setShowNewModal(false)}
        />
      )}
      {deleteId && (
        <DeleteModal
          userName={handovers.find(h => h.id === deleteId)?.user.name || ''}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
