'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import WeekSection from '@/components/notulen/WeekSection'
import ResponsibilityOverview from '@/components/notulen/ResponsibilityOverview'
import TextReveal from '@/components/ui/TextReveal'
import DatePicker from '@/components/ui/DatePicker'

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
  week?: { id: string; dateLabel: string }
}

interface Distribution {
  id?: string
  partnerName: string
  employeeName: string | null
  employeeId: string | null
}

interface Week {
  id: string
  monthId: string
  meetingDate: string
  dateLabel: string
  topics: Topic[]
  actions: Action[]
  distributions: Distribution[]
}

interface Month {
  id: string
  year: number
  month: number
  label: string
  isLustrum: boolean
  _count?: { weeks: number }
  weeks?: Week[]
}

interface Employee {
  id: string
  name: string
}

interface SearchResult {
  type: 'topic' | 'action'
  text: string
  weekLabel: string
  monthLabel: string
  monthId: string
}

const TEAM_MEMBERS_NOTULEN = [
  'Marnix', 'Jochem', 'Maaike', 'Bas', 'Juliette', 'Hanna',
  'Justine', 'Marlieke', 'Wies', 'Emma', 'Alain', 'Kay',
  'Erika', 'Barbara', 'Julia', 'Heleen', 'Lotte'
]

export default function NotulenPage() {
  const [months, setMonths] = useState<Month[]>([])
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMonth, setIsLoadingMonth] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [openActions, setOpenActions] = useState<Action[]>([])
  const [hasAccess, setHasAccess] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  // Add week state
  const [isAddingWeek, setIsAddingWeek] = useState(false)
  const [newWeekDate, setNewWeekDate] = useState<Date | null>(null)

  // Add month state
  const [isAddingMonth, setIsAddingMonth] = useState(false)
  const [newMonthYear, setNewMonthYear] = useState(new Date().getFullYear())
  const [newMonthMonth, setNewMonthMonth] = useState(new Date().getMonth() + 1)

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

  // Fetch months
  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch('/api/notulen')
      if (res.ok) {
        const data = await res.json()
        setMonths(data)
        // Auto-select most recent month if nothing selected
        if (!selectedMonthId && data.length > 0) {
          setSelectedMonthId(data[0].id)
        }
      }
    } catch {
      toast.error('Kon maanden niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonthId])

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('/api/team')
        if (res.ok) {
          const data = await res.json()
          setEmployees(data.filter((u: any) => u.isActive !== false).map((u: any) => ({ id: u.id, name: u.name })))
        }
      } catch {
        // ignore
      }
    }
    fetchEmployees()
  }, [])

  // Fetch open actions for bottom overview
  const fetchOpenActions = useCallback(async () => {
    try {
      const res = await fetch('/api/notulen/actions')
      if (res.ok) {
        const data = await res.json()
        setOpenActions(data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchMonths()
    fetchOpenActions()
  }, [fetchMonths, fetchOpenActions])

  // Fetch selected month data
  useEffect(() => {
    if (!selectedMonthId) return
    const fetchMonth = async () => {
      setIsLoadingMonth(true)
      try {
        const res = await fetch(`/api/notulen/${selectedMonthId}`)
        if (res.ok) {
          const data = await res.json()
          setSelectedMonth(data)
        }
      } catch {
        toast.error('Kon maand niet laden')
      } finally {
        setIsLoadingMonth(false)
      }
    }
    fetchMonth()
  }, [selectedMonthId])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/notulen/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
          setShowSearchResults(true)
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery])

  // Close search on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleDataChange = () => {
    // Refetch current month data
    if (selectedMonthId) {
      fetch(`/api/notulen/${selectedMonthId}`)
        .then(res => res.json())
        .then(data => setSelectedMonth(data))
        .catch(() => {})
    }
    fetchOpenActions()
  }

  const handleAddWeek = async () => {
    if (!newWeekDate || !selectedMonthId) return
    const dateLabel = newWeekDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const formattedLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

    try {
      const res = await fetch(`/api/notulen/${selectedMonthId}/weeks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate: newWeekDate.toISOString(), dateLabel: formattedLabel }),
      })
      if (!res.ok) throw new Error()
      toast.success('Week toegevoegd')
      setNewWeekDate(null)
      setIsAddingWeek(false)
      handleDataChange()
    } catch {
      toast.error('Kon week niet toevoegen')
    }
  }

  const handleAddMonth = async () => {
    const monthNames = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
    const label = `${monthNames[newMonthMonth]} ${newMonthYear}`

    try {
      const res = await fetch('/api/notulen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newMonthYear, month: newMonthMonth, label }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fout')
      }
      const newMonth = await res.json()
      toast.success('Maand toegevoegd')
      setIsAddingMonth(false)
      await fetchMonths()
      setSelectedMonthId(newMonth.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kon maand niet toevoegen')
    }
  }

  const handleDeleteWeek = async (weekId: string) => {
    if (!selectedMonthId || !confirm('Week en alle inhoud verwijderen?')) return
    try {
      const res = await fetch(`/api/notulen/${selectedMonthId}/weeks/${weekId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Week verwijderd')
      handleDataChange()
    } catch {
      toast.error('Kon week niet verwijderen')
    }
  }

  const handleToggleActionComplete = async (actionId: string, isCompleted: boolean) => {
    // Find which week this action belongs to
    const action = openActions.find(a => a.id === actionId)
    if (!action?.week) return

    // We need to find the monthId for this action - search through selectedMonth or use general endpoint
    try {
      // Use a generic PATCH - find the action's route through the open actions data
      // Since open actions come from a flat endpoint, we need a simpler approach
      // Let's iterate the selected month's weeks
      let monthId = selectedMonthId
      let weekId = action.week.id

      if (monthId) {
        const res = await fetch(`/api/notulen/${monthId}/weeks/${weekId}/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isCompleted }),
        })
        if (res.ok) {
          handleDataChange()
          return
        }
      }

      // Fallback: try all months
      for (const m of months) {
        const res = await fetch(`/api/notulen/${m.id}/weeks/${weekId}/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isCompleted }),
        })
        if (res.ok) {
          handleDataChange()
          return
        }
      }
    } catch {
      toast.error('Kon actiepunt niet bijwerken')
    }
  }

  if (!hasAccess) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <Icons.lock size={32} className="text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">Alleen toegankelijk voor partners en Hanna</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-gray-400">Notulen laden...</p>
        </div>
      </div>
    )
  }

  // Determine which week is "current" (closest to today)
  const today = new Date()
  const currentWeekId = selectedMonth?.weeks?.reduce((closest, week) => {
    const weekDate = new Date(week.meetingDate)
    const diff = Math.abs(weekDate.getTime() - today.getTime())
    const closestDiff = closest ? Math.abs(new Date(closest.meetingDate).getTime() - today.getTime()) : Infinity
    return diff < closestDiff ? week : closest
  }, null as Week | null)?.id

  return (
    <div className="space-y-8 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 flex items-center justify-center">
            <Icons.fileText className="text-yellow-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white"><TextReveal>Notulen</TextReveal></h1>
            <p className="text-sm text-gray-400">Maandagoverleg vergaderingen</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              placeholder="Zoeken in notulen..."
              className="w-64 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 transition-all"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute right-0 top-full mt-2 z-50 w-96 bg-workx-gray border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="py-2 max-h-80 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedMonthId(result.monthId)
                      setShowSearchResults(false)
                      setSearchQuery('')
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                        result.type === 'topic' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {result.type === 'topic' ? 'Agenda' : 'Actie'}
                      </span>
                      <span className="text-[10px] text-gray-500">{result.monthLabel} - {result.weekLabel}</span>
                    </div>
                    <p className="text-sm text-white/80 truncate">{result.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Month Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {months.map((month) => (
          <button
            key={month.id}
            onClick={() => setSelectedMonthId(month.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedMonthId === month.id
                ? month.isLustrum
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                  : 'bg-workx-lime text-workx-dark'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {month.isLustrum && <Icons.palmTree size={14} />}
            {month.label}
          </button>
        ))}
        {/* Add month button */}
        <button
          onClick={() => setIsAddingMonth(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-workx-lime hover:bg-white/5 transition-all"
        >
          <Icons.plus size={14} />
          <span>Maand</span>
        </button>
      </div>

      {/* Add month form */}
      {isAddingMonth && (
        <div className="card p-4 flex items-center gap-3">
          <select
            value={newMonthMonth}
            onChange={(e) => setNewMonthMonth(parseInt(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
          >
            {['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'].map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={newMonthYear}
            onChange={(e) => setNewMonthYear(parseInt(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleAddMonth} className="btn-primary px-4 py-2 text-sm">Toevoegen</button>
          <button onClick={() => setIsAddingMonth(false)} className="btn-secondary px-4 py-2 text-sm">Annuleren</button>
        </div>
      )}

      {/* Selected Month Content */}
      {isLoadingMonth ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-6 h-6 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : selectedMonth?.weeks && selectedMonth.weeks.length > 0 ? (
        <div className="space-y-4">
          {/* Add week button */}
          <div className="flex items-center gap-3">
            {isAddingWeek ? (
              <div className="flex items-center gap-3">
                <div className="w-64">
                  <DatePicker
                    selected={newWeekDate}
                    onChange={(date) => setNewWeekDate(date)}
                    placeholder="Kies vergaderdatum..."
                    dateFormat="EEEE d MMMM yyyy"
                  />
                </div>
                <button onClick={handleAddWeek} disabled={!newWeekDate} className="btn-primary px-4 py-2.5 text-sm rounded-xl disabled:opacity-30">Toevoegen</button>
                <button onClick={() => { setIsAddingWeek(false); setNewWeekDate(null) }} className="btn-secondary px-4 py-2.5 text-sm rounded-xl">Annuleren</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingWeek(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-workx-lime hover:border-workx-lime/30 transition-all"
              >
                <Icons.plus size={14} />
                Week toevoegen
              </button>
            )}
          </div>

          {/* Week sections */}
          {selectedMonth.weeks
            .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
            .map((week) => (
            <div key={week.id} className="relative group">
              <WeekSection
                weekId={week.id}
                monthId={selectedMonth.id}
                dateLabel={week.dateLabel}
                meetingDate={week.meetingDate}
                topics={week.topics}
                actions={week.actions}
                distributions={week.distributions}
                employees={employees}
                teamMembers={TEAM_MEMBERS_NOTULEN}
                defaultOpen={week.id === currentWeekId}
                onDataChange={handleDataChange}
              />
              {/* Delete week button */}
              <button
                onClick={() => handleDeleteWeek(week.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                title="Week verwijderen"
              >
                <Icons.trash size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : selectedMonth ? (
        <div className="card p-8 text-center">
          <Icons.calendar size={32} className="text-gray-500 mx-auto mb-3 opacity-50" />
          <p className="text-gray-400 mb-4">Nog geen weken in {selectedMonth.label}</p>
          <button
            onClick={() => setIsAddingWeek(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            <Icons.plus size={14} className="inline mr-1" />
            Eerste week toevoegen
          </button>
        </div>
      ) : months.length === 0 ? (
        <div className="card p-8 text-center">
          <Icons.fileText size={32} className="text-gray-500 mx-auto mb-3 opacity-50" />
          <p className="text-gray-400 mb-4">Nog geen notulen. Maak een maand aan om te beginnen.</p>
        </div>
      ) : null}

      {/* Responsibility Overview - all open actions */}
      {openActions.length > 0 && (
        <div className="pt-4 border-t border-white/5">
          <ResponsibilityOverview
            actions={openActions}
            onToggleComplete={handleToggleActionComplete}
          />
        </div>
      )}
    </div>
  )
}
