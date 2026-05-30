'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'
import DatePicker from '@/components/ui/DatePicker'
import { getPhotoUrl } from '@/lib/team-photos'

// ── Types ──────────────────────────────────────────────

interface AgendaItem {
  id: string
  dayId: string
  title: string
  notes: string | null
  sortOrder: number
}

interface ActionItem {
  id: string
  dayId: string
  description: string
  responsibleName: string
  deadline: string | null
  isCompleted: boolean
  completedAt: string | null
}

interface WerkoverlegDay {
  id: string
  meetingDate: string
  dateLabel: string
  chairperson: string | null
  agendaItems?: AgendaItem[]
  actionItems?: ActionItem[]
  _count?: { agendaItems: number; actionItems: number }
}

// ── Constants ──────────────────────────────────────────

const TEAM_MEMBERS = [
  'Hele Team',
  'Marnix', 'Jochem', 'Maaike', 'Bas', 'Juliette', 'Hanna',
  'Justine', 'Marlieke', 'Wies', 'Emma', 'Alain', 'Kay',
  'Erika', 'Barbara', 'Julia', 'Heleen', 'Lotte'
]

const CHAIRPERSON_MEMBERS = TEAM_MEMBERS.filter(m => m !== 'Hele Team')

// ── Helpers ────────────────────────────────────────────

function getNextTuesday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay()
  const daysUntilTuesday = (2 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilTuesday)
  d.setHours(12, 0, 0, 0)
  return d
}

function getDeadlineColor(deadline: string | null, isCompleted: boolean): string {
  if (isCompleted || !deadline) return ''
  const now = new Date()
  const dl = new Date(deadline)
  const diff = dl.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0) return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (days < 3) return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
  return 'text-gray-400 bg-white/5 border-white/10'
}

function formatWeekLabel(dateLabel: string): string {
  // "Dinsdag 25 maart 2026" → "25 mrt"
  const parts = dateLabel.split(' ')
  if (parts.length >= 3) {
    const month = parts[2].substring(0, 3)
    return `${parts[1]} ${month}`
  }
  return dateLabel
}

// ── Person Dropdown (portal, no borders, photos) ───────

interface PersonDropdownProps {
  anchorRef: React.RefObject<HTMLElement | null>
  members: string[]
  selected: string | null
  onSelect: (name: string) => void
  onClose: () => void
}

function PersonDropdown({ anchorRef, members, selected, onSelect, onClose }: PersonDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownHeight = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    const width = Math.max(rect.width, 240)
    const left = Math.min(rect.left, window.innerWidth - width - 8)

    setStyle({
      position: 'fixed',
      left: Math.max(8, left),
      width,
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
      className="bg-workx-dark border border-white/10 rounded-xl shadow-2xl py-1 max-h-72 overflow-y-auto"
      role="listbox"
    >
      {members.map(name => {
        const photo = getPhotoUrl(name)
        const isSelected = selected === name
        return (
          <button
            key={name}
            onClick={() => { onSelect(name); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              isSelected ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {photo ? (
              <img loading="lazy" src={photo} alt={name} className="w-6 h-6 rounded-lg object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-workx-lime/10 flex items-center justify-center text-[10px] font-bold text-workx-lime">
                {name.charAt(0)}
              </div>
            )}
            <span className="flex-1 text-left">{name}</span>
            {isSelected && <Icons.check size={14} className="text-workx-lime" />}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// ── Component ──────────────────────────────────────────

export default function WerkoverlegPage() {
  const [allDays, setAllDays] = useState<WerkoverlegDay[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<WerkoverlegDay | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDay, setIsLoadingDay] = useState(false)
  const [activeTab, setActiveTab] = useState<'agenda' | 'acties'>('agenda')

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0)

  // Chair selection
  const [showChairSelect, setShowChairSelect] = useState(false)
  const [showChairEdit, setShowChairEdit] = useState(false)
  const chairEditRef = useRef<HTMLButtonElement>(null)
  const chairSelectRef = useRef<HTMLButtonElement>(null)

  // Action responsible dropdown
  const [showResponsibleFor, setShowResponsibleFor] = useState<string | null>(null)
  const responsibleRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Add agenda item
  const [newAgendaTitle, setNewAgendaTitle] = useState('')
  const [isAddingAgenda, setIsAddingAgenda] = useState(false)

  // Inline editing
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [editAgendaTitle, setEditAgendaTitle] = useState('')
  const [editAgendaNotes, setEditAgendaNotes] = useState('')

  // Add action
  const [newActionDesc, setNewActionDesc] = useState('')
  const [newActionResponsible, setNewActionResponsible] = useState('Hele Team')
  const [newActionDeadline, setNewActionDeadline] = useState<Date | null>(null)
  const [isAddingAction, setIsAddingAction] = useState(false)

  // Inline edit action
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [editActionDesc, setEditActionDesc] = useState('')

  // ── Data fetching ──────────────────────────────────

  const fetchDays = useCallback(async () => {
    try {
      const res = await fetch('/api/werkoverleg')
      if (res.ok) {
        const data = await res.json()
        setAllDays(data)
        if (!selectedDayId && data.length > 0) {
          setSelectedDayId(data[0].id)
        }
      }
    } catch {
      toast.error('Kon vergaderdagen niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [selectedDayId])

  const fetchDay = useCallback(async (dayId: string) => {
    setIsLoadingDay(true)
    try {
      const res = await fetch(`/api/werkoverleg/${dayId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedDay(data)
      }
    } catch {
      toast.error('Kon vergaderdag niet laden')
    } finally {
      setIsLoadingDay(false)
    }
  }, [])

  useEffect(() => { fetchDays() }, [fetchDays])

  useEffect(() => {
    if (selectedDayId) fetchDay(selectedDayId)
  }, [selectedDayId, fetchDay])

  // ── Week navigation ────────────────────────────────

  // allDays is sorted desc (newest first), reverse for navigation (oldest first → newest last)
  const sortedDays = [...allDays].reverse()
  const totalDays = sortedDays.length

  // Calculate visible window: show last 3 by default, offset moves backwards
  const endIndex = Math.max(0, totalDays - weekOffset)
  const startIndex = Math.max(0, endIndex - 3)
  const visibleDays = sortedDays.slice(startIndex, endIndex)

  const canGoBack = startIndex > 0
  const canGoForward = weekOffset > 0

  // ── Check if next week exists ──────────────────────

  const hasNextWeek = (): boolean => {
    if (!selectedDay) return false
    const currentDate = new Date(selectedDay.meetingDate)
    const nextTuesday = getNextTuesday(currentDate)
    return allDays.some(d => {
      const dd = new Date(d.meetingDate)
      return Math.abs(dd.getTime() - nextTuesday.getTime()) < 24 * 60 * 60 * 1000
    })
  }

  // ── Chairperson selection → create next week ──────

  const handleSelectChairperson = async (name: string) => {
    if (!selectedDay) return
    const currentDate = new Date(selectedDay.meetingDate)
    const nextTuesday = getNextTuesday(currentDate)

    try {
      const res = await fetch('/api/werkoverleg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingDate: nextTuesday.toISOString(),
          chairperson: name,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fout')
      }
      toast.success(`${name} is voorzitter volgende week`)
      setShowChairSelect(false)
      await fetchDays()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kon voorzitter niet instellen')
    }
  }

  // ── Update chairperson for current day ─────────────

  const handleUpdateChairperson = async (name: string) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chairperson: name }),
      })
      if (res.ok) {
        setSelectedDay({ ...selectedDay, chairperson: name })
        setAllDays(prev => prev.map(d => d.id === selectedDay.id ? { ...d, chairperson: name } : d))
        toast.success('Voorzitter bijgewerkt')
      }
    } catch {
      toast.error('Kon voorzitter niet bijwerken')
    }
  }

  // ── Agenda CRUD ────────────────────────────────────

  const handleAddAgenda = async () => {
    if (!newAgendaTitle.trim() || !selectedDay) return
    setIsAddingAgenda(true)
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newAgendaTitle }),
      })
      if (res.ok) {
        setNewAgendaTitle('')
        fetchDay(selectedDay.id)
      }
    } catch {
      toast.error('Kon agendapunt niet toevoegen')
    } finally {
      setIsAddingAgenda(false)
    }
  }

  const handleUpdateAgenda = async (itemId: string) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/agenda/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editAgendaTitle, notes: editAgendaNotes }),
      })
      if (res.ok) {
        setEditingAgendaId(null)
        fetchDay(selectedDay.id)
      }
    } catch {
      toast.error('Kon agendapunt niet bijwerken')
    }
  }

  const handleDeleteAgenda = async (itemId: string) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/agenda/${itemId}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchDay(selectedDay.id)
    } catch {
      toast.error('Kon agendapunt niet verwijderen')
    }
  }

  // ── Actions CRUD ───────────────────────────────────

  const handleAddAction = async () => {
    if (!newActionDesc.trim() || !selectedDay) return
    setIsAddingAction(true)
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newActionDesc,
          responsibleName: newActionResponsible,
          deadline: newActionDeadline?.toISOString() || null,
        }),
      })
      if (res.ok) {
        setNewActionDesc('')
        setNewActionResponsible('Hele Team')
        setNewActionDeadline(null)
        fetchDay(selectedDay.id)
      }
    } catch {
      toast.error('Kon actiepunt niet toevoegen')
    } finally {
      setIsAddingAction(false)
    }
  }

  const handleToggleAction = async (actionId: string, isCompleted: boolean) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted }),
      })
      if (res.ok) fetchDay(selectedDay.id)
    } catch {
      toast.error('Kon actiepunt niet bijwerken')
    }
  }

  const handleUpdateAction = async (actionId: string, data: Partial<ActionItem>) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setEditingActionId(null)
        fetchDay(selectedDay.id)
      }
    } catch {
      toast.error('Kon actiepunt niet bijwerken')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!selectedDay) return
    try {
      const res = await fetch(`/api/werkoverleg/${selectedDay.id}/actions/${actionId}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchDay(selectedDay.id)
    } catch {
      toast.error('Kon actiepunt niet verwijderen')
    }
  }

  // ── Loading state ──────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-[calc(100dvh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p style={{ color: 'var(--color-text-tertiary)' }}>Werkoverleg laden...</p>
        </div>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────

  if (allDays.length === 0) {
    const nextTuesday = getNextTuesday()
    return (
      <div className="space-y-8 fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-emerald-500/10 flex items-center justify-center">
            <Icons.presentation className="text-workx-lime" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}><TextReveal>Werkoverleg</TextReveal></h1>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Dinsdagoverleg agenda & actiepunten</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <Icons.calendar size={32} className="mx-auto mb-3 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--color-text-tertiary)' }}>Nog geen werkoverleg gepland. Start de eerste vergaderweek.</p>
          <button
            onClick={() => handleSelectChairperson(CHAIRPERSON_MEMBERS[0])}
            className="btn-primary px-6 py-2.5 text-sm rounded-xl"
          >
            <Icons.plus size={14} className="inline mr-1.5" />
            Eerste week aanmaken ({nextTuesday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })})
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-emerald-500/10 flex items-center justify-center">
            <Icons.presentation className="text-workx-lime" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}><TextReveal>Werkoverleg</TextReveal></h1>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Dinsdagoverleg agenda & actiepunten</p>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => canGoBack && setWeekOffset(prev => prev + 1)}
          disabled={!canGoBack}
          className="p-2 rounded-lg transition-all disabled:opacity-20"
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-glass)' }}
        >
          <Icons.chevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 overflow-x-auto">
          {visibleDays.map((day) => (
            <button
              key={day.id}
              onClick={() => setSelectedDayId(day.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedDayId === day.id
                  ? 'bg-workx-lime text-workx-dark'
                  : ''
              }`}
              style={selectedDayId !== day.id ? { background: 'var(--color-bg-glass)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' } : {}}
            >
              {formatWeekLabel(day.dateLabel)}
            </button>
          ))}
        </div>

        <button
          onClick={() => canGoForward && setWeekOffset(prev => prev - 1)}
          disabled={!canGoForward}
          className="p-2 rounded-lg transition-all disabled:opacity-20"
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-glass)' }}
        >
          <Icons.chevronRight size={18} />
        </button>
      </div>

      {/* Chairperson Card + Date */}
      {selectedDay && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Voorzitter card */}
          <div className="relative rounded-2xl overflow-hidden p-5 flex items-center gap-4 min-w-[280px]" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/10 rounded-full blur-2xl pointer-events-none" />
            {selectedDay.chairperson && getPhotoUrl(selectedDay.chairperson) ? (
              <Image
                src={getPhotoUrl(selectedDay.chairperson)!}
                alt={selectedDay.chairperson}
                width={56}
                height={56}
                className="w-14 h-14 rounded-xl object-cover ring-2 ring-workx-lime/30 shadow-lg shadow-workx-lime/20 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center shadow-lg shadow-workx-lime/20 flex-shrink-0">
                <Icons.user size={24} className="text-workx-dark" />
              </div>
            )}
            <div className="flex-1 min-w-0 relative">
              <p className="text-[10px] font-bold uppercase tracking-widest text-workx-lime mb-0.5">Voorzitter</p>
              <p className="text-lg font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {selectedDay.chairperson || 'Nog niet gekozen'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{selectedDay.dateLabel}</p>
            </div>
            {/* Wijzig knop */}
            <button
              ref={chairEditRef}
              onClick={() => setShowChairEdit(!showChairEdit)}
              className="p-2 rounded-lg transition-all hover:bg-workx-lime/10 flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
              title="Voorzitter wijzigen"
            >
              <Icons.edit size={16} />
            </button>
            {showChairEdit && (
              <PersonDropdown
                anchorRef={chairEditRef}
                members={CHAIRPERSON_MEMBERS}
                selected={selectedDay.chairperson}
                onSelect={(name) => handleUpdateChairperson(name)}
                onClose={() => setShowChairEdit(false)}
              />
            )}
          </div>

          {/* Next week chairperson button */}
          {!hasNextWeek() && (
            <>
              <button
                ref={chairSelectRef}
                onClick={() => setShowChairSelect(!showChairSelect)}
                className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm transition-all hover:border-workx-lime/30 h-full"
                style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center flex-shrink-0">
                  <Icons.plus size={18} className="text-workx-lime" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Volgende week</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Kies voorzitter</p>
                </div>
              </button>
              {showChairSelect && (
                <PersonDropdown
                  anchorRef={chairSelectRef}
                  members={CHAIRPERSON_MEMBERS}
                  selected={null}
                  onSelect={(name) => { handleSelectChairperson(name); setShowChairSelect(false) }}
                  onClose={() => setShowChairSelect(false)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setActiveTab('agenda')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'agenda' ? 'bg-workx-lime text-workx-dark' : ''
          }`}
          style={activeTab !== 'agenda' ? { color: 'var(--color-text-secondary)' } : {}}
        >
          <Icons.fileText size={14} className="inline mr-1.5" />
          Agenda
        </button>
        <button
          onClick={() => setActiveTab('acties')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'acties' ? 'bg-workx-lime text-workx-dark' : ''
          }`}
          style={activeTab !== 'acties' ? { color: 'var(--color-text-secondary)' } : {}}
        >
          <Icons.checkCircle size={14} className="inline mr-1.5" />
          Actielijst
          {selectedDay?.actionItems && selectedDay.actionItems.filter(a => !a.isCompleted).length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-500/20 text-orange-400">
              {selectedDay.actionItems.filter(a => !a.isCompleted).length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isLoadingDay ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-6 h-6 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : selectedDay && activeTab === 'agenda' ? (
        /* ── Agenda Tab ────────────────────────────── */
        <div className="space-y-3">
          {selectedDay.agendaItems?.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl p-4 transition-all"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              {editingAgendaId === item.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editAgendaTitle}
                    onChange={(e) => setEditAgendaTitle(e.target.value)}
                    className="w-full bg-transparent text-sm font-medium focus:outline-none px-3 py-2 rounded-lg"
                    style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                    autoFocus
                  />
                  <textarea
                    value={editAgendaNotes}
                    onChange={(e) => setEditAgendaNotes(e.target.value)}
                    placeholder="Notities..."
                    rows={3}
                    className="w-full bg-transparent text-sm focus:outline-none px-3 py-2 rounded-lg resize-none"
                    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUpdateAgenda(item.id)} className="btn-primary px-3 py-1.5 text-xs rounded-lg">Opslaan</button>
                    <button onClick={() => setEditingAgendaId(null)} className="px-3 py-1.5 text-xs rounded-lg" style={{ color: 'var(--color-text-tertiary)' }}>Annuleren</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-workx-lime/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-workx-lime">{item.sortOrder + 1}</span>
                  </div>
                  <div
                    className="flex-1 cursor-pointer min-w-0"
                    onClick={() => {
                      setEditingAgendaId(item.id)
                      setEditAgendaTitle(item.title)
                      setEditAgendaNotes(item.notes || '')
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.title}</p>
                    {item.notes && (
                      <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: 'var(--color-text-tertiary)' }}>{item.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteAgenda(item.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Icons.trash size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add agenda item */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAgendaTitle}
              onChange={(e) => setNewAgendaTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAgenda()}
              placeholder="Nieuw agendapunt..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={handleAddAgenda}
              disabled={!newAgendaTitle.trim() || isAddingAgenda}
              className="btn-primary px-4 py-2.5 text-sm rounded-xl disabled:opacity-30"
            >
              <Icons.plus size={14} className="inline mr-1" />
              Toevoegen
            </button>
          </div>
        </div>
      ) : selectedDay && activeTab === 'acties' ? (
        /* ── Actielijst Tab ─────────────────────────── */
        <div className="space-y-3">
          {selectedDay.actionItems?.map((action) => {
            const dlColor = getDeadlineColor(action.deadline, action.isCompleted)
            return (
              <div
                key={action.id}
                className={`group rounded-xl p-4 transition-all ${action.isCompleted ? 'opacity-60' : ''}`}
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleAction(action.id, !action.isCompleted)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      action.isCompleted
                        ? 'bg-workx-lime border-workx-lime'
                        : 'border-white/20 hover:border-workx-lime/50'
                    }`}
                  >
                    {action.isCompleted && <Icons.check size={12} className="text-workx-dark" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {editingActionId === action.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editActionDesc}
                          onChange={(e) => setEditActionDesc(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateAction(action.id, { description: editActionDesc })
                            if (e.key === 'Escape') setEditingActionId(null)
                          }}
                          className="flex-1 bg-transparent text-sm focus:outline-none px-2 py-1 rounded-lg"
                          style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateAction(action.id, { description: editActionDesc })}
                          className="text-workx-lime text-xs"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <p
                        className={`text-sm cursor-pointer ${action.isCompleted ? 'line-through' : ''}`}
                        style={{ color: 'var(--color-text-primary)' }}
                        onClick={() => {
                          setEditingActionId(action.id)
                          setEditActionDesc(action.description)
                        }}
                      >
                        {action.description}
                      </p>
                    )}

                    {/* Meta row: responsible + deadline */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Responsible */}
                      <button
                        ref={(el) => { responsibleRefs.current[action.id] = el }}
                        onClick={() => setShowResponsibleFor(showResponsibleFor === action.id ? null : action.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium cursor-pointer hover:bg-workx-lime/20 transition-colors"
                      >
                        {getPhotoUrl(action.responsibleName) ? (
                          <img loading="lazy" src={getPhotoUrl(action.responsibleName)!} alt={action.responsibleName} className="w-4 h-4 rounded-md object-cover" />
                        ) : null}
                        {action.responsibleName}
                        <Icons.chevronDown size={10} />
                      </button>
                      {showResponsibleFor === action.id && responsibleRefs.current[action.id] && (
                        <PersonDropdown
                          anchorRef={{ current: responsibleRefs.current[action.id] }}
                          members={TEAM_MEMBERS}
                          selected={action.responsibleName}
                          onSelect={(name) => handleUpdateAction(action.id, { responsibleName: name })}
                          onClose={() => setShowResponsibleFor(null)}
                        />
                      )}

                      {/* Deadline */}
                      <div className="w-44">
                        <DatePicker
                          selected={action.deadline ? new Date(action.deadline) : null}
                          onChange={(date) => handleUpdateAction(action.id, { deadline: date?.toISOString() || null } as any)}
                          placeholder="Deadline..."
                          isClearable
                          dateFormat="d MMM yyyy"
                        />
                      </div>

                      {/* Deadline badge */}
                      {action.deadline && !action.isCompleted && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${dlColor}`}>
                          {new Date(action.deadline) < new Date() ? 'Verlopen' :
                           Math.ceil((new Date(action.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) < 3 ? 'Bijna verlopen' :
                           `${Math.ceil((new Date(action.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteAction(action.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Icons.trash size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add action form */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <input
              type="text"
              value={newActionDesc}
              onChange={(e) => setNewActionDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
              placeholder="Nieuw actiepunt..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-transparent focus:outline-none"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                ref={(el) => { responsibleRefs.current['new-action'] = el }}
                onClick={() => setShowResponsibleFor(showResponsibleFor === 'new-action' ? null : 'new-action')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer hover:bg-workx-lime/20 transition-colors bg-workx-lime/10 text-workx-lime"
              >
                {getPhotoUrl(newActionResponsible) ? (
                  <img loading="lazy" src={getPhotoUrl(newActionResponsible)!} alt={newActionResponsible} className="w-4 h-4 rounded-md object-cover" />
                ) : null}
                {newActionResponsible}
                <Icons.chevronDown size={10} />
              </button>
              {showResponsibleFor === 'new-action' && responsibleRefs.current['new-action'] && (
                <PersonDropdown
                  anchorRef={{ current: responsibleRefs.current['new-action'] }}
                  members={TEAM_MEMBERS}
                  selected={newActionResponsible}
                  onSelect={(name) => setNewActionResponsible(name)}
                  onClose={() => setShowResponsibleFor(null)}
                />
              )}
              <div className="w-48">
                <DatePicker
                  selected={newActionDeadline}
                  onChange={(date) => setNewActionDeadline(date)}
                  placeholder="Deadline..."
                  isClearable
                  dateFormat="d MMM yyyy"
                />
              </div>
              <button
                onClick={handleAddAction}
                disabled={!newActionDesc.trim() || isAddingAction}
                className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-30 ml-auto"
              >
                <Icons.plus size={14} className="inline mr-1" />
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
