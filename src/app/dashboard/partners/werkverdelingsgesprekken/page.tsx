'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'
import ExpandableText from '@/components/ui/ExpandableText'
import { ADVOCATEN, getPhotoUrl } from '@/lib/team-photos'

// Medewerkers die werkverdelingsgesprekken krijgen
const GESPREK_MEDEWERKERS = ADVOCATEN

interface Distribution {
  id?: string
  partnerName: string
  employeeName: string | null
  employeeId: string | null
}

interface Conversation {
  id: string
  weekId: string
  employeeId: string
  employeeName: string
  partnerName: string
  capacity: string | null
  notes: string | null
}

interface Week {
  id: string
  meetingDate: string
  dateLabel: string
  distributions: Distribution[]
  conversations: Conversation[]
}

interface Employee {
  id: string
  name: string
  role: string
}

const CAPACITY_OPTIONS = [
  { value: 'veel_ruimte', label: 'Veel ruimte', color: 'green' },
  { value: 'ruimte', label: 'Ruimte', color: 'blue' },
  { value: 'vol', label: 'Vol', color: 'orange' },
  { value: 'heel_vol', label: 'Heel vol', color: 'red' },
] as const

type CapacityValue = typeof CAPACITY_OPTIONS[number]['value'] | null

function getCapacityStyle(capacity: CapacityValue) {
  switch (capacity) {
    case 'veel_ruimte': return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-500' }
    case 'ruimte': return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' }
    case 'vol': return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' }
    case 'heel_vol': return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' }
    default: return { bg: 'bg-white/5', text: 'text-gray-500', border: 'border-white/10', dot: 'bg-gray-600' }
  }
}

function getCapacityLabel(value: CapacityValue) {
  return CAPACITY_OPTIONS.find(o => o.value === value)?.label || 'Niet ingevuld'
}

export default function WerkverdelingsgesprekkenPage() {
  const [weeks, setWeeks] = useState<Week[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  // Local state for edits (keyed by `weekId-employeeId`)
  const [localData, setLocalData] = useState<Record<string, { capacity: CapacityValue; notes: string; partnerName: string }>>({})
  // Saved state snapshot — used to detect dirty cards
  const [savedData, setSavedData] = useState<Record<string, { capacity: CapacityValue; notes: string; partnerName: string }>>({})
  // Track which cards are currently saving
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  // Track which cards are in notes edit mode
  const [editingNotes, setEditingNotes] = useState<Set<string>>(new Set())

  // Check access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const user = await res.json()
          if (['PARTNER', 'ADMIN'].includes(user.role)) {
            setHasAccess(true)
          }
        }
      } catch {
        // ignore
      }
    }
    checkAccess()
  }, [])

  // Fetch data
  useEffect(() => {
    if (!hasAccess) return
    const fetchData = async () => {
      try {
        const res = await fetch('/api/work-conversations')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setWeeks(data.weeks)
        setEmployees(data.employees)
        if (data.weeks.length > 0) {
          setActiveWeekId(data.weeks[0].id)
        }

        // Build local state from existing conversations
        const initial: Record<string, { capacity: CapacityValue; notes: string; partnerName: string }> = {}
        for (const week of data.weeks as Week[]) {
          for (const conv of week.conversations) {
            const key = `${week.id}-${conv.employeeId}`
            initial[key] = {
              capacity: conv.capacity as CapacityValue,
              notes: conv.notes || '',
              partnerName: conv.partnerName,
            }
          }
        }
        setLocalData(initial)
        setSavedData(initial)
      } catch {
        toast.error('Kon gesprekken niet laden')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [hasAccess])

  // Find partner assignment from distributions for a given employee in a given week
  const getPartnerForEmployee = useCallback((week: Week, employeeName: string): string => {
    // Check distributions: employeeName matches
    const dist = week.distributions.find(d => {
      if (!d.employeeName) return false
      // Match on first name
      const distFirst = d.employeeName.split(' ')[0].toLowerCase()
      const empFirst = employeeName.split(' ')[0].toLowerCase()
      return distFirst === empFirst || d.employeeName.toLowerCase() === employeeName.toLowerCase()
    })
    return dist?.partnerName || ''
  }, [])

  // Find employee ID from employees list
  const getEmployeeId = useCallback((name: string): string => {
    const firstName = name.split(' ')[0].toLowerCase()
    const emp = employees.find(e => {
      return e.name.toLowerCase() === name.toLowerCase() ||
             e.name.split(' ')[0].toLowerCase() === firstName
    })
    return emp?.id || name // fallback to name if no match
  }, [employees])

  // Save conversation (explicit, no debounce)
  const saveConversation = useCallback(async (weekId: string, employeeName: string, key: string, data: { capacity: CapacityValue; notes: string; partnerName: string }) => {
    const employeeId = getEmployeeId(employeeName)
    setSavingKeys(prev => new Set(prev).add(key))
    try {
      const res = await fetch('/api/work-conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId,
          employeeId,
          employeeName,
          partnerName: data.partnerName || '-',
          capacity: data.capacity,
          notes: data.notes,
        }),
      })
      if (!res.ok) throw new Error()
      // Update saved snapshot
      setSavedData(prev => ({ ...prev, [key]: { ...data } }))
      // Exit edit mode for notes
      setEditingNotes(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      toast.success(`Opgeslagen`)
    } catch {
      toast.error(`Kon gesprek voor ${employeeName.split(' ')[0]} niet opslaan`)
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [getEmployeeId])

  // Check if a card has unsaved changes
  const isDirty = useCallback((key: string) => {
    const local = localData[key]
    const saved = savedData[key]
    if (!local && !saved) return false
    if (!local || !saved) return true
    return local.capacity !== saved.capacity || local.notes !== saved.notes
  }, [localData, savedData])

  const handleChange = useCallback((weekId: string, employeeName: string, field: 'capacity' | 'notes', value: string) => {
    const employeeId = getEmployeeId(employeeName)
    const key = `${weekId}-${employeeId}`
    const activeWeek = weeks.find(w => w.id === weekId)

    setLocalData(prev => {
      const current = prev[key] || {
        capacity: null,
        notes: '',
        partnerName: activeWeek ? getPartnerForEmployee(activeWeek, employeeName) : '',
      }
      const updated = { ...current, [field]: value }
      return { ...prev, [key]: updated }
    })
  }, [weeks, getEmployeeId, getPartnerForEmployee])

  // Active week data
  const activeWeek = weeks.find(w => w.id === activeWeekId)

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center card p-8">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.alertTriangle className="text-red-400" size={32} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Geen toegang</h2>
          <p className="text-gray-400">Deze pagina is alleen beschikbaar voor partners en beheerders.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span className="text-gray-400">Laden...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Decorative glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-green-500/3 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/10 flex items-center justify-center">
              <Icons.chat className="text-green-400" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white"><TextReveal>Werkverdelingsgesprekken</TextReveal></h1>
          </div>
        </div>

        {/* Week tabs */}
        {weeks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weeks.map((week) => (
              <button
                key={week.id}
                onClick={() => setActiveWeekId(week.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeWeekId === week.id
                    ? 'bg-workx-lime text-workx-dark'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {week.dateLabel}
              </button>
            ))}
          </div>
        )}

        {/* Capacity overview */}
        {activeWeek && (() => {
          const counts = { veel_ruimte: 0, ruimte: 0, vol: 0, heel_vol: 0, none: 0 }
          GESPREK_MEDEWERKERS.forEach(name => {
            const key = `${activeWeek.id}-${getEmployeeId(name)}`
            const cap = savedData[key]?.capacity
            if (cap && cap in counts) counts[cap as keyof typeof counts]++
            else counts.none++
          })
          const filled = GESPREK_MEDEWERKERS.length - counts.none
          return (
            <div className="card p-4 border border-white/10 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 mr-auto">
                <Icons.chart className="text-gray-500" size={16} />
                <span className="text-sm text-gray-400">
                  <span className="text-white font-medium">{filled}</span>/{GESPREK_MEDEWERKERS.length} ingevuld
                </span>
              </div>
              {CAPACITY_OPTIONS.map(opt => {
                const count = counts[opt.value as keyof typeof counts]
                const style = getCapacityStyle(opt.value)
                return (
                  <div key={opt.value} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className={`text-xs ${style.text}`}>{opt.label}</span>
                    <span className="text-xs text-gray-500 font-medium">{count}</span>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Employee cards grid */}
        {activeWeek && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...GESPREK_MEDEWERKERS].sort((a, b) => {
              const aKey = `${activeWeek.id}-${getEmployeeId(a)}`
              const bKey = `${activeWeek.id}-${getEmployeeId(b)}`
              const aFilled = !!(savedData[aKey]?.capacity || savedData[aKey]?.notes)
              const bFilled = !!(savedData[bKey]?.capacity || savedData[bKey]?.notes)
              if (aFilled === bFilled) return 0
              return aFilled ? -1 : 1
            }).map((name) => {
              const employeeId = getEmployeeId(name)
              const key = `${activeWeek.id}-${employeeId}`
              const data = localData[key] || {
                capacity: null,
                notes: '',
                partnerName: getPartnerForEmployee(activeWeek, name),
              }
              const photoUrl = getPhotoUrl(name)
              const style = getCapacityStyle(data.capacity)
              const dirty = isDirty(key)
              const isSaving = savingKeys.has(key)
              const isEditingNote = editingNotes.has(key)
              const hasSavedNotes = !!(savedData[key]?.notes)

              return (
                <div key={name} className={`card p-4 border ${style.border} transition-all`}>
                  {/* Header: foto + naam + partner badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative w-11 h-11 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={name}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">
                          {name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{name}</p>
                      {data.partnerName && (
                        <p className="text-xs text-gray-500 truncate">Partner: {data.partnerName}</p>
                      )}
                    </div>
                  </div>

                  {/* Capacity selector */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1.5 block">Capaciteit</label>
                    <div className="grid grid-cols-4 gap-1">
                      {CAPACITY_OPTIONS.map((opt) => {
                        const isSelected = data.capacity === opt.value
                        const optStyle = getCapacityStyle(opt.value)
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleChange(activeWeek.id, name, 'capacity', data.capacity === opt.value ? '' : opt.value)}
                            className={`px-1 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                              isSelected
                                ? `${optStyle.bg} ${optStyle.text} ${optStyle.border}`
                                : 'bg-white/5 text-gray-500 border-transparent hover:bg-white/10 hover:text-gray-300'
                            }`}
                            title={opt.label}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Notes: ExpandableText read mode or textarea edit mode */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Notities</label>
                    {isEditingNote || !hasSavedNotes ? (
                      <textarea
                        value={data.notes}
                        onChange={(e) => handleChange(activeWeek.id, name, 'notes', e.target.value)}
                        placeholder="Gespreksnotities..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-workx-lime/30 focus:ring-1 focus:ring-workx-lime/20 transition-all"
                      />
                    ) : (
                      <div
                        onClick={() => setEditingNotes(prev => new Set(prev).add(key))}
                        className="cursor-pointer"
                      >
                        <ExpandableText
                          text={data.notes}
                          maxLines={3}
                          readOnly
                        />
                      </div>
                    )}
                  </div>

                  {/* Save button — only when dirty or in edit mode */}
                  {(dirty || isEditingNote) && (
                    <button
                      onClick={() => saveConversation(activeWeek.id, name, key, data)}
                      disabled={isSaving || !dirty}
                      className="mt-3 w-full px-3 py-2 rounded-lg bg-workx-lime/20 text-workx-lime text-xs font-bold hover:bg-workx-lime/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isSaving ? (
                        <span className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                      ) : (
                        <><Icons.save size={14} /> Opslaan</>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {weeks.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Icons.chat className="text-gray-600" size={28} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Geen weken gevonden</h3>
            <p className="text-gray-400 text-sm">Maak eerst een week aan via de Notulen pagina.</p>
          </div>
        )}

        {/* Info card */}
        <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icons.info className="text-blue-400" size={16} />
            </div>
            <div className="text-sm text-gray-400">
              <p className="text-white font-medium mb-1">Werkverdelingsgesprekken</p>
              <p>Houd hier per medewerker de werkverdelingsgesprekken bij. De partner wordt automatisch ingevuld vanuit de notulen-werkverdeling. Selecteer de capaciteit en voeg gespreksnotities toe. Klik op &quot;Opslaan&quot; om wijzigingen op te slaan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
