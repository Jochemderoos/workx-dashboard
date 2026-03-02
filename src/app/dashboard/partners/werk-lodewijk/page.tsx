'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/ui/Icons'
import ExpandableText from '@/components/ui/ExpandableText'
import { getPhotoUrl, PARTNERS, ADVOCATEN, ALL_TEAM_MEMBERS } from '@/lib/team-photos'

// Lodewijk profile info
const LODEWIJK = {
  name: 'Lodewijk van Thiel',
  subtitle: 'Extern advocaat',
  internRate: 155,
  externRate: 310,
  userId: 'lodewijk-van-thiel', // Used as advocateUserId
  capacityMin: 24, // minimale uren/week
  capacityMax: 32, // maximale uren/week
}

interface WorkloadEntry {
  id: string
  personName: string
  date: string
  level: string
  hours: number | null
  createdAt: string
  updatedAt: string
}

interface ExternalCase {
  id: string
  advocateUserId: string
  dossiernaam: string
  contactpersoonNaam: string | null
  beschrijving: string | null
  verwachteUrenPerWeek: number
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
  _isNew?: boolean // Client-only: new unsaved case
}

// ─── Contactpersoon Dropdown ────────────────────────────────────────────

interface ContactDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  selectedName: string | null
  onSelect: (name: string | null) => void
  onClose: () => void
}

function ContactDropdown({ anchorRef, selectedName, onSelect, onClose }: ContactDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [search, setSearch] = useState('')

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownHeight = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    const minWidth = 240
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

  const filtered = ALL_TEAM_MEMBERS.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  )

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="bg-workx-dark border border-white/10 rounded-lg shadow-2xl overflow-hidden"
    >
      <div className="p-2 border-b border-white/5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Zoek teamlid..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30"
          autoFocus
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {selectedName && (
          <button
            onClick={() => { onSelect(null); onClose() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/40 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Icons.x size={14} />
            <span className="italic">Verwijder selectie</span>
          </button>
        )}
        {filtered.map(name => {
          const photo = getPhotoUrl(name)
          const isSelected = selectedName === name
          return (
            <button
              key={name}
              onClick={() => { onSelect(name); onClose() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                isSelected ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              {photo ? (
                <img src={photo} alt={name} className="w-5 h-5 rounded-md object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-white/40 text-[10px] font-bold">
                  {name.charAt(0)}
                </div>
              )}
              <span>{name}</span>
              {isSelected && <Icons.check size={14} className="ml-auto text-workx-lime" />}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-white/30 text-center py-3">Geen resultaten</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── Workload Bar ───────────────────────────────────────────────────────

function WorkloadBar({ hours }: { hours: number }) {
  const maxHours = 42
  const pct = Math.min((hours / maxHours) * 100, 100)
  let color = 'from-green-500 to-green-400'
  let label = 'Licht'
  if (hours > 32) { color = 'from-red-500 to-red-400'; label = 'Zwaar' }
  else if (hours > 28) { color = 'from-orange-500 to-orange-400'; label = 'Hoog' }
  else if (hours > 24) { color = 'from-yellow-500 to-yellow-400'; label = 'Normaal' }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/40">Werkdruk</span>
        <span className="text-white/60">{label}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/20">
        <span>0u</span>
        <span>24u</span>
        <span>32u</span>
        <span>42u</span>
      </div>
    </div>
  )
}

// ─── Weekly Hours Overview ──────────────────────────────────────────────

function getWeekBounds(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Monday = start of week (ISO)
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) - (weeksAgo * 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('nl-NL', opts)} - ${end.toLocaleDateString('nl-NL', opts)}`
}

function getBarColor(hours: number): string {
  if (hours > 32) return 'from-red-500 to-red-400'
  if (hours > 28) return 'from-orange-500 to-orange-400'
  if (hours > 24) return 'from-yellow-500 to-yellow-400'
  return 'from-green-500 to-green-400'
}

interface WeekData {
  start: Date
  end: Date
  label: string
  hours: number
  pct: number
  isCurrent: boolean
}

function WeeklyHoursOverview({ entries }: { entries: WorkloadEntry[] }) {
  const weeks: WeekData[] = useMemo(() => {
    const result: WeekData[] = []
    for (let i = 0; i < 4; i++) {
      const { start, end } = getWeekBounds(i)
      const startStr = start.toISOString().slice(0, 10)
      const endStr = end.toISOString().slice(0, 10)
      const weekEntries = entries.filter(e => e.date >= startStr && e.date <= endStr)
      const hours = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      result.push({
        start,
        end,
        label: formatWeekLabel(start, end),
        hours: Math.round(hours * 10) / 10,
        pct: Math.min((hours / LODEWIJK.capacityMax) * 100, 100),
        isCurrent: i === 0,
      })
    }
    return result
  }, [entries])

  const trend = useMemo(() => {
    if (weeks.length < 2 || weeks[1].hours === 0) return null
    const diff = ((weeks[0].hours - weeks[1].hours) / weeks[1].hours) * 100
    return Math.round(diff * 10) / 10
  }, [weeks])

  const average = useMemo(() => {
    const total = weeks.reduce((sum, w) => sum + w.hours, 0)
    return Math.round((total / weeks.length) * 10) / 10
  }, [weeks])

  // Don't render if no data at all
  const hasData = entries.some(e => e.hours && e.hours > 0)
  if (!hasData) return null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="relative p-6 sm:p-8 space-y-5">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Icons.clock size={18} className="text-workx-lime/70" />
          Weekoverzicht declarabele uren
        </h3>

        <div className="space-y-3">
          {weeks.map((week, i) => (
            <div key={i} className={`rounded-xl p-3 transition-colors ${week.isCurrent ? 'bg-white/[0.04] ring-1 ring-workx-lime/20' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/50">
                  {week.label}
                  {week.isCurrent && <span className="ml-2 text-workx-lime/70 text-[10px] font-medium">(deze week)</span>}
                </span>
                <span className="text-xs font-medium text-white/70">{week.hours}u</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getBarColor(week.hours)} transition-all duration-500`}
                    style={{ width: `${week.pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30 w-8 text-right">{Math.round(week.pct)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: trend + gemiddelde + capaciteit */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-white/5 text-xs text-white/40">
          {trend !== null && (
            <span className={`flex items-center gap-1 ${trend >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {trend >= 0 ? <Icons.trendingUp size={14} /> : <Icons.trendingDown size={14} />}
              {trend >= 0 ? '+' : ''}{trend}% t.o.v. vorige week
            </span>
          )}
          <span>Gemiddeld: <span className="text-white/60 font-medium">{average} uur/week</span></span>
          <span>Capaciteit: <span className="text-white/60 font-medium">{LODEWIJK.capacityMin}-{LODEWIJK.capacityMax} uur/week</span></span>
        </div>
      </div>
    </div>
  )
}

// ─── Case Row (Desktop) ────────────────────────────────────────────────

interface CaseRowProps {
  caseData: ExternalCase
  onUpdate: (data: ExternalCase) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

function CaseRow({ caseData, onUpdate, onComplete, onDelete }: CaseRowProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [completing, setCompleting] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleComplete = () => {
    setCompleting(true)
    setTimeout(() => onComplete(caseData.id), 300)
  }

  return (
    <div className={`grid grid-cols-[1fr_180px_1fr_100px_80px] gap-3 items-start px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-all ${
      completing ? 'opacity-0 scale-95 translate-x-4 transition-all duration-300' : ''
    }`}>
      {/* Dossiernaam */}
      <input
        type="text"
        value={caseData.dossiernaam}
        onChange={e => onUpdate({ ...caseData, dossiernaam: e.target.value })}
        placeholder="Dossiernaam..."
        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-workx-lime/30 px-1 py-1 text-sm text-white focus:outline-none transition-colors"
      />

      {/* Contactpersoon */}
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-left"
        >
          {caseData.contactpersoonNaam ? (
            <>
              {getPhotoUrl(caseData.contactpersoonNaam) ? (
                <img src={getPhotoUrl(caseData.contactpersoonNaam)!} alt="" className="w-5 h-5 rounded-md object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold">
                  {caseData.contactpersoonNaam.charAt(0)}
                </div>
              )}
              <span className="text-sm text-white/70 truncate">{caseData.contactpersoonNaam.split(' ')[0]}</span>
            </>
          ) : (
            <span className="text-sm text-white/20 italic">Selecteer...</span>
          )}
          <Icons.chevronDown size={12} className="ml-auto text-white/20" />
        </button>
        {showDropdown && (
          <ContactDropdown
            anchorRef={btnRef}
            selectedName={caseData.contactpersoonNaam}
            onSelect={name => onUpdate({ ...caseData, contactpersoonNaam: name })}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </div>

      {/* Beschrijving */}
      <ExpandableText
        text={caseData.beschrijving}
        onChange={val => onUpdate({ ...caseData, beschrijving: val })}
        placeholder="Beschrijving..."
        maxLines={2}
      />

      {/* Uren/week */}
      <input
        type="number"
        value={caseData.verwachteUrenPerWeek || ''}
        onChange={e => onUpdate({ ...caseData, verwachteUrenPerWeek: parseFloat(e.target.value) || 0 })}
        step="0.5"
        min="0"
        placeholder="0"
        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-workx-lime/30 px-1 py-1 text-sm text-white text-center focus:outline-none transition-colors w-full"
      />

      {/* Acties */}
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={handleComplete}
          title="Afronden"
          className="p-1.5 rounded-lg hover:bg-green-500/10 text-white/30 hover:text-green-400 transition-colors"
        >
          <Icons.check size={16} />
        </button>
        <button
          onClick={() => onDelete(caseData.id)}
          title="Verwijderen"
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
        >
          <Icons.trash size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Case Card (Mobiel) ─────────────────────────────────────────────────

function CaseCard({ caseData, onUpdate, onComplete, onDelete }: CaseRowProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [completing, setCompleting] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleComplete = () => {
    setCompleting(true)
    setTimeout(() => onComplete(caseData.id), 300)
  }

  return (
    <div className={`bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3 transition-all ${
      completing ? 'opacity-0 scale-95 translate-x-4 duration-300' : ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <input
          type="text"
          value={caseData.dossiernaam}
          onChange={e => onUpdate({ ...caseData, dossiernaam: e.target.value })}
          placeholder="Dossiernaam..."
          className="bg-transparent text-white font-medium text-sm focus:outline-none border-b border-transparent focus:border-workx-lime/30 flex-1"
        />
        <div className="flex items-center gap-1">
          <button onClick={handleComplete} className="p-1.5 rounded-lg hover:bg-green-500/10 text-white/30 hover:text-green-400 transition-colors">
            <Icons.check size={16} />
          </button>
          <button onClick={() => onDelete(caseData.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors">
            <Icons.trash size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-wider">Contactpersoon</label>
          <button
            ref={btnRef}
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            {caseData.contactpersoonNaam ? (
              <>
                {getPhotoUrl(caseData.contactpersoonNaam) && (
                  <img src={getPhotoUrl(caseData.contactpersoonNaam)!} alt="" className="w-5 h-5 rounded-md object-cover" />
                )}
                <span className="text-sm text-white/70 truncate">{caseData.contactpersoonNaam.split(' ')[0]}</span>
              </>
            ) : (
              <span className="text-sm text-white/20">Selecteer...</span>
            )}
          </button>
          {showDropdown && (
            <ContactDropdown
              anchorRef={btnRef}
              selectedName={caseData.contactpersoonNaam}
              onSelect={name => onUpdate({ ...caseData, contactpersoonNaam: name })}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-wider">Uren/week</label>
          <input
            type="number"
            value={caseData.verwachteUrenPerWeek || ''}
            onChange={e => onUpdate({ ...caseData, verwachteUrenPerWeek: parseFloat(e.target.value) || 0 })}
            step="0.5"
            min="0"
            placeholder="0"
            className="w-full mt-1 bg-white/5 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-workx-lime/30"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/30 uppercase tracking-wider">Beschrijving</label>
        <div className="mt-1">
          <ExpandableText
            text={caseData.beschrijving}
            onChange={val => onUpdate({ ...caseData, beschrijving: val })}
            placeholder="Beschrijving..."
            maxLines={3}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function WerkLodewijkPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [cases, setCases] = useState<ExternalCase[]>([])
  const [completedCases, setCompletedCases] = useState<ExternalCase[]>([])
  const [editedCases, setEditedCases] = useState<ExternalCase[] | null>(null)
  const [workloadEntries, setWorkloadEntries] = useState<WorkloadEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const user = session?.user as { role?: string } | undefined

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, user?.role, router])

  // Fetch cases
  const fetchCases = useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch(`/api/external-advocate-cases?advocateUserId=${LODEWIJK.userId}`),
        fetch(`/api/external-advocate-cases?advocateUserId=${LODEWIJK.userId}&includeCompleted=true`),
      ])

      if (activeRes.ok) {
        const active = await activeRes.json()
        setCases(active)
      }
      if (completedRes.ok) {
        const all = await completedRes.json()
        setCompletedCases(all.filter((c: ExternalCase) => c.isCompleted))
      }
    } catch {
      setError('Kon zaken niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch workload entries for Lodewijk
  const fetchWorkload = useCallback(async () => {
    try {
      const year = new Date().getFullYear()
      const res = await fetch(`/api/workload?year=${year}&personName=${encodeURIComponent(LODEWIJK.name)}`)
      if (res.ok) {
        const data = await res.json()
        setWorkloadEntries(data)
      }
    } catch {
      // Silently fail — weekoverzicht just won't show
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCases()
      fetchWorkload()
    }
  }, [status, fetchCases, fetchWorkload])

  // Computed
  const displayCases = editedCases ?? cases
  const hasChanges = editedCases !== null
  const totalHours = displayCases.reduce((sum, c) => sum + (c.verwachteUrenPerWeek || 0), 0)
  const activeCaseCount = displayCases.length

  // Current week actual hours from workload data
  const currentWeekActual = useMemo(() => {
    if (workloadEntries.length === 0) return null
    const { start, end } = getWeekBounds(0)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const weekEntries = workloadEntries.filter(e => e.date >= startStr && e.date <= endStr && e.hours)
    if (weekEntries.length === 0) return null
    return Math.round(weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0) * 10) / 10
  }, [workloadEntries])

  // Actions
  const updateCase = (updated: ExternalCase) => {
    const current = editedCases ?? [...cases]
    setEditedCases(current.map(c => c.id === updated.id ? updated : c))
  }

  const addCase = () => {
    const current = editedCases ?? [...cases]
    const newCase: ExternalCase = {
      id: `new-${Date.now()}`,
      advocateUserId: LODEWIJK.userId,
      dossiernaam: '',
      contactpersoonNaam: null,
      beschrijving: null,
      verwachteUrenPerWeek: 0,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isNew: true,
    }
    setEditedCases([...current, newCase])
  }

  const deleteCase = (id: string) => {
    const current = editedCases ?? [...cases]
    setEditedCases(current.filter(c => c.id !== id))
  }

  const completeCase = async (id: string) => {
    // If it's a new unsaved case, just remove it
    if (id.startsWith('new-')) {
      const current = editedCases ?? [...cases]
      setEditedCases(current.filter(c => c.id !== id))
      return
    }

    try {
      const res = await fetch(`/api/external-advocate-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      })
      if (res.ok) {
        const completed = await res.json()
        setCases(prev => prev.filter(c => c.id !== id))
        setCompletedCases(prev => [completed, ...prev])
        if (editedCases) {
          setEditedCases(editedCases.filter(c => c.id !== id))
        }
      }
    } catch {
      setError('Afronden mislukt')
    }
  }

  const cancelChanges = () => {
    setEditedCases(null)
  }

  const saveChanges = async () => {
    if (!editedCases) return
    setIsSaving(true)
    setError(null)

    try {
      const toSave = editedCases.filter(c => c.dossiernaam.trim())

      // Save new cases
      for (const c of toSave.filter(c => c._isNew)) {
        const res = await fetch('/api/external-advocate-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            advocateUserId: c.advocateUserId,
            dossiernaam: c.dossiernaam,
            contactpersoonNaam: c.contactpersoonNaam,
            beschrijving: c.beschrijving,
            verwachteUrenPerWeek: c.verwachteUrenPerWeek,
          }),
        })
        if (!res.ok) throw new Error('Opslaan mislukt')
      }

      // Update existing cases
      for (const c of toSave.filter(c => !c._isNew)) {
        const res = await fetch(`/api/external-advocate-cases/${c.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dossiernaam: c.dossiernaam,
            contactpersoonNaam: c.contactpersoonNaam,
            beschrijving: c.beschrijving,
            verwachteUrenPerWeek: c.verwachteUrenPerWeek,
          }),
        })
        if (!res.ok) throw new Error('Opslaan mislukt')
      }

      // Delete removed cases
      const editedIds = new Set(toSave.map(c => c.id))
      for (const c of cases) {
        if (!editedIds.has(c.id)) {
          await fetch(`/api/external-advocate-cases/${c.id}`, { method: 'DELETE' })
        }
      }

      setEditedCases(null)
      await fetchCases()
    } catch {
      setError('Opslaan mislukt. Probeer opnieuw.')
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-workx-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  const photoUrl = getPhotoUrl(LODEWIJK.name)

  return (
    <div className="min-h-screen bg-workx-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Profile Card ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-workx-lime/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-workx-lime/30 shadow-lg shadow-workx-lime/10">
                  {photoUrl ? (
                    <Image src={photoUrl} alt={LODEWIJK.name} width={96} height={96} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center text-workx-dark text-2xl font-bold">
                      L
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-workx-dark" />
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-white">{LODEWIJK.name}</h1>
                <p className="text-white/40 text-sm mt-0.5">{LODEWIJK.subtitle}</p>

                {/* Rate cards */}
                <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Intern</p>
                    <p className="text-lg font-bold text-white">&euro;{LODEWIJK.internRate} <span className="text-xs text-white/40 font-normal">/uur</span></p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Extern</p>
                    <p className="text-lg font-bold text-white">&euro;{LODEWIJK.externRate} <span className="text-xs text-white/40 font-normal">/uur</span></p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Actieve zaken</p>
                    <p className="text-lg font-bold text-workx-lime">{activeCaseCount}</p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Uren/week</p>
                    {currentWeekActual !== null ? (
                      <p className="text-lg font-bold text-white">
                        {currentWeekActual}
                        <span className="text-xs text-white/30 font-normal ml-1">(geschat: {totalHours})</span>
                      </p>
                    ) : (
                      <p className="text-lg font-bold text-white">{totalHours}</p>
                    )}
                  </div>
                </div>

                {/* Workload bar */}
                <div className="mt-4 max-w-md">
                  <WorkloadBar hours={currentWeekActual ?? totalHours} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Weekly Hours Overview ─────────────────────────────────── */}
        <WeeklyHoursOverview entries={workloadEntries} />

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <Icons.alertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-white/5 rounded">
              <Icons.x size={14} />
            </button>
          </div>
        )}

        {/* ── Cases Section ──────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Header + actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Actieve zaken</h2>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <>
                  <button
                    onClick={cancelChanges}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={saveChanges}
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
                        Wijzigingen opslaan
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Empty state */}
          {displayCases.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-workx-lime/10 flex items-center justify-center mb-4">
                <Icons.briefcase size={28} className="text-workx-lime/50" />
              </div>
              <h3 className="text-white font-medium mb-1">Geen actieve zaken</h3>
              <p className="text-white/40 text-sm mb-6 text-center max-w-sm">
                Er zijn momenteel geen zaken belegd bij {LODEWIJK.name}.
              </p>
              <button
                onClick={addCase}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all"
              >
                <Icons.plus size={16} />
                Eerste zaak toevoegen
              </button>
            </div>
          )}

          {/* Desktop Table */}
          {displayCases.length > 0 && (
            <>
              <div className="hidden sm:block rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_180px_1fr_100px_80px] gap-3 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Dossiernaam</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Contactpersoon</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Beschrijving</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium text-center">Uren/week</span>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium text-right">Acties</span>
                </div>
                {/* Rows */}
                {displayCases.map(c => (
                  <CaseRow
                    key={c.id}
                    caseData={c}
                    onUpdate={updateCase}
                    onComplete={completeCase}
                    onDelete={deleteCase}
                  />
                ))}
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {displayCases.map(c => (
                  <CaseCard
                    key={c.id}
                    caseData={c}
                    onUpdate={updateCase}
                    onComplete={completeCase}
                    onDelete={deleteCase}
                  />
                ))}
              </div>
            </>
          )}

          {/* Add case button */}
          {(displayCases.length > 0 || hasChanges) && (
            <button
              onClick={addCase}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/10 hover:border-workx-lime/30 text-white/40 hover:text-workx-lime text-sm transition-all w-full justify-center"
            >
              <Icons.plus size={16} />
              Zaak toevoegen
            </button>
          )}
        </div>

        {/* ── Completed Cases (Collapsible) ──────────────────────────── */}
        {completedCases.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm py-2">
              <Icons.chevronDown size={14} className="transition-transform group-open:rotate-180" />
              Afgeronde zaken ({completedCases.length})
            </summary>
            <div className="mt-3 space-y-2">
              {completedCases.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-60">
                  <Icons.check size={16} className="text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/60 truncate">{c.dossiernaam}</p>
                    {c.beschrijving && (
                      <p className="text-xs text-white/30 truncate mt-0.5">{c.beschrijving}</p>
                    )}
                  </div>
                  {c.contactpersoonNaam && (
                    <div className="flex items-center gap-1.5">
                      {getPhotoUrl(c.contactpersoonNaam) && (
                        <img src={getPhotoUrl(c.contactpersoonNaam)!} alt="" className="w-4 h-4 rounded object-cover" />
                      )}
                      <span className="text-xs text-white/30">{c.contactpersoonNaam.split(' ')[0]}</span>
                    </div>
                  )}
                  <span className="text-xs text-white/20">
                    {c.completedAt ? new Date(c.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
