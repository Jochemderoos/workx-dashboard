'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface ParentalLeave {
  id: string
  childNumber: number
  kindNaam: string | null
  kindGeboorteDatum: string | null
  uitgerekendeDatum: string | null
  zwangerschapsverlofStart: string | null
  zwangerschapsverlofStatus: string | null
  geboorteverlofPartner: string | null
  aanvullendVerlofPartner: string | null
  betaaldTotaalUren: number
  betaaldOpgenomenUren: number
  betaaldVerlofDetails: string | null
  onbetaaldTotaalDagen: number
  onbetaaldOpgenomenDagen: number
  onbetaaldVerlofDetails: string | null
  uwvAangevraagd: boolean
  uwvDetails: string | null
  note: string | null
}

interface VacationBalance {
  overgedragenVorigJaar: number
  opbouwLopendJaar: number
  bijgekocht: number
  opgenomenLopendJaar: number
}

interface SalaryScale {
  id: string
  experienceYear: number
  label: string
  salary: number
  hourlyRateBase: number
}

interface EmployeeData {
  id: string
  name: string
  email: string
  role: string
  startDate: string | null
  department: string | null
  compensation: {
    experienceYear: number | null
    hourlyRate: number
    salary: number | null
    isHourlyWage: boolean
    notes: string | null
  } | null
  bonusPaid: number
  bonusPending: number
  bonusTotal: number
  vacationBalance: VacationBalance | null
  parentalLeaves: ParentalLeave[]
}

interface SickDayEntry {
  id: string
  userId: string
  startDate: string
  endDate: string
  workDays: number
  note: string | null
}

interface SickDaysResponse {
  entries: SickDayEntry[]
  totals: { userId: string; totalDays: number }[]
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [salaryScales, setSalaryScales] = useState<SalaryScale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const currentYear = new Date().getFullYear()

  // Sick days state
  const [sickDaysData, setSickDaysData] = useState<SickDaysResponse>({ entries: [], totals: [] })
  const [showSickDaysModal, setShowSickDaysModal] = useState(false)
  const [sickDaysMember, setSickDaysMember] = useState<EmployeeData | null>(null)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [entryMode, setEntryMode] = useState<'single' | 'period'>('single')
  const [sickStartDate, setSickStartDate] = useState('')
  const [sickEndDate, setSickEndDate] = useState('')
  const [sickDaysNote, setSickDaysNote] = useState('')
  const [isSavingSickDays, setIsSavingSickDays] = useState(false)
  const [isDeletingEntry, setIsDeletingEntry] = useState<string | null>(null)

  // Parental leave modal state
  const [showParentalModal, setShowParentalModal] = useState(false)
  const [parentalMember, setParentalMember] = useState<EmployeeData | null>(null)
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false)
  const [editingLeave, setEditingLeave] = useState<ParentalLeave | null>(null)
  const [isSavingLeave, setIsSavingLeave] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    kindNaam: '',
    kindGeboorteDatum: '',
    uitgerekendeDatum: '',
    zwangerschapsverlofStart: '',
    zwangerschapsverlofStatus: '',
    geboorteverlofPartner: '',
    aanvullendVerlofPartner: '',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 0,
    betaaldVerlofDetails: '',
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    onbetaaldVerlofDetails: '',
    uwvAangevraagd: false,
    uwvDetails: '',
    note: ''
  })

  // Check permissions
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'
  const currentUserId = session?.user?.id

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (isManager) {
      fetchSickDays()
    }
  }, [isManager, selectedYear])

  const fetchData = async () => {
    try {
      const [empRes, scaleRes] = await Promise.all([
        fetch('/api/financien/employee-compensation'),
        fetch('/api/financien/salary-scales')
      ])
      if (empRes.ok) setEmployees(await empRes.json())
      if (scaleRes.ok) setSalaryScales(await scaleRes.json())
    } catch (error) {
      toast.error('Kon team niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSickDays = async () => {
    try {
      const res = await fetch(`/api/sick-days?year=${selectedYear}`)
      if (res.ok) setSickDaysData(await res.json())
    } catch (error) {
      console.error('Error fetching sick days:', error)
    }
  }

  const getSickDays = (memberId: string) => sickDaysData.totals.find(t => t.userId === memberId)?.totalDays || 0
  const getMemberEntries = (memberId: string) => sickDaysData.entries.filter(e => e.userId === memberId)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  const formatDateNL = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatDateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

  // Sort: current user first, then alphabetically
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })

  const filteredEmployees = sortedEmployees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openSickDaysModal = (member: EmployeeData) => {
    setSickDaysMember(member)
    setEntryMode('single')
    setSickStartDate('')
    setSickEndDate('')
    setSickDaysNote('')
    setShowSickDaysModal(true)
  }

  const handleSaveSickDays = async () => {
    if (!sickDaysMember || !sickStartDate) return toast.error('Selecteer een datum')
    if (entryMode === 'period' && !sickEndDate) return toast.error('Selecteer een einddatum')

    setIsSavingSickDays(true)
    try {
      const res = await fetch('/api/sick-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sickDaysMember.id,
          startDate: sickStartDate,
          endDate: entryMode === 'period' ? sickEndDate : sickStartDate,
          note: sickDaysNote || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Kon niet opslaan')
      toast.success(`Ziektedag(en) toegevoegd voor ${sickDaysMember.name}`)
      setSickStartDate('')
      setSickEndDate('')
      setSickDaysNote('')
      fetchSickDays()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSavingSickDays(false)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    setIsDeletingEntry(entryId)
    try {
      const res = await fetch(`/api/sick-days?id=${entryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Kon niet verwijderen')
      toast.success('Ziektedag verwijderd')
      fetchSickDays()
    } catch (error) {
      toast.error('Kon ziektedag niet verwijderen')
    } finally {
      setIsDeletingEntry(null)
    }
  }

  const openParentalModal = (member: EmployeeData) => {
    setParentalMember(member)
    setShowAddLeaveForm(false)
    setEditingLeave(null)
    resetLeaveForm()
    setShowParentalModal(true)
  }

  const resetLeaveForm = () => {
    setLeaveForm({
      kindNaam: '',
      kindGeboorteDatum: '',
      uitgerekendeDatum: '',
      zwangerschapsverlofStart: '',
      zwangerschapsverlofStatus: '',
      geboorteverlofPartner: '',
      aanvullendVerlofPartner: '',
      betaaldTotaalUren: 324,
      betaaldOpgenomenUren: 0,
      betaaldVerlofDetails: '',
      onbetaaldTotaalDagen: 85,
      onbetaaldOpgenomenDagen: 0,
      onbetaaldVerlofDetails: '',
      uwvAangevraagd: false,
      uwvDetails: '',
      note: ''
    })
  }

  const startEditLeave = (leave: ParentalLeave) => {
    setEditingLeave(leave)
    setLeaveForm({
      kindNaam: leave.kindNaam || '',
      kindGeboorteDatum: leave.kindGeboorteDatum ? leave.kindGeboorteDatum.split('T')[0] : '',
      uitgerekendeDatum: leave.uitgerekendeDatum ? leave.uitgerekendeDatum.split('T')[0] : '',
      zwangerschapsverlofStart: leave.zwangerschapsverlofStart ? leave.zwangerschapsverlofStart.split('T')[0] : '',
      zwangerschapsverlofStatus: leave.zwangerschapsverlofStatus || '',
      geboorteverlofPartner: leave.geboorteverlofPartner || '',
      aanvullendVerlofPartner: leave.aanvullendVerlofPartner || '',
      betaaldTotaalUren: leave.betaaldTotaalUren,
      betaaldOpgenomenUren: leave.betaaldOpgenomenUren,
      betaaldVerlofDetails: leave.betaaldVerlofDetails || '',
      onbetaaldTotaalDagen: leave.onbetaaldTotaalDagen,
      onbetaaldOpgenomenDagen: leave.onbetaaldOpgenomenDagen,
      onbetaaldVerlofDetails: leave.onbetaaldVerlofDetails || '',
      uwvAangevraagd: leave.uwvAangevraagd,
      uwvDetails: leave.uwvDetails || '',
      note: leave.note || ''
    })
    setShowAddLeaveForm(true)
  }

  const handleSaveLeave = async () => {
    if (!parentalMember) return
    setIsSavingLeave(true)

    try {
      const payload = {
        ...leaveForm,
        kindGeboorteDatum: leaveForm.kindGeboorteDatum || null,
        uitgerekendeDatum: leaveForm.uitgerekendeDatum || null,
        zwangerschapsverlofStart: leaveForm.zwangerschapsverlofStart || null,
      }

      if (editingLeave) {
        // Update existing
        const res = await fetch('/api/parental-leave', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingLeave.id, ...payload })
        })
        if (!res.ok) throw new Error('Kon niet opslaan')
        toast.success('Verlof bijgewerkt')
      } else {
        // Create new
        const res = await fetch('/api/parental-leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: parentalMember.id, ...payload })
        })
        if (!res.ok) throw new Error('Kon niet opslaan')
        toast.success('Verlof toegevoegd')
      }

      // Refresh data
      await fetchData()
      setShowAddLeaveForm(false)
      setEditingLeave(null)
      resetLeaveForm()
    } catch (error: any) {
      toast.error(error.message || 'Er ging iets mis')
    } finally {
      setIsSavingLeave(false)
    }
  }

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm('Weet je zeker dat je dit verlof wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/parental-leave?id=${leaveId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Kon niet verwijderen')
      toast.success('Verlof verwijderd')
      await fetchData()
    } catch (error) {
      toast.error('Kon verlof niet verwijderen')
    }
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-gray-400">Team laden...</p>
        </div>
      </div>
    )
  }

  // Render full employee card (voetbalplaatje style)
  const renderEmployeeCard = (employee: EmployeeData, isCurrentUser: boolean) => {
    const photoUrl = getPhotoUrl(employee.name)
    const yearsAtWorkx = employee.startDate
      ? Math.floor((new Date().getTime() - new Date(employee.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : null

    const firstName = employee.name.split(' ')[0].toLowerCase()
    const isSupportStaff = firstName === 'hanna' || firstName === 'lotte'
    const isHourlyWage = employee.compensation?.isHourlyWage || false
    const salaryScale = employee.compensation?.experienceYear !== null && employee.compensation?.experienceYear !== undefined
      ? salaryScales.find(s => s.experienceYear === employee.compensation?.experienceYear)
      : null

    // Determine what to show based on role
    const showFullInfo = isCurrentUser || isManager
    const hasParentalLeave = employee.parentalLeaves && employee.parentalLeaves.length > 0
    const hasPregnancyLeave = employee.parentalLeaves?.some(l => l.zwangerschapsverlofStart)
    const isExpanded = expandedCard === employee.id

    return (
      <div key={employee.id} className="relative group">
        {/* Glow effect on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${isSupportStaff ? 'from-cyan-400/30 via-cyan-400/10' : 'from-workx-lime/30 via-workx-lime/10'} to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />

        <div className="relative bg-gradient-to-br from-workx-dark/80 to-workx-dark/40 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
          {/* Top accent bar */}
          <div className={`h-1 bg-gradient-to-r ${isSupportStaff ? 'from-cyan-400 via-cyan-400/50' : 'from-workx-lime via-workx-lime/50'} to-transparent`} />

          {/* Photo and Name Section */}
          <div className="p-4 sm:p-6 pb-4">
            <div className="flex items-start gap-4">
              {/* Photo with badge */}
              <div className="relative flex-shrink-0">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-2 ${isSupportStaff ? 'ring-cyan-400/30 shadow-cyan-400/20' : 'ring-workx-lime/30 shadow-workx-lime/20'} shadow-lg`}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${isSupportStaff ? 'from-cyan-400 to-cyan-400/60' : 'from-workx-lime to-workx-lime/60'} flex items-center justify-center`}>
                      <span className="text-workx-dark text-xl sm:text-2xl font-bold">{employee.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                {/* Experience badge for lawyers */}
                {!isSupportStaff && employee.compensation?.experienceYear !== null && employee.compensation?.experienceYear !== undefined && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-workx-lime flex items-center justify-center shadow-lg">
                    <span className="text-workx-dark text-xs font-bold">{employee.compensation.experienceYear}</span>
                  </div>
                )}
                {/* Staff badge */}
                {isSupportStaff && (
                  <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-lg bg-cyan-400 flex items-center justify-center shadow-lg">
                    <span className="text-workx-dark text-[10px] font-bold">{firstName === 'hanna' ? 'H.O.O.' : 'STAFF'}</span>
                  </div>
                )}
              </div>

              {/* Name and Role */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-lg truncate">
                  {employee.name}
                  {isCurrentUser && <span className="ml-2 text-xs text-workx-lime">(jij)</span>}
                </h3>
                <p className="text-gray-400 text-sm">
                  {firstName === 'hanna' ? 'Head of Office' : employee.role === 'ADMIN' ? 'Head of Office' : employee.role === 'EMPLOYEE' ? 'Advocaat' : employee.role === 'PARTNER' ? 'Partner' : employee.role}
                </p>
                {employee.startDate && (
                  <p className={`${isSupportStaff ? 'text-cyan-400/60' : 'text-workx-lime/60'} text-xs mt-1`}>
                    In dienst: {formatDateNL(employee.startDate)}
                    {yearsAtWorkx !== null && yearsAtWorkx > 0 && ` (${yearsAtWorkx} jaar)`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats Section - Always show experience year and hourly rate */}
          <div className="px-4 sm:px-6 py-4 border-t border-white/5 bg-black/20">
            {isSupportStaff ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                    {isHourlyWage ? 'Uurloon' : 'Salaris'}
                  </p>
                  <p className="text-cyan-400 font-semibold">
                    {showFullInfo && employee.compensation?.salary
                      ? isHourlyWage
                        ? `€${employee.compensation.salary}/uur`
                        : formatCurrency(employee.compensation.salary)
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Type</p>
                  <p className="text-white font-medium">
                    {isHourlyWage ? 'Uurloner' : 'Vast contract'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {/* Row 1: Experience Year and Hourly Rate */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-gray-400 text-sm block mb-1">Ervaringsjaar</span>
                    <span className="text-white text-base">
                      {salaryScale?.label || (employee.compensation?.experienceYear !== null ? `${employee.compensation?.experienceYear}e jaars` : '-')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-sm block mb-1">Uurtarief</span>
                    <span className="text-workx-lime text-base font-semibold">
                      {employee.compensation ? `€${employee.compensation.hourlyRate}` : '-'}
                    </span>
                  </div>
                </div>

                {/* Row 2: Salary - only for current user or manager */}
                {showFullInfo && (
                  <div className="pt-4 border-t border-gray-700">
                    <span className="text-gray-400 text-sm block mb-1">Bruto Salaris</span>
                    <span className="text-white font-bold text-xl">
                      {employee.compensation?.salary ? formatCurrency(employee.compensation.salary) : (salaryScale ? formatCurrency(salaryScale.salary) : '-')}
                    </span>
                    <span className="text-gray-500 text-sm ml-1">/mnd</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bonus Section - only for lawyers and when showFullInfo */}
          {showFullInfo && !isSupportStaff && (
            <div className="px-4 sm:px-6 py-4 border-t border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Bonus {currentYear}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-white/60 text-xs">Betaald</span>
                  </div>
                  <p className="text-green-400 font-semibold">{formatCurrency(employee.bonusPaid)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
                    <span className="text-white/60 text-xs">In afwachting</span>
                  </div>
                  <p className="text-orange-400 font-semibold">{formatCurrency(employee.bonusPending)}</p>
                </div>
              </div>
              {employee.bonusTotal > 0 && (
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: `${(employee.bonusPaid / employee.bonusTotal) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Vacation Section - only when showFullInfo */}
          {showFullInfo && employee.vacationBalance && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icons.sun size={14} className="text-green-400" />
                  <span className="text-gray-400 text-sm">Vakantiedagen {currentYear}</span>
                </div>
                {hasParentalLeave && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">O.V.</span>
                )}
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-2xl font-bold text-green-400">
                    {(employee.vacationBalance.opbouwLopendJaar + employee.vacationBalance.overgedragenVorigJaar + employee.vacationBalance.bijgekocht - employee.vacationBalance.opgenomenLopendJaar).toFixed(1)}
                  </span>
                  <span className="text-gray-400 text-sm block">dagen over</span>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm">
                    <span className="text-gray-500">Totaal: </span>
                    <span className="text-gray-300">{(employee.vacationBalance.opbouwLopendJaar + employee.vacationBalance.overgedragenVorigJaar + employee.vacationBalance.bijgekocht).toFixed(1)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Opgenomen: </span>
                    <span className="text-gray-300">{employee.vacationBalance.opgenomenLopendJaar.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parental Leave Summary - only when showFullInfo and has leave */}
          {showFullInfo && hasParentalLeave && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icons.users size={14} className="text-purple-400" />
                  <span className="text-gray-400 text-sm">Verlof</span>
                </div>
                {employee.parentalLeaves.length > 1 && (
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : employee.id)}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {isExpanded ? 'Minder' : 'Meer details'}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {employee.parentalLeaves.slice(0, isExpanded ? undefined : 1).map((leave) => (
                  <div key={leave.id} className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    {/* Zwangerschaps/bevallingsverlof */}
                    {leave.zwangerschapsverlofStart && (
                      <div className="mb-2 pb-2 border-b border-purple-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-pink-400 text-xs font-medium">Zwangerschaps-/bevallingsverlof</span>
                        </div>
                        <p className="text-white/80 text-sm">
                          Vanaf {formatDateShort(leave.zwangerschapsverlofStart)}
                          {leave.zwangerschapsverlofStatus && <span className="text-gray-400 ml-1">({leave.zwangerschapsverlofStatus})</span>}
                        </p>
                      </div>
                    )}

                    {/* Kind info */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-purple-400 font-medium">
                        {leave.kindNaam || `Kind ${leave.childNumber}`}
                      </span>
                      <div className="flex items-center gap-2">
                        {leave.uwvAangevraagd && <span className="text-green-400 text-[10px]">UWV ✓</span>}
                      </div>
                    </div>

                    {/* Betaald ouderschapsverlof */}
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-purple-400/70">Betaald O.V.</span>
                      <span className="text-white/60">{leave.betaaldOpgenomenUren}/{leave.betaaldTotaalUren} uur</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-purple-400" style={{ width: `${(leave.betaaldOpgenomenUren / leave.betaaldTotaalUren) * 100}%` }} />
                    </div>

                    {/* Onbetaald ouderschapsverlof */}
                    {leave.onbetaaldTotaalDagen > 0 && (
                      <>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-purple-400/70">Onbetaald O.V.</span>
                          <span className="text-white/60">{leave.onbetaaldOpgenomenDagen}/{leave.onbetaaldTotaalDagen} dagen</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400/60" style={{ width: `${(leave.onbetaaldOpgenomenDagen / leave.onbetaaldTotaalDagen) * 100}%` }} />
                        </div>
                      </>
                    )}

                    {/* Geboorteverlof partner */}
                    {leave.geboorteverlofPartner && (
                      <p className="text-xs text-gray-400 mt-2">
                        Geboorteverlof partner: {leave.geboorteverlofPartner}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!isExpanded && employee.parentalLeaves.length > 1 && (
                <p className="text-xs text-gray-500 mt-2">
                  + {employee.parentalLeaves.length - 1} meer kind(eren)
                </p>
              )}
            </div>
          )}

          {/* Sick Days Section - only for managers and not for Partners */}
          {isManager && employee.role !== 'PARTNER' && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icons.heart size={14} className="text-red-400" />
                  <span className="text-gray-400 text-sm">Ziektedagen {currentYear}</span>
                </div>
                <span className={`text-lg font-semibold ${getSickDays(employee.id) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {getSickDays(employee.id)} dagen
                </span>
              </div>
              {getSickDays(employee.id) > 5 && (
                <p className="text-xs text-red-400/60 mt-1">
                  Meer dan 5 ziektedagen dit jaar
                </p>
              )}
            </div>
          )}

          {/* Manager Actions - only show buttons when relevant */}
          {isManager && employee.role !== 'PARTNER' && (
            <div className="px-4 sm:px-6 py-3 border-t border-white/5 bg-black/10 flex gap-2">
              <button
                onClick={() => openSickDaysModal(employee)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-all"
              >
                <Icons.heart size={14} />
                <span>Ziektedagen</span>
              </button>
              <button
                onClick={() => openParentalModal(employee)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs transition-all"
              >
                <Icons.users size={14} />
                <span>{hasParentalLeave ? 'O.V. Details' : 'Verlof toevoegen'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
            <Icons.users className="text-cyan-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">Team</h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base hidden sm:block">
          Overzicht van het Workx team
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek teamleden..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all"
        />
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee) => renderEmployeeCard(employee, employee.id === currentUserId))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Icons.users className="text-white/20" size={32} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Geen teamleden gevonden</h3>
          <p className="text-gray-400">Probeer een andere zoekterm</p>
        </div>
      )}

      {/* Sick Days Modal */}
      {showSickDaysModal && sickDaysMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16 sm:pt-20 overflow-y-auto" onClick={() => setShowSickDaysModal(false)}>
          <div className="card p-6 w-full max-w-lg relative my-auto" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Icons.heart className="text-red-400" size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-lg">Ziektedagen</h2>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-red-500/30"
                  >
                    {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                      <option key={year} value={year} className="bg-workx-dark">{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => setShowSickDaysModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Icons.x size={18} />
              </button>
            </div>

            {/* Member info */}
            <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-white/10">
                  {getPhotoUrl(sickDaysMember.name) ? (
                    <img src={getPhotoUrl(sickDaysMember.name)!} alt={sickDaysMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-workx-lime to-workx-lime/60 flex items-center justify-center">
                      <span className="text-workx-dark font-bold">{sickDaysMember.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{sickDaysMember.name}</p>
                  <p className="text-sm text-gray-400 truncate">{sickDaysMember.email}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-2xl font-semibold ${getSickDays(sickDaysMember.id) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {getSickDays(sickDaysMember.id)}
                </p>
                <p className="text-xs text-gray-500">werkdagen</p>
              </div>
            </div>

            {/* Existing entries */}
            {getMemberEntries(sickDaysMember.id).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm text-gray-400 mb-3">Geregistreerde periodes</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getMemberEntries(sickDaysMember.id).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:border-red-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Icons.calendar size={14} className="text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">
                            {formatDateNL(entry.startDate)}
                            {entry.startDate !== entry.endDate && <span className="text-gray-400"> - {formatDateNL(entry.endDate)}</span>}
                          </p>
                          {entry.note && <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-400 font-medium">{entry.workDays} {entry.workDays === 1 ? 'dag' : 'dagen'}</span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={isDeletingEntry === entry.id}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          {isDeletingEntry === entry.id ? (
                            <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <Icons.trash size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new entry */}
            <div className="border-t border-white/5 pt-6">
              <h3 className="text-sm text-gray-400 mb-4">Nieuwe ziektedag(en) toevoegen</h3>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setEntryMode('single')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${entryMode === 'single' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
                >
                  Enkele dag
                </button>
                <button
                  onClick={() => setEntryMode('period')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${entryMode === 'period' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'}`}
                >
                  Periode
                </button>
              </div>

              <div className="space-y-4">
                <div className={`grid gap-4 ${entryMode === 'period' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">{entryMode === 'single' ? 'Datum' : 'Startdatum'}</label>
                    <input type="date" value={sickStartDate} onChange={e => setSickStartDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/30 transition-all" />
                  </div>
                  {entryMode === 'period' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Einddatum</label>
                      <input type="date" value={sickEndDate} onChange={e => setSickEndDate(e.target.value)} min={sickStartDate} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/30 transition-all" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Notitie (optioneel)</label>
                  <input type="text" value={sickDaysNote} onChange={e => setSickDaysNote(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/30 transition-all" placeholder="Bijv. griep, rugklachten..." />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowSickDaysModal(false)} className="flex-1 btn-secondary">Sluiten</button>
                <button
                  onClick={handleSaveSickDays}
                  disabled={isSavingSickDays || !sickStartDate || (entryMode === 'period' && !sickEndDate)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingSickDays ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Icons.plus size={16} />Toevoegen</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parental Leave Modal */}
      {showParentalModal && parentalMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-8 sm:pt-12 overflow-y-auto" onClick={() => setShowParentalModal(false)}>
          <div className="card p-6 w-full max-w-2xl relative my-4" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Icons.users className="text-purple-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">
                  {showAddLeaveForm ? (editingLeave ? 'Verlof bewerken' : 'Nieuw verlof') : 'Ouderschapsverlof'}
                </h2>
              </div>
              <button onClick={() => setShowParentalModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Icons.x size={18} />
              </button>
            </div>

            {/* Member info */}
            <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-purple-500/20">
                {getPhotoUrl(parentalMember.name) ? (
                  <img src={getPhotoUrl(parentalMember.name)!} alt={parentalMember.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-400/60 flex items-center justify-center">
                    <span className="text-workx-dark font-bold">{parentalMember.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-white">{parentalMember.name}</p>
                <p className="text-sm text-gray-400">{parentalMember.email}</p>
              </div>
            </div>

            {!showAddLeaveForm ? (
              <>
                {/* Existing leaves list */}
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {parentalMember.parentalLeaves.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Icons.users size={32} className="mx-auto mb-3 opacity-50" />
                      <p>Geen verlof geregistreerd</p>
                    </div>
                  ) : (
                    parentalMember.parentalLeaves.map((leave) => (
                      <div key={leave.id} className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-purple-400 font-semibold">{leave.kindNaam || `Kind ${leave.childNumber}`}</h4>
                          <div className="flex items-center gap-2">
                            {leave.uwvAangevraagd && <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">UWV ✓</span>}
                            <button onClick={() => startEditLeave(leave)} className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all">
                              <Icons.edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteLeave(leave.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                              <Icons.trash size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-400">Betaald O.V.</span>
                            <p className="text-white">{leave.betaaldOpgenomenUren}/{leave.betaaldTotaalUren} uur</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Onbetaald O.V.</span>
                            <p className="text-white">{leave.onbetaaldOpgenomenDagen}/{leave.onbetaaldTotaalDagen} dagen</p>
                          </div>
                        </div>

                        {leave.zwangerschapsverlofStart && (
                          <p className="text-xs text-pink-400 mt-2">
                            Zwangerschapsverlof vanaf {formatDateNL(leave.zwangerschapsverlofStart)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
                  <button onClick={() => setShowParentalModal(false)} className="flex-1 btn-secondary">Sluiten</button>
                  <button onClick={() => { resetLeaveForm(); setShowAddLeaveForm(true) }} className="flex-1 btn-primary flex items-center justify-center gap-2">
                    <Icons.plus size={16} />
                    Kind toevoegen
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Add/Edit form */}
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {/* Kind info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Naam kind</label>
                      <input
                        type="text"
                        value={leaveForm.kindNaam}
                        onChange={e => setLeaveForm({ ...leaveForm, kindNaam: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30"
                        placeholder="Bijv. Emma"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Geboortedatum</label>
                      <input
                        type="date"
                        value={leaveForm.kindGeboorteDatum}
                        onChange={e => setLeaveForm({ ...leaveForm, kindGeboorteDatum: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Uitgerekende datum (indien nog niet geboren)</label>
                    <input
                      type="date"
                      value={leaveForm.uitgerekendeDatum}
                      onChange={e => setLeaveForm({ ...leaveForm, uitgerekendeDatum: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30"
                    />
                  </div>

                  {/* Zwangerschapsverlof */}
                  <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
                    <h4 className="text-pink-400 font-medium text-sm mb-3">Zwangerschaps-/bevallingsverlof (WAZO)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Startdatum verlof</label>
                        <input
                          type="date"
                          value={leaveForm.zwangerschapsverlofStart}
                          onChange={e => setLeaveForm({ ...leaveForm, zwangerschapsverlofStart: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Status</label>
                        <input
                          type="text"
                          value={leaveForm.zwangerschapsverlofStatus}
                          onChange={e => setLeaveForm({ ...leaveForm, zwangerschapsverlofStatus: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/30"
                          placeholder="Bijv. 16 weken ontvangen"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Partner verlof */}
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <h4 className="text-blue-400 font-medium text-sm mb-3">Geboorteverlof partner</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">1 week geboorteverlof</label>
                        <input
                          type="text"
                          value={leaveForm.geboorteverlofPartner}
                          onChange={e => setLeaveForm({ ...leaveForm, geboorteverlofPartner: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/30"
                          placeholder="Bijv. 1 week opgenomen"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">5 weken aanvullend</label>
                        <input
                          type="text"
                          value={leaveForm.aanvullendVerlofPartner}
                          onChange={e => setLeaveForm({ ...leaveForm, aanvullendVerlofPartner: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/30"
                          placeholder="Bijv. 5 weken aangevraagd"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Betaald ouderschapsverlof */}
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <h4 className="text-purple-400 font-medium text-sm mb-3">Betaald ouderschapsverlof (9 weken, 70% UWV)</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Totaal uren</label>
                        <input
                          type="number"
                          value={leaveForm.betaaldTotaalUren}
                          onChange={e => setLeaveForm({ ...leaveForm, betaaldTotaalUren: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Opgenomen uren</label>
                        <input
                          type="number"
                          value={leaveForm.betaaldOpgenomenUren}
                          onChange={e => setLeaveForm({ ...leaveForm, betaaldOpgenomenUren: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Details</label>
                      <textarea
                        value={leaveForm.betaaldVerlofDetails}
                        onChange={e => setLeaveForm({ ...leaveForm, betaaldVerlofDetails: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30 min-h-[60px] resize-none"
                        placeholder="Bijv. Vanaf 1 aug elke vrijdag..."
                      />
                    </div>
                  </div>

                  {/* Onbetaald ouderschapsverlof */}
                  <div className="p-4 rounded-xl bg-gray-500/5 border border-gray-500/20">
                    <h4 className="text-gray-400 font-medium text-sm mb-3">Onbetaald ouderschapsverlof (17 weken)</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Totaal dagen</label>
                        <input
                          type="number"
                          value={leaveForm.onbetaaldTotaalDagen}
                          onChange={e => setLeaveForm({ ...leaveForm, onbetaaldTotaalDagen: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Opgenomen dagen</label>
                        <input
                          type="number"
                          value={leaveForm.onbetaaldOpgenomenDagen}
                          onChange={e => setLeaveForm({ ...leaveForm, onbetaaldOpgenomenDagen: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-500/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Details</label>
                      <textarea
                        value={leaveForm.onbetaaldVerlofDetails}
                        onChange={e => setLeaveForm({ ...leaveForm, onbetaaldVerlofDetails: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-500/30 min-h-[60px] resize-none"
                        placeholder="Bijv. Elke maandag onbetaald..."
                      />
                    </div>
                  </div>

                  {/* UWV Status */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-gray-300 font-medium text-sm mb-3">UWV Status</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leaveForm.uwvAangevraagd}
                          onChange={e => setLeaveForm({ ...leaveForm, uwvAangevraagd: e.target.checked })}
                          className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                        />
                        <span className="text-sm text-gray-300">Aangevraagd/ontvangen bij UWV</span>
                      </label>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">UWV Details</label>
                        <textarea
                          value={leaveForm.uwvDetails}
                          onChange={e => setLeaveForm({ ...leaveForm, uwvDetails: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30 min-h-[60px] resize-none"
                          placeholder="Bijv. WAZO en 9 weken betaald O.V. ontvangen"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notities */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Notities</label>
                    <textarea
                      value={leaveForm.note}
                      onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/30 min-h-[80px] resize-none"
                      placeholder="Eventuele opmerkingen..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
                  <button
                    onClick={() => { setShowAddLeaveForm(false); setEditingLeave(null); resetLeaveForm() }}
                    className="flex-1 btn-secondary"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleSaveLeave}
                    disabled={isSavingLeave}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {isSavingLeave ? (
                      <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Icons.check size={16} />
                        {editingLeave ? 'Opslaan' : 'Toevoegen'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
