'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface Vacation {
  id: string
  personName: string
  startDate: string
  endDate: string
  note: string | null
  color: string
}

interface VacationBalance {
  personName: string
  overgedragenVorigJaar: number  // Dagen overgedragen van vorige jaren
  opbouwLopendJaar: number       // Dagen die dit jaar worden opgebouwd (wettelijk + bovenwettelijk)
  opgenomenLopendJaar: number    // Dagen opgenomen dit jaar
  // Berekend: resterend = overgedragen + opbouw - opgenomen
}

// Demo vakantiesaldo data (Hanna heeft dit ingevoerd)
const INITIAL_VACATION_BALANCES: VacationBalance[] = [
  { personName: 'Marnix Ritmeester', overgedragenVorigJaar: 5, opbouwLopendJaar: 25, opgenomenLopendJaar: 5 },
  { personName: 'Maaike de Jong', overgedragenVorigJaar: 2, opbouwLopendJaar: 25, opgenomenLopendJaar: 3 },
  { personName: 'Marlieke Schipper', overgedragenVorigJaar: 0, opbouwLopendJaar: 25, opgenomenLopendJaar: 8 },
  { personName: 'Kay Maes', overgedragenVorigJaar: 8, opbouwLopendJaar: 25, opgenomenLopendJaar: 5 },
  { personName: 'Justine Schellekens', overgedragenVorigJaar: 3, opbouwLopendJaar: 25, opgenomenLopendJaar: 1 },
  { personName: 'Juliette Niersman', overgedragenVorigJaar: 0, opbouwLopendJaar: 25, opgenomenLopendJaar: 10 },
  { personName: 'Jochem de Roos', overgedragenVorigJaar: 3.5, opbouwLopendJaar: 25, opgenomenLopendJaar: 8 },
  { personName: 'Julia Groen', overgedragenVorigJaar: 4, opbouwLopendJaar: 25, opgenomenLopendJaar: 5 },
  { personName: 'Hanna Blaauboer', overgedragenVorigJaar: 2, opbouwLopendJaar: 25, opgenomenLopendJaar: 5 },
  { personName: 'Erika van Zadelhof', overgedragenVorigJaar: 6, opbouwLopendJaar: 25, opgenomenLopendJaar: 12 },
  { personName: 'Emma van der Vos', overgedragenVorigJaar: 1, opbouwLopendJaar: 25, opgenomenLopendJaar: 2 },
  { personName: 'Bas den Ridder', overgedragenVorigJaar: 0, opbouwLopendJaar: 25, opgenomenLopendJaar: 4 },
  { personName: 'Barbara Rip', overgedragenVorigJaar: 7, opbouwLopendJaar: 25, opgenomenLopendJaar: 7 },
  { personName: 'Lotte van Sint Truiden', overgedragenVorigJaar: 4, opbouwLopendJaar: 25, opgenomenLopendJaar: 1 },
]

const COLORS = [
  { name: 'Lime', value: '#f9ff85', bg: 'bg-workx-lime/20', text: 'text-workx-lime' },
  { name: 'Blauw', value: '#60a5fa', bg: 'bg-blue-400/20', text: 'text-blue-400' },
  { name: 'Paars', value: '#a78bfa', bg: 'bg-purple-400/20', text: 'text-purple-400' },
  { name: 'Roze', value: '#f472b6', bg: 'bg-pink-400/20', text: 'text-pink-400' },
  { name: 'Oranje', value: '#fb923c', bg: 'bg-orange-400/20', text: 'text-orange-400' },
  { name: 'Groen', value: '#34d399', bg: 'bg-emerald-400/20', text: 'text-emerald-400' },
  { name: 'Cyan', value: '#22d3ee', bg: 'bg-cyan-400/20', text: 'text-cyan-400' },
  { name: 'Rood', value: '#f87171', bg: 'bg-red-400/20', text: 'text-red-400' },
]

const TEAM_MEMBERS = [
  'Marnix Ritmeester',
  'Maaike de Jong',
  'Marlieke Schipper',
  'Kay Maes',
  'Justine Schellekens',
  'Juliette Niersman',
  'Jochem de Roos',
  'Julia Groen',
  'Hanna Blaauboer',
  'Erika van Zadelhof',
  'Emma van der Vos',
  'Bas den Ridder',
  'Barbara Rip',
  'Lotte van Sint Truiden',
]

export default function VakantiesPage() {
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'timeline'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [pageMode, setPageMode] = useState<'overzicht' | 'beheer'>('overzicht')

  // Vacation balances state (Hanna's admin)
  const [vacationBalances, setVacationBalances] = useState<VacationBalance[]>(INITIAL_VACATION_BALANCES)
  const [editingBalance, setEditingBalance] = useState<string | null>(null)
  const [balanceForm, setBalanceForm] = useState({
    overgedragenVorigJaar: 0,
    opbouwLopendJaar: 25,
    opgenomenLopendJaar: 0,
  })
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  const [selectedBalancePerson, setSelectedBalancePerson] = useState('')

  // Form state
  const [personName, setPersonName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)

  // Balance management functions
  const handleEditBalance = (personName: string) => {
    const balance = vacationBalances.find(b => b.personName === personName)
    if (balance) {
      setSelectedBalancePerson(personName)
      setBalanceForm({
        overgedragenVorigJaar: balance.overgedragenVorigJaar,
        opbouwLopendJaar: balance.opbouwLopendJaar,
        opgenomenLopendJaar: balance.opgenomenLopendJaar,
      })
      setEditingBalance(personName)
    }
  }

  const handleSaveBalance = () => {
    if (!selectedBalancePerson) return

    setVacationBalances(prev => prev.map(b =>
      b.personName === selectedBalancePerson
        ? { ...b, ...balanceForm }
        : b
    ))
    toast.success(`Saldo bijgewerkt voor ${selectedBalancePerson.split(' ')[0]}`)
    setEditingBalance(null)
    setSelectedBalancePerson('')
  }

  const calculateResterend = (balance: VacationBalance) => {
    return balance.overgedragenVorigJaar + balance.opbouwLopendJaar - balance.opgenomenLopendJaar
  }

  useEffect(() => { fetchVacations() }, [])

  const fetchVacations = async () => {
    try {
      const res = await fetch('/api/vacations')
      if (res.ok) setVacations(await res.json())
    } catch (error) {
      // Use mock data for now
      setVacations([
        { id: '1', personName: 'Marnix Ritmeester', startDate: '2026-01-27', endDate: '2026-01-31', note: 'Skivakantie', color: '#60a5fa' },
        { id: '2', personName: 'Julia Groen', startDate: '2026-01-29', endDate: '2026-02-02', note: 'Lang weekend', color: '#f9ff85' },
        { id: '3', personName: 'Bas den Ridder', startDate: '2026-01-30', endDate: '2026-01-30', note: 'Tandarts', color: '#a78bfa' },
        { id: '4', personName: 'Hanna Blaauboer', startDate: '2026-02-03', endDate: '2026-02-07', note: 'Voorjaarsvakantie', color: '#34d399' },
        { id: '5', personName: 'Kay Maes', startDate: '2026-02-10', endDate: '2026-02-14', note: null, color: '#fb923c' },
        { id: '6', personName: 'Emma van der Vos', startDate: '2026-01-28', endDate: '2026-01-29', note: 'Ziek', color: '#f87171' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setPersonName('')
    setStartDate('')
    setEndDate('')
    setNote('')
    setSelectedColor(COLORS[0].value)
    setEditingId(null)
    setShowForm(false)
    setShowTeamDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!personName || !startDate || !endDate) return toast.error('Vul naam en datums in')

    const newVacation: Vacation = {
      id: editingId || Date.now().toString(),
      personName,
      startDate,
      endDate,
      note: note || null,
      color: selectedColor,
    }

    if (editingId) {
      setVacations(vacations.map(v => v.id === editingId ? newVacation : v))
      toast.success('Vakantie bijgewerkt')
    } else {
      setVacations([...vacations, newVacation])
      toast.success('Vakantie toegevoegd')
    }
    resetForm()
  }

  const handleEdit = (vacation: Vacation) => {
    setPersonName(vacation.personName)
    setStartDate(vacation.startDate)
    setEndDate(vacation.endDate)
    setNote(vacation.note || '')
    setSelectedColor(vacation.color)
    setEditingId(vacation.id)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setVacations(vacations.filter(v => v.id !== id))
    toast.success('Vakantie verwijderd')
  }

  // Helper functions
  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay() + 1) // Monday
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
    vacations.filter(v => isDateInRange(date, v.startDate, v.endDate))

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

  const formatDate = (date: Date) => date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  const formatDateFull = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })

  // Get unique people for timeline
  const uniquePeople = Array.from(new Set(vacations.map(v => v.personName)))

  // Get current week's vacations for summary
  const thisWeek = getWeekDays(new Date())
  const awayThisWeek = vacations.filter(v =>
    thisWeek.some(d => isDateInRange(d, v.startDate, v.endDate))
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
          {/* Mode Toggle */}
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
            <button
              onClick={() => setPageMode('beheer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pageMode === 'beheer' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.settings size={16} />
              Beheer
            </button>
          </div>
          {pageMode === 'overzicht' && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Icons.plus size={16} />
              Vakantie toevoegen
            </button>
          )}
        </div>
      </div>

      {/* BEHEER MODE - Admin interface for Hanna */}
      {pageMode === 'beheer' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center mb-3">
                  <Icons.users className="text-workx-lime" size={18} />
                </div>
                <p className="text-3xl font-semibold text-white">{vacationBalances.length}</p>
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
                  {vacationBalances.reduce((sum, b) => sum + calculateResterend(b), 0).toFixed(1)}
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
                  {vacationBalances.reduce((sum, b) => sum + b.opgenomenLopendJaar, 0)}
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
                    <p className="text-sm text-white/40">{selectedBalancePerson}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingBalance(null)
                    setSelectedBalancePerson('')
                  }}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Icons.x size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Overgedragen van vorige jaren</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.overgedragenVorigJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, overgedragenVorigJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Opbouw lopend jaar</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.opbouwLopendJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, opbouwLopendJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Opgenomen dit jaar</label>
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.opgenomenLopendJaar}
                    onChange={e => setBalanceForm({ ...balanceForm, opgenomenLopendJaar: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Resterend saldo</label>
                  <div className="px-4 py-3 bg-workx-lime/10 border border-workx-lime/20 rounded-xl text-workx-lime font-semibold">
                    {(balanceForm.overgedragenVorigJaar + balanceForm.opbouwLopendJaar - balanceForm.opgenomenLopendJaar).toFixed(1)} dagen
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingBalance(null)
                    setSelectedBalancePerson('')
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
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.list className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white">Vakantiesaldo per medewerker</h2>
              </div>
              <span className="badge badge-lime">{new Date().getFullYear()}</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-6 gap-4 px-5 py-3 bg-white/[0.02] border-b border-white/5 text-xs text-white/40 font-medium uppercase tracking-wider">
              <div className="col-span-2">Medewerker</div>
              <div className="text-right">Overgedragen</div>
              <div className="text-right">Opbouw</div>
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
                      key={balance.personName}
                      className={`grid grid-cols-6 gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors group ${
                        editingBalance === balance.personName ? 'bg-workx-lime/5' : ''
                      }`}
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center font-semibold text-sm text-white`}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-white">{balance.personName}</p>
                          <p className="text-xs text-white/40">
                            {balance.personName === 'Hanna Blaauboer' ? 'Admin' : 'Medewerker'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-white/70">{balance.overgedragenVorigJaar}</span>
                        <span className="text-white/30 text-sm ml-1">d</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white/70">{balance.opbouwLopendJaar}</span>
                        <span className="text-white/30 text-sm ml-1">d</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white/70">{balance.opgenomenLopendJaar}</span>
                        <span className="text-white/30 text-sm ml-1">d</span>
                      </div>
                      <div className="text-right flex items-center justify-end gap-3">
                        <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${
                          isLow
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-workx-lime/10 text-workx-lime'
                        }`}>
                          {resterend.toFixed(1)} d
                        </div>
                        <button
                          onClick={() => handleEditBalance(balance.personName)}
                          className="p-2 text-white/30 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Icons.edit size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Info card */}
          <div className="card p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.info className="text-blue-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Over vakantiedagen beheer</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hier kun je de vakantiedagen van alle medewerkers beheren. Klik op het bewerk-icoon om het saldo aan te passen.
                  Wijzigingen worden direct zichtbaar in het persoonlijke dashboard van de medewerker.
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
                <p className="text-3xl font-semibold text-white">{vacations.length}</p>
                <p className="text-sm text-white/40">Geplande vakanties</p>
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

      {/* Away This Week - Quick Overview */}
      {awayThisWeek.length > 0 && (
        <div className="card p-5 border-yellow-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Icons.alertTriangle className="text-yellow-400" size={16} />
            </div>
            <h2 className="font-medium text-white">Afwezig deze week</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {awayThisWeek.map(v => (
              <div
                key={v.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ backgroundColor: v.color + '20', color: v.color }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center font-semibold text-xs" style={{ backgroundColor: v.color + '30' }}>
                  {v.personName.charAt(0)}
                </div>
                <span className="font-medium text-white">{v.personName}</span>
                <span className="text-white/40 text-xs">
                  {formatDateFull(v.startDate)} - {formatDateFull(v.endDate)}
                </span>
              </div>
            ))}
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
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-sm text-workx-lime hover:bg-workx-lime/10 rounded-xl transition-colors"
          >
            Vandaag
          </button>
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
          <div className="p-5 border-b border-white/5">
            <h2 className="font-semibold text-white">
              Week van {formatDate(getWeekDays(currentDate)[0])} - {formatDate(getWeekDays(currentDate)[6])}
            </h2>
          </div>
          <div className="grid grid-cols-7">
            {getWeekDays(currentDate).map((day, i) => {
              const dayVacations = getVacationsForDate(day)
              return (
                <div
                  key={i}
                  className={`min-h-[200px] p-3 border-r border-white/5 last:border-r-0 ${
                    isToday(day) ? 'bg-workx-lime/5' : isWeekend(day) ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className={`text-center mb-3 ${isToday(day) ? 'text-workx-lime' : 'text-white/40'}`}>
                    <p className="text-xs font-medium uppercase">
                      {day.toLocaleDateString('nl-NL', { weekday: 'short' })}
                    </p>
                    <p className={`text-2xl font-semibold ${isToday(day) ? 'text-workx-lime' : 'text-white'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayVacations.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleEdit(v)}
                        className="w-full p-2 rounded-lg text-left transition-all hover:scale-105"
                        style={{ backgroundColor: v.color + '20' }}
                      >
                        <p className="text-xs font-medium text-white truncate">{v.personName}</p>
                        {v.note && <p className="text-[10px] text-white/40 truncate">{v.note}</p>}
                      </button>
                    ))}
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
          <div className="p-5 border-b border-white/5">
            <h2 className="font-semibold text-white capitalize">
              {currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
            </h2>
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
                return (
                  <div
                    key={i}
                    className={`min-h-[100px] p-2 rounded-xl transition-colors ${
                      day.isCurrentMonth ? 'hover:bg-white/5' : 'opacity-30'
                    } ${isToday(day.date) ? 'bg-workx-lime/10 ring-1 ring-workx-lime/30' : ''} ${
                      isWeekend(day.date) && day.isCurrentMonth ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      isToday(day.date) ? 'text-workx-lime' : day.isCurrentMonth ? 'text-white/60' : 'text-white/20'
                    }`}>
                      {day.date.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayVacations.slice(0, 3).map(v => (
                        <div
                          key={v.id}
                          className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium"
                          style={{ backgroundColor: v.color + '20', color: v.color }}
                        >
                          {v.personName.split(' ')[0]}
                        </div>
                      ))}
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
            {vacations.length === 0 ? (
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
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map((v, i) => {
                  const start = new Date(v.startDate)
                  const end = new Date(v.endDate)
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  const isPast = end < new Date()
                  const isActive = start <= new Date() && end >= new Date()

                  return (
                    <div
                      key={v.id}
                      className={`p-5 flex items-center gap-5 hover:bg-white/[0.02] transition-colors group ${isPast ? 'opacity-50' : ''}`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg flex-shrink-0"
                        style={{ backgroundColor: v.color + '20', color: v.color }}
                      >
                        {v.personName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-white">{v.personName}</h3>
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
                          <span>{days} {days === 1 ? 'dag' : 'dagen'}</span>
                          {v.note && (
                            <>
                              <span className="text-white/20">•</span>
                              <span>{v.note}</span>
                            </>
                          )}
                        </div>
                      </div>
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
              <div>
                <label className="block text-sm text-white/60 mb-2">Wie gaat er met vakantie?</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/50 focus:ring-1 focus:ring-workx-lime/20"
                  >
                    {personName ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center text-workx-lime font-semibold text-sm">
                          {personName.charAt(0)}
                        </div>
                        <span className="flex-1 text-white">{personName}</span>
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

                  {/* Custom Dropdown */}
                  {showTeamDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowTeamDropdown(false)} />
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                        <div className="p-2 border-b border-white/5">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider px-2">Team ({TEAM_MEMBERS.length})</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                          {TEAM_MEMBERS.map((name, index) => {
                            const isSelected = personName === name
                            const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2)
                            const colors = ['from-blue-500/30 to-blue-600/10', 'from-purple-500/30 to-purple-600/10', 'from-pink-500/30 to-pink-600/10', 'from-orange-500/30 to-orange-600/10', 'from-green-500/30 to-green-600/10', 'from-cyan-500/30 to-cyan-600/10']
                            const colorClass = colors[index % colors.length]

                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setPersonName(name)
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
                                <span className="flex-1 text-sm">{name}</span>
                                {isSelected && (
                                  <Icons.check size={16} className="text-workx-lime" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

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
                <label className="block text-sm text-white/60 mb-2">Notitie (optioneel)</label>
                <div className="relative">
                  <Icons.edit className="absolute left-3 top-3 text-white/30" size={16} />
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Bijv. skivakantie, familiebezoek..."
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Kleur</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        selectedColor === color.value ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value + '40' }}
                    >
                      {selectedColor === color.value && (
                        <Icons.check size={16} className="mx-auto" style={{ color: color.value }} />
                      )}
                    </button>
                  ))}
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
