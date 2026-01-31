'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface VacationRequest {
  id: string
  userId: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  user: {
    id: string
    name: string
  }
}

interface VacationBalance {
  userId: string
  personName: string
  overgedragenVorigJaar: number
  opbouwLopendJaar: number
  bijgekocht: number
  opgenomenLopendJaar: number
  note?: string
  isPartner?: boolean
}

interface TeamMember {
  id: string
  name: string
  role: string
}

// Schoolvakanties Noord-Holland (Regio Noord)
interface SchoolHoliday {
  name: string
  startDate: string
  endDate: string
}

const SCHOOL_HOLIDAYS: SchoolHoliday[] = [
  // 2025
  { name: 'Voorjaarsvakantie 2025', startDate: '2025-02-22', endDate: '2025-03-02' },
  { name: 'Meivakantie 2025', startDate: '2025-04-26', endDate: '2025-05-11' },
  { name: 'Zomervakantie 2025', startDate: '2025-07-19', endDate: '2025-08-31' },
  { name: 'Herfstvakantie 2025', startDate: '2025-10-18', endDate: '2025-10-26' },
  { name: 'Kerstvakantie 2025', startDate: '2025-12-20', endDate: '2026-01-04' },
  // 2026
  { name: 'Voorjaarsvakantie 2026', startDate: '2026-02-21', endDate: '2026-03-01' },
  { name: 'Meivakantie 2026', startDate: '2026-04-25', endDate: '2026-05-10' },
  { name: 'Zomervakantie 2026', startDate: '2026-07-11', endDate: '2026-08-23' },
  { name: 'Herfstvakantie 2026', startDate: '2026-10-17', endDate: '2026-10-25' },
  { name: 'Kerstvakantie 2026', startDate: '2026-12-19', endDate: '2027-01-03' },
  // 2027
  { name: 'Voorjaarsvakantie 2027', startDate: '2027-02-20', endDate: '2027-02-28' },
  { name: 'Meivakantie 2027', startDate: '2027-05-01', endDate: '2027-05-09' },
  { name: 'Zomervakantie 2027', startDate: '2027-07-17', endDate: '2027-08-29' },
]

const COLORS = [
  { name: 'Lime', value: '#f9ff85' },
  { name: 'Blauw', value: '#60a5fa' },
  { name: 'Paars', value: '#a78bfa' },
  { name: 'Roze', value: '#f472b6' },
  { name: 'Oranje', value: '#fb923c' },
  { name: 'Groen', value: '#34d399' },
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Rood', value: '#f87171' },
]

// Assign a consistent color based on user name
function getColorForUser(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length].value
}

export default function VakantiesPage() {
  const { data: session } = useSession()
  const [vacations, setVacations] = useState<VacationRequest[]>([])
  const [vacationBalances, setVacationBalances] = useState<VacationBalance[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'timeline'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [pageMode, setPageMode] = useState<'overzicht' | 'beheer'>('overzicht')

  // Check if current user is admin/partner
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'

  // Balance editing state
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [selectedBalanceUserId, setSelectedBalanceUserId] = useState('')
  const [balanceForm, setBalanceForm] = useState({
    overgedragenVorigJaar: 0,
    opbouwLopendJaar: 25,
    bijgekocht: 0,
    opgenomenLopendJaar: 0,
  })

  // Vacation form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch vacations - all approved for everyone, or user's own if not admin
      const vacRes = await fetch('/api/vacation/requests?all=true')
      if (vacRes.ok) {
        const data = await vacRes.json()
        setVacations(data)
      }

      // Fetch team members
      const teamRes = await fetch('/api/team')
      if (teamRes.ok) {
        const data = await teamRes.json()
        setTeamMembers(data)
      }

      // Fetch balances (admin only)
      if (isAdmin) {
        const balRes = await fetch('/api/vacation/balances')
        if (balRes.ok) {
          const data = await balRes.json()
          setVacationBalances(data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Kon gegevens niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch when isAdmin changes (session loaded)
  useEffect(() => {
    if (session && isAdmin) {
      fetch('/api/vacation/balances')
        .then(res => res.ok ? res.json() : [])
        .then(data => setVacationBalances(data))
        .catch(() => {})
    }
  }, [session, isAdmin])

  const resetForm = () => {
    setSelectedUserId('')
    setStartDate('')
    setEndDate('')
    setReason('')
    setEditingId(null)
    setShowForm(false)
    setShowTeamDropdown(false)
  }

  // Create or update vacation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const targetUserId = selectedUserId || session?.user?.id
    if (!targetUserId || !startDate || !endDate) {
      toast.error('Vul alle velden in')
      return
    }

    try {
      if (editingId) {
        // Update existing vacation
        const res = await fetch(`/api/vacation/requests/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, reason }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Kon vakantie niet bijwerken')
        }
        toast.success('Vakantie bijgewerkt')
      } else {
        // Create new vacation
        const res = await fetch('/api/vacation/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate,
            endDate,
            reason,
            userId: targetUserId,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Kon vakantie niet aanmaken')
        }
        toast.success('Vakantie toegevoegd')
      }

      resetForm()
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // Delete vacation
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/vacation/requests/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kon vakantie niet verwijderen')
      }
      toast.success('Vakantie verwijderd')
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // Edit vacation
  const handleEdit = (vacation: VacationRequest) => {
    setSelectedUserId(vacation.userId)
    setStartDate(vacation.startDate.split('T')[0])
    setEndDate(vacation.endDate.split('T')[0])
    setReason(vacation.reason || '')
    setEditingId(vacation.id)
    setShowForm(true)
  }

  // Balance management
  const handleEditBalance = (balance: VacationBalance) => {
    setSelectedBalanceUserId(balance.userId)
    setBalanceForm({
      overgedragenVorigJaar: balance.overgedragenVorigJaar,
      opbouwLopendJaar: balance.opbouwLopendJaar,
      bijgekocht: balance.bijgekocht || 0,
      opgenomenLopendJaar: balance.opgenomenLopendJaar,
    })
    setEditingBalance(balance.personName)
  }

  const handleSaveBalance = async () => {
    if (!selectedBalanceUserId) return

    try {
      const res = await fetch('/api/vacation/balances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedBalanceUserId,
          ...balanceForm,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kon saldo niet bijwerken')
      }
      toast.success('Saldo bijgewerkt')
      setEditingBalance(null)
      setSelectedBalanceUserId('')
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const calculateResterend = (balance: VacationBalance) => {
    return balance.overgedragenVorigJaar + balance.opbouwLopendJaar + (balance.bijgekocht || 0) - balance.opgenomenLopendJaar
  }

  // Helper functions
  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay() + 1)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    const startingDay = (firstDay.getDay() + 6) % 7

    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    while (days.length < 42) {
      days.push({ date: new Date(year, month + 1, days.length - lastDay.getDate() - startingDay + 1), isCurrentMonth: false })
    }
    return days
  }

  const isDateInRange = (date: Date, start: string, end: string) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const s = new Date(start)
    const e = new Date(end)
    return d >= s && d <= e
  }

  const getVacationsForDate = (date: Date) =>
    vacations.filter(v => v.status === 'APPROVED' && isDateInRange(date, v.startDate, v.endDate))

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

  const getSchoolHoliday = (date: Date): SchoolHoliday | null => {
    const dateStr = date.toISOString().split('T')[0]
    for (const holiday of SCHOOL_HOLIDAYS) {
      if (dateStr >= holiday.startDate && dateStr <= holiday.endDate) {
        return holiday
      }
    }
    return null
  }

  const formatDate = (date: Date) => date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  const formatDateFull = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })

  // Get unique people for timeline
  const uniquePeople = Array.from(new Set(vacations.map(v => v.user.name)))

  // Get current week's vacations for summary
  const thisWeek = getWeekDays(new Date())
  const awayThisWeek = vacations.filter(v =>
    v.status === 'APPROVED' && thisWeek.some(d => isDateInRange(d, v.startDate, v.endDate))
  )

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-white/40">Vakanties laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 flex items-center justify-center">
              <Icons.sun className="text-yellow-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Vakanties</h1>
          </div>
          <p className="text-white/40">
            {pageMode === 'overzicht' ? 'Wie is er wanneer met vakantie' : 'Beheer vakantiedagen per medewerker'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode Toggle - only show Beheer for admin */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            <button
              onClick={() => setPageMode('overzicht')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pageMode === 'overzicht' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.calendar size={16} />
              Overzicht
            </button>
            {isAdmin && (
              <button
                onClick={() => setPageMode('beheer')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pageMode === 'beheer' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.settings size={16} />
                Beheer
              </button>
            )}
          </div>
          {pageMode === 'overzicht' && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Icons.plus size={16} />
              Vakantie toevoegen
            </button>
          )}
        </div>
      </div>

      {/* BEHEER MODE - Admin interface */}
      {pageMode === 'beheer' && isAdmin && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center mb-3">
                  <Icons.users className="text-workx-lime" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">{vacationBalances.filter(b => !b.isPartner).length}</p>
                <p className="text-sm text-white/40">Medewerkers</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                  <Icons.sun className="text-blue-400" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">
                  {vacationBalances.filter(b => !b.isPartner).reduce((sum, b) => sum + calculateResterend(b), 0).toFixed(1)}
                </p>
                <p className="text-sm text-white/40">Totaal resterend (team)</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                  <Icons.calendar className="text-purple-400" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">
                  {vacationBalances.filter(b => !b.isPartner).reduce((sum, b) => sum + b.opgenomenLopendJaar, 0)}
                </p>
                <p className="text-sm text-white/40">Opgenomen dit jaar (team)</p>
              </div>
            </div>
          </div>

          {/* Edit form (when editing) */}
          {editingBalance && (
            <div className="card p-6 border-workx-lime/20 bg-gradient-to-br from-workx-lime/5 to-transparent">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                    <Icons.edit className="text-workx-lime" size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Saldo bewerken</h3>
                    <p className="text-sm text-white/40">{editingBalance}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingBalance(null)
                    setSelectedBalanceUserId('')
                  }}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Icons.x size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Overgedragen</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.overgedragenVorigJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, overgedragenVorigJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Opbouw</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.opbouwLopendJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, opbouwLopendJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Bijgekocht</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.bijgekocht}
                    onChange={e => setBalanceForm({ ...balanceForm, bijgekocht: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Opgenomen</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.opgenomenLopendJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, opgenomenLopendJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Resterend</label>
                  <div className="px-4 py-3 bg-workx-lime/10 border border-workx-lime/20 rounded-xl text-workx-lime font-semibold">
                    {(balanceForm.overgedragenVorigJaar + balanceForm.opbouwLopendJaar + balanceForm.bijgekocht - balanceForm.opgenomenLopendJaar).toFixed(1)} d
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingBalance(null)
                    setSelectedBalanceUserId('')
                  }}
                  className="btn-secondary"
                >
                  Annuleren
                </button>
                <button onClick={handleSaveBalance} className="btn-primary flex items-center gap-2">
                  <Icons.check size={16} />
                  Opslaan
                </button>
              </div>
            </div>
          )}

          {/* Balances Table */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.list className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white text-sm sm:text-base">Vakantiesaldo per medewerker</h2>
              </div>
              <span className="badge badge-lime">{new Date().getFullYear()}</span>
            </div>

            {/* Table - scrollable on mobile */}
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Table header */}
                <div className="grid grid-cols-7 gap-4 px-5 py-3 bg-white/[0.02] border-b border-white/5 text-xs text-white/40 font-medium uppercase tracking-wider">
                  <div className="col-span-2">Medewerker</div>
                  <div className="text-right">Overgedragen</div>
                  <div className="text-right">Opbouw</div>
                  <div className="text-right">Bijgekocht</div>
                  <div className="text-right">Opgenomen</div>
              <div className="text-right">Resterend</div>
            </div>

            {/* Table body */}
            <div className="divide-y divide-white/5">
              {vacationBalances
                .sort((a, b) => a.personName.localeCompare(b.personName))
                .map((balance, index) => {
                  const resterend = calculateResterend(balance)
                  const isLow = resterend < 5
                  const initials = balance.personName.split(' ').map(n => n[0]).join('').slice(0, 2)
                  const colors = ['from-blue-500/30 to-blue-600/10', 'from-purple-500/30 to-purple-600/10', 'from-pink-500/30 to-pink-600/10', 'from-orange-500/30 to-orange-600/10', 'from-green-500/30 to-green-600/10', 'from-cyan-500/30 to-cyan-600/10']
                  const colorClass = colors[index % colors.length]

                  return (
                    <div
                      key={balance.userId}
                      className={`grid grid-cols-7 gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors group ${
                        editingBalance === balance.personName ? 'bg-workx-lime/5' : ''
                      }`}
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${balance.isPartner ? 'from-purple-500/30 to-purple-600/10' : colorClass} flex items-center justify-center font-semibold text-sm text-white`}>
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{balance.personName}</p>
                            {balance.isPartner && (
                              <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Partner</span>
                            )}
                          </div>
                          <p className="text-xs text-white/40">
                            {balance.isPartner ? 'Geen verlofrechten' : (balance.note || 'Medewerker')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {balance.isPartner ? (
                          <span className="text-white/30">-</span>
                        ) : (
                          <>
                            <span className="text-white/70">{balance.overgedragenVorigJaar}</span>
                            <span className="text-white/30 text-sm ml-1">d</span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        {balance.isPartner ? (
                          <span className="text-white/30">-</span>
                        ) : (
                          <>
                            <span className="text-white/70">{balance.opbouwLopendJaar}</span>
                            <span className="text-white/30 text-sm ml-1">d</span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        {balance.isPartner ? (
                          <span className="text-white/30">-</span>
                        ) : (balance.bijgekocht || 0) > 0 ? (
                          <>
                            <span className="text-green-400">{balance.bijgekocht}</span>
                            <span className="text-white/30 text-sm ml-1">d</span>
                          </>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </div>
                      <div className="text-right">
                        {balance.isPartner ? (
                          <span className="text-white/30">-</span>
                        ) : (
                          <>
                            <span className="text-white/70">{balance.opgenomenLopendJaar}</span>
                            <span className="text-white/30 text-sm ml-1">d</span>
                          </>
                        )}
                      </div>
                      <div className="text-right flex items-center justify-end gap-3">
                        {balance.isPartner ? (
                          <div className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white/30">
                            -
                          </div>
                        ) : (
                          <>
                            <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${
                              isLow
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-workx-lime/10 text-workx-lime'
                            }`}>
                              {resterend.toFixed(1)} d
                            </div>
                            <button
                              onClick={() => handleEditBalance(balance)}
                              className="p-2 text-white/30 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Icons.edit size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>

          {/* Info card */}
          <div className="card p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.info className="text-blue-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Over verlof beheer</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hier kun je de vakantiedagen van alle medewerkers beheren. Klik op het bewerk-icoon om het saldo aan te passen.
                  Wijzigingen worden direct opgeslagen in de database.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERZICHT MODE - Regular vacation calendar view */}
      {pageMode === 'overzicht' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-3">
                  <Icons.sun className="text-yellow-400" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">{awayThisWeek.length}</p>
                <p className="text-sm text-white/40">Afwezig deze week</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                  <Icons.calendar className="text-blue-400" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">{vacations.filter(v => v.status === 'APPROVED').length}</p>
                <p className="text-sm text-white/40">Goedgekeurde vakanties</p>
              </div>
            </div>

            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                  <Icons.users className="text-purple-400" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">{uniquePeople.length}</p>
                <p className="text-sm text-white/40">Teamleden met vakantie</p>
              </div>
            </div>
          </div>

          {/* School Holiday Notice */}
          <div className="card p-4 border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.alertTriangle className="text-red-400" size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white mb-0.5">Schoolvakanties Noord-Holland</h3>
                <p className="text-xs text-white/50">
                  Periodes gemarkeerd in <span className="text-red-400 font-medium">rood</span> zijn schoolvakanties.
                </p>
              </div>
            </div>
          </div>

          {/* Away This Week */}
          {awayThisWeek.length > 0 && (
            <div className="card p-5 border-yellow-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Icons.alertTriangle className="text-yellow-400" size={16} />
                </div>
                <h2 className="font-medium text-white">Afwezig deze week</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {awayThisWeek.map(v => {
                  const color = getColorForUser(v.user.name)
                  return (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                      style={{ backgroundColor: color + '20' }}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center font-semibold text-xs" style={{ backgroundColor: color + '30', color }}>
                        {v.user.name.charAt(0)}
                      </div>
                      <span className="font-medium text-white">{v.user.name}</span>
                      <span className="text-white/40 text-xs">
                        {formatDateFull(v.startDate)} - {formatDateFull(v.endDate)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* View Toggle & Navigation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'week' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.calendar size={16} />
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'month' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.grid size={16} />
                Maand
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'timeline' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.list size={16} />
                Timeline
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newDate = new Date(currentDate)
                  if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7)
                  else newDate.setMonth(newDate.getMonth() - 1)
                  setCurrentDate(newDate)
                }}
                className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                <Icons.chevronLeft size={18} />
              </button>
              <span className="px-4 py-2 text-sm text-white/60 min-w-[140px] text-center">
                {viewMode === 'week'
                  ? `Week ${Math.ceil((currentDate.getDate() + new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()) / 7)}`
                  : currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
                }
              </span>
              <button
                onClick={() => {
                  const newDate = new Date(currentDate)
                  if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7)
                  else newDate.setMonth(newDate.getMonth() + 1)
                  setCurrentDate(newDate)
                }}
                className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                <Icons.chevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Week View */}
          {viewMode === 'week' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-semibold text-white">
                  Week van {formatDate(getWeekDays(currentDate)[0])} - {formatDate(getWeekDays(currentDate)[6])}
                </h2>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                  <span>Schoolvakantie</span>
                </div>
              </div>
              <div className="grid grid-cols-7">
                {getWeekDays(currentDate).map((day, i) => {
                  const dayVacations = getVacationsForDate(day)
                  const schoolHoliday = getSchoolHoliday(day)
                  return (
                    <div
                      key={i}
                      className={`min-h-[200px] p-3 border-r border-white/5 last:border-r-0 relative ${
                        isToday(day) ? 'bg-workx-lime/5' : schoolHoliday ? 'bg-red-500/[0.08]' : isWeekend(day) ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      {schoolHoliday && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/40 via-red-500/60 to-red-500/40" />
                      )}
                      <div className={`text-center mb-3 ${isToday(day) ? 'text-workx-lime' : schoolHoliday ? 'text-red-400/80' : 'text-white/40'}`}>
                        <p className="text-xs font-medium uppercase">
                          {day.toLocaleDateString('nl-NL', { weekday: 'short' })}
                        </p>
                        <p className={`text-2xl font-semibold ${isToday(day) ? 'text-workx-lime' : schoolHoliday ? 'text-red-400' : 'text-white'}`}>
                          {day.getDate()}
                        </p>
                        {schoolHoliday && (
                          <p className="text-[9px] text-red-400/70 mt-0.5 truncate px-1">{schoolHoliday.name.replace(/\s*\d{4}$/, '')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayVacations.map(v => {
                          const color = getColorForUser(v.user.name)
                          return (
                            <button
                              key={v.id}
                              onClick={() => handleEdit(v)}
                              className="w-full p-2 rounded-lg text-left transition-all hover:scale-105"
                              style={{ backgroundColor: color + '20' }}
                            >
                              <p className="text-xs font-medium text-white truncate">{v.user.name}</p>
                              {v.reason && <p className="text-[10px] text-white/40 truncate">{v.reason}</p>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Month View */}
          {viewMode === 'month' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-semibold text-white capitalize">
                  {currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                  <span>Schoolvakantie</span>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-7 mb-3">
                  {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                    <div key={day} className="text-center text-xs text-white/40 py-2 font-medium">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getMonthDays(currentDate).map((day, i) => {
                    const dayVacations = getVacationsForDate(day.date)
                    const schoolHoliday = getSchoolHoliday(day.date)
                    return (
                      <div
                        key={i}
                        className={`min-h-[100px] p-2 rounded-xl transition-colors relative ${
                          day.isCurrentMonth ? 'hover:bg-white/5' : 'opacity-30'
                        } ${isToday(day.date) ? 'bg-workx-lime/10 ring-1 ring-workx-lime/30' : ''} ${
                          schoolHoliday && day.isCurrentMonth ? 'bg-red-500/[0.08] ring-1 ring-red-500/20' :
                          isWeekend(day.date) && day.isCurrentMonth ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        {schoolHoliday && day.isCurrentMonth && (
                          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500/50" title={schoolHoliday.name} />
                        )}
                        <span className={`text-sm font-medium ${
                          isToday(day.date) ? 'text-workx-lime' :
                          schoolHoliday && day.isCurrentMonth ? 'text-red-400' :
                          day.isCurrentMonth ? 'text-white/60' : 'text-white/20'
                        }`}>
                          {day.date.getDate()}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayVacations.slice(0, 3).map(v => {
                            const color = getColorForUser(v.user.name)
                            return (
                              <div
                                key={v.id}
                                className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium"
                                style={{ backgroundColor: color + '20', color }}
                              >
                                {v.user.name.split(' ')[0]}
                              </div>
                            )
                          })}
                          {dayVacations.length > 3 && (
                            <span className="text-[10px] text-white/40">+{dayVacations.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="font-semibold text-white">Overzicht per persoon</h2>
              </div>
              <div className="divide-y divide-white/5">
                {vacations.filter(v => v.status === 'APPROVED').length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                      <Icons.sun className="text-yellow-400/50" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Geen vakanties gepland</h3>
                    <p className="text-white/40 mb-4">Voeg een vakantie toe om te beginnen</p>
                    <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
                      <Icons.plus size={16} />
                      Vakantie toevoegen
                    </button>
                  </div>
                ) : (
                  vacations
                    .filter(v => v.status === 'APPROVED')
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .map((v, i) => {
                      const start = new Date(v.startDate)
                      const end = new Date(v.endDate)
                      const isPast = end < new Date()
                      const isActive = start <= new Date() && end >= new Date()
                      const color = getColorForUser(v.user.name)
                      const canEdit = isAdmin || v.userId === session?.user?.id

                      return (
                        <div
                          key={v.id}
                          className={`p-5 flex items-center gap-5 hover:bg-white/[0.02] transition-colors group ${isPast ? 'opacity-50' : ''}`}
                        >
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg flex-shrink-0"
                            style={{ backgroundColor: color + '20', color }}
                          >
                            {v.user.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium text-white">{v.user.name}</h3>
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">
                                  Nu afwezig
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-white/40">
                              <span className="flex items-center gap-1.5">
                                <Icons.calendar size={12} />
                                {formatDateFull(v.startDate)} - {formatDateFull(v.endDate)}
                              </span>
                              <span className="text-white/20">•</span>
                              <span>{v.days} {v.days === 1 ? 'dag' : 'dagen'}</span>
                              {v.reason && (
                                <>
                                  <span className="text-white/20">•</span>
                                  <span>{v.reason}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(v)}
                                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <Icons.edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              >
                                <Icons.trash size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div
            className="bg-workx-gray rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Icons.sun className="text-yellow-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">
                  {editingId ? 'Vakantie bewerken' : 'Vakantie toevoegen'}
                </h2>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Team member selection - only for admins */}
              {isAdmin && (
                <div>
                  <label className="block text-sm text-white/60 mb-2">Wie gaat er met vakantie?</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                      className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/50 focus:ring-1 focus:ring-workx-lime/20"
                    >
                      {selectedUserId ? (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center text-workx-lime font-semibold text-sm">
                            {teamMembers.find(m => m.id === selectedUserId)?.name?.charAt(0) || '?'}
                          </div>
                          <span className="flex-1 text-white">{teamMembers.find(m => m.id === selectedUserId)?.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <Icons.user className="text-white/30" size={16} />
                          </div>
                          <span className="flex-1 text-white/40">Selecteer een teamlid...</span>
                        </>
                      )}
                      <Icons.chevronDown
                        size={18}
                        className={`text-white/30 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showTeamDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTeamDropdown(false)} />
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                          <div className="max-h-64 overflow-y-auto py-1">
                            {teamMembers.map((member, index) => {
                              const isSelected = selectedUserId === member.id
                              const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                              const colors = ['from-blue-500/30 to-blue-600/10', 'from-purple-500/30 to-purple-600/10', 'from-pink-500/30 to-pink-600/10', 'from-orange-500/30 to-orange-600/10', 'from-green-500/30 to-green-600/10', 'from-cyan-500/30 to-cyan-600/10']
                              const colorClass = colors[index % colors.length]

                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserId(member.id)
                                    setShowTeamDropdown(false)
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                                    isSelected
                                      ? 'bg-workx-lime/10 text-white'
                                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center font-semibold text-xs text-white`}>
                                    {initials}
                                  </div>
                                  <span className="flex-1 text-sm">{member.name}</span>
                                  {isSelected && <Icons.check size={16} className="text-workx-lime" />}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Van</label>
                  <div className="relative">
                    <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Tot en met</label>
                  <div className="relative">
                    <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      min={startDate}
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Reden (optioneel)</label>
                <div className="relative">
                  <Icons.edit className="absolute left-3 top-3 text-white/30" size={16} />
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Bijv. skivakantie, familiebezoek..."
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={resetForm} className="flex-1 btn-secondary">
                  Annuleren
                </button>
                <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
                  <Icons.check size={16} />
                  {editingId ? 'Bijwerken' : 'Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
