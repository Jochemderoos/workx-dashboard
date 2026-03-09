'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import Image from 'next/image'
import { TEAM_PHOTOS, ADVOCATEN, PARTNERS, getPhotoUrl } from '@/lib/team-photos'
import ZakenToewijzing from '@/components/zaken/ZakenToewijzing'
import { useLopendeZaken } from '@/lib/hooks/useData'
import SpotlightCard from '@/components/ui/SpotlightCard'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import ScrollReveal, { ScrollRevealItem } from '@/components/ui/ScrollReveal'
import MagneticButton from '@/components/ui/MagneticButton'
import TextReveal from '@/components/ui/TextReveal'

interface WorkItem {
  id: string
  title: string
  description: string | null
  status: 'NEW' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'ON_HOLD'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: string | null
  estimatedHours: number | null
  actualHours: number | null
  clientName: string | null
  caseNumber: string | null
  createdAt: string
  assignee: { id: string; name: string } | null
  createdBy: { id: string; name: string }
}

// Workload types
type WorkloadLevel = 'green' | 'yellow' | 'orange' | 'red' | null

interface WorkloadEntry {
  personName: string
  date: string // YYYY-MM-DD
  level: WorkloadLevel
  hours?: number | null
}

// Monthly hours types
interface MonthlyHoursEntry {
  id: string
  employeeName: string
  year: number
  month: number
  billableHours: number
  workedHours: number
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
]

const workloadConfig = {
  green: { label: 'Rustig', color: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  yellow: { label: 'Normaal', color: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  orange: { label: 'Druk', color: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  red: { label: 'Zeer druk', color: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
}

export default function PartnersWerkPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [pageMode, setPageMode] = useState<'toewijzing' | 'werkdruk' | 'urenoverzicht' | 'lopendezaken'>('werkdruk')

  // Monthly hours state
  const [monthlyHours, setMonthlyHours] = useState<MonthlyHoursEntry[]>([])
  const [prevYearHours, setPrevYearHours] = useState<MonthlyHoursEntry[]>([])
  const [showHoursUploadModal, setShowHoursUploadModal] = useState(false)
  const [isUploadingHours, setIsUploadingHours] = useState(false)

  // Dynamic year selection - show current year and previous year
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return [currentYear - 1, currentYear] as const
  }, [])

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const currentYear = new Date().getFullYear()
    return currentYear // Default to current year
  })

  // Workload state
  const [workloadEntries, setWorkloadEntries] = useState<WorkloadEntry[]>([])
  const [editingWorkload, setEditingWorkload] = useState<{ person: string; date: string } | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadDate, setUploadDate] = useState<Date | null>(new Date())
  const [isUploading, setIsUploading] = useState(false)

  // State for navigating history
  const [historyOffset, setHistoryOffset] = useState(0)

  // Calculate workdays with offset for navigation
  // Only show today after 20:00 CET
  const workdaysToShow = useMemo(() => {
    const days: Date[] = []
    const now = new Date()
    const currentHour = now.getHours()

    // Start from today or yesterday based on time
    let current = new Date(now)

    // If it's before 20:00, don't include today
    if (currentHour < 20) {
      current.setDate(current.getDate() - 1)
    }

    // Apply history offset
    current.setDate(current.getDate() - (historyOffset * 5))

    while (days.length < 5) {
      const dayOfWeek = current.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push(new Date(current))
      }
      current.setDate(current.getDate() - 1)
    }

    return days.reverse() // Oldest first
  }, [historyOffset])

  // Include weekend days ONLY on Monday before 20:00 (current week view)
  // Weekend = the Sat/Sun right after the last Friday in the workdays range
  const daysToDisplay = useMemo(() => {
    if (workdaysToShow.length === 0) return workdaysToShow

    const now = new Date()
    const dow = now.getDay()
    const hr = now.getHours()
    // Weekend columns visible from Sunday 18:00 until Monday 20:00, only for current view (no history)
    const showWeekend = ((dow === 0 && hr >= 18) || (dow === 1 && hr < 20)) && historyOffset === 0

    if (!showWeekend) return workdaysToShow

    // Find the last Friday in the range and add Sat/Sun after it (if data exists)
    const lastWorkday = workdaysToShow[workdaysToShow.length - 1]
    const result = [...workdaysToShow]

    const saturday = new Date(lastWorkday)
    saturday.setDate(saturday.getDate() + 1)
    const sunday = new Date(lastWorkday)
    sunday.setDate(sunday.getDate() + 2)

    const satStr = formatDateForAPI(saturday)
    const sunStr = formatDateForAPI(sunday)

    if (saturday.getDay() === 6 && workloadEntries.some(e => e.date === satStr)) {
      result.push(saturday)
    }
    if (sunday.getDay() === 0 && workloadEntries.some(e => e.date === sunStr)) {
      result.push(sunday)
    }

    return result
  }, [workdaysToShow, workloadEntries, historyOffset])

  const last3Workdays = daysToDisplay

  // Partners are only visible Friday 20:00 – Monday 20:00
  const today = new Date()
  const currentDayOfWeek = today.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const currentHourNow = today.getHours()
  const showPartners = currentDayOfWeek === 0 || currentDayOfWeek === 6  // Sat & Sun: always
    || (currentDayOfWeek === 5 && currentHourNow >= 20)                  // Friday from 20:00
    || (currentDayOfWeek === 1 && currentHourNow < 20)                   // Monday until 20:00
  const peopleToShow = showPartners ? [...PARTNERS, ...ADVOCATEN] : ADVOCATEN

  // Helper to check if a date is a weekend
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

  // Calculate week total hours for a person (include weekend days with data)
  const getWeekTotal = (person: string): number => {
    let total = 0
    for (const day of daysToDisplay) {
      const entry = workloadEntries.find(e => e.personName === person && e.date === formatDateForAPI(day))
      if (entry?.hours) total += entry.hours
    }
    return total
  }

  // Get workload for a specific person and date
  const getWorkload = (person: string, date: Date): WorkloadLevel => {
    const dateStr = formatDateForAPI(date)
    const entry = workloadEntries.find(e => e.personName === person && e.date === dateStr)
    return entry?.level || null
  }

  // Get workload entry with hours for a specific person and date
  const getWorkloadEntry = (person: string, date: Date): WorkloadEntry | null => {
    const dateStr = formatDateForAPI(date)
    const entry = workloadEntries.find(e => e.personName === person && e.date === dateStr)
    return entry || null
  }

  // Set workload for a person on a date - saves to API
  const saveWorkload = async (person: string, date: Date, level: WorkloadLevel) => {
    const dateStr = formatDateForAPI(date)

    try {
      const res = await fetch('/api/workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName: person, date: dateStr, level })
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Kon werkdruk niet opslaan')
        return
      }

      // Update local state
      setWorkloadEntries(prev => {
        const filtered = prev.filter(e => !(e.personName === person && e.date === dateStr))
        if (level) {
          return [...filtered, { personName: person, date: dateStr, level }]
        }
        return filtered
      })
      toast.success(`Werkdruk bijgewerkt voor ${person.split(' ')[0]}`)
    } catch (error) {
      toast.error('Kon werkdruk niet opslaan')
    }
    setEditingWorkload(null)
  }

  // Rolling 7-day team totals — altijd zichtbaar, doorlopend venster
  // "Afgelopen week" = gisteren t/m 7 dagen terug, daarna steeds 7-daagse blokken
  const weeklyReport = useMemo(() => {
    if (historyOffset !== 0) return null

    const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

    // Bepaal de nieuwste dag met data
    const entriesWithHours = workloadEntries.filter(e => e.hours)
    if (entriesWithHours.length === 0) return null
    const latestDate = entriesWithHours.reduce((max, e) => e.date > max ? e.date : max, entriesWithHours[0].date)
    const anchor = new Date(latestDate + 'T00:00:00')

    const weeks: { label: string; totalHours: number; personCount: number }[] = []

    // 7 periodes van 7 dagen, tellend vanaf de nieuwste ingevoerde dag
    for (let w = 0; w < 7; w++) {
      const periodEnd = new Date(anchor)
      periodEnd.setDate(periodEnd.getDate() - (w * 7))
      const periodStart = new Date(periodEnd)
      periodStart.setDate(periodStart.getDate() - 6) // 7 dagen eerder

      const startDay = periodStart.getDate()
      const endDay = periodEnd.getDate()
      const startMonth = months[periodStart.getMonth()]
      const endMonth = months[periodEnd.getMonth()]
      const label = startMonth === endMonth
        ? `${startDay} - ${endDay} ${endMonth}`
        : `${startDay} ${startMonth} - ${endDay} ${endMonth}`

      let totalHours = 0
      const personsSet = new Set<string>()

      const startStr = formatDateForAPI(periodStart)
      const endStr = formatDateForAPI(periodEnd)

      for (const entry of workloadEntries) {
        if (!entry.hours) continue
        if (entry.date >= startStr && entry.date <= endStr) {
          totalHours += entry.hours
          personsSet.add(entry.personName)
        }
      }

      weeks.push({ label, totalHours, personCount: personsSet.size })
    }

    // Statistieken
    const currentWeek = weeks[0]
    const compareWeeks = weeks.slice(1).filter(w => w.totalHours > 0)
    const avg = compareWeeks.length > 0
      ? compareWeeks.reduce((sum, w) => sum + w.totalHours, 0) / compareWeeks.length
      : 0
    const prevWeek = weeks[1]
    const allWithHours = weeks.filter(w => w.totalHours > 0)
    const maxWeek = allWithHours.length > 0 ? [...allWithHours].sort((a, b) => b.totalHours - a.totalHours)[0] : null
    const minWeek = allWithHours.length > 0 ? [...allWithHours].sort((a, b) => a.totalHours - b.totalHours)[0] : null

    const vsAvgPct = avg > 0 ? ((currentWeek.totalHours - avg) / avg) * 100 : 0
    const vsPrevPct = prevWeek.totalHours > 0
      ? ((currentWeek.totalHours - prevWeek.totalHours) / prevWeek.totalHours) * 100
      : 0

    const ratio = avg > 0 ? currentWeek.totalHours / avg : 1
    let color: 'green' | 'lime' | 'orange' | 'red'
    let colorLabel: string
    if (ratio <= 0.85) { color = 'green'; colorLabel = 'Rustige week' }
    else if (ratio <= 1.10) { color = 'lime'; colorLabel = 'Normale week' }
    else if (ratio <= 1.30) { color = 'orange'; colorLabel = 'Drukke week' }
    else { color = 'red'; colorLabel = 'Heel drukke week' }

    return { weeks, currentWeek, avg, prevWeek, maxWeek, minWeek, vsAvgPct, vsPrevPct, color, colorLabel }
  }, [workloadEntries, historyOffset])

  // Count workload levels for today
  const todayStats = useMemo(() => {
    const today = formatDateForAPI(new Date())
    const todayEntries = workloadEntries.filter(e => e.date === today)
    return {
      green: todayEntries.filter(e => e.level === 'green').length,
      yellow: todayEntries.filter(e => e.level === 'yellow').length,
      orange: todayEntries.filter(e => e.level === 'orange').length,
      red: todayEntries.filter(e => e.level === 'red').length,
      notFilled: ADVOCATEN.length - todayEntries.length,
    }
  }, [workloadEntries])

  useEffect(() => {
    checkAuthorization()
  }, [])

  // Fetch workload when authorized
  useEffect(() => {
    if (isAuthorized) {
      fetchWorkload()
    }
  }, [isAuthorized])

  // Fetch monthly hours when year changes or when switching to urenoverzicht
  useEffect(() => {
    if (pageMode === 'urenoverzicht' && isAuthorized) {
      fetchMonthlyHours()
    }
  }, [pageMode, selectedYear, isAuthorized])

  const checkAuthorization = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const user = await res.json()
        const isManager = user.role === 'PARTNER' || user.role === 'ADMIN'
        if (isManager) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
          toast.error('Je hebt geen toegang tot deze pagina')
        }
      } else {
        setIsAuthorized(false)
      }
    } catch (error) {
      console.error('Kon gebruiker niet laden')
      setIsAuthorized(false)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkload = async () => {
    try {
      const year = new Date().getFullYear()
      const res = await fetch(`/api/workload?year=${year}&year2=${year - 1}`)
      if (res.ok) {
        const data = await res.json()
        setWorkloadEntries(data.map((e: { personName: string; date: string; level: string; hours?: number | null }) => ({
          personName: e.personName,
          date: e.date,
          level: e.level as WorkloadLevel,
          hours: e.hours
        })))
      }
    } catch (error) {
      console.error('Kon werkdruk niet laden')
    }
  }

  // Upload RTF bestand en verwerk uren naar werkdruk
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    // Date is now optional - the file contains Dutch dates that are parsed automatically
    if (uploadDate) {
      formData.append('date', formatDateForAPI(uploadDate))
    }

    try {
      const res = await fetch('/api/workload/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload mislukt')
      }

      // Show dates that were processed
      const datesMsg = data.dates?.length > 1
        ? `voor ${data.dates.length} dagen`
        : data.dates?.[0] || ''
      toast.success(`${data.processed} entries verwerkt ${datesMsg}`)
      setShowUploadModal(false)
      fetchWorkload() // Herlaad de werkdruk data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload mislukt')
    } finally {
      setIsUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const fetchMonthlyHours = async () => {
    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/monthly-hours?year=${selectedYear}`),
        fetch(`/api/monthly-hours?year=${selectedYear - 1}`)
      ])
      if (res.ok) {
        const data = await res.json()
        setMonthlyHours(data)
      }
      if (prevRes.ok) {
        const prevData = await prevRes.json()
        setPrevYearHours(prevData)
      } else {
        setPrevYearHours([])
      }
    } catch (error) {
      console.error('Kon urenoverzicht niet laden')
    }
  }

  const handleHoursUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingHours(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('year', selectedYear.toString())

    try {
      const res = await fetch('/api/monthly-hours/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload mislukt')
      }

      toast.success(`${data.monthlyRecords} maandrecords verwerkt`)
      setShowHoursUploadModal(false)
      fetchMonthlyHours()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload mislukt')
    } finally {
      setIsUploadingHours(false)
      e.target.value = ''
    }
  }

  // Prepare monthly hours data for display
  const monthlyHoursData = useMemo(() => {
    const employees = Array.from(new Set(monthlyHours.map(h => h.employeeName))).sort()
    const data: Record<string, Record<number, { billable: number; worked: number }>> = {}

    for (const emp of employees) {
      data[emp] = {}
      for (let m = 1; m <= 12; m++) {
        const entry = monthlyHours.find(h => h.employeeName === emp && h.month === m)
        data[emp][m] = entry
          ? { billable: entry.billableHours, worked: entry.workedHours }
          : { billable: 0, worked: 0 }
      }
    }

    // Calculate totals per employee
    const totals: Record<string, { billable: number; worked: number }> = {}
    for (const emp of employees) {
      totals[emp] = { billable: 0, worked: 0 }
      for (let m = 1; m <= 12; m++) {
        totals[emp].billable += data[emp][m].billable
        totals[emp].worked += data[emp][m].worked
      }
    }

    // Calculate monthly totals
    const monthlyTotals: Record<number, { billable: number; worked: number }> = {}
    for (let m = 1; m <= 12; m++) {
      monthlyTotals[m] = { billable: 0, worked: 0 }
      for (const emp of employees) {
        monthlyTotals[m].billable += data[emp][m].billable
        monthlyTotals[m].worked += data[emp][m].worked
      }
    }

    // Grand total
    const grandTotal = { billable: 0, worked: 0 }
    for (const emp of employees) {
      grandTotal.billable += totals[emp].billable
      grandTotal.worked += totals[emp].worked
    }

    return { employees, data, totals, monthlyTotals, grandTotal }
  }, [monthlyHours])

  // Prepare previous year monthly totals for comparison
  const prevYearMonthlyTotals = useMemo(() => {
    const totals: Record<number, { billable: number; worked: number }> = {}
    for (let m = 1; m <= 12; m++) {
      totals[m] = { billable: 0, worked: 0 }
    }
    for (const entry of prevYearHours) {
      if (entry.month >= 1 && entry.month <= 12) {
        totals[entry.month].billable += entry.billableHours
        totals[entry.month].worked += entry.workedHours
      }
    }
    return totals
  }, [prevYearHours])

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

  if (!isAuthorized) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.alertTriangle className="text-red-400" size={32} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Geen toegang</h2>
          <p className="text-gray-400">Deze pagina is alleen beschikbaar voor partners en beheerders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
            <Icons.briefcase className="text-blue-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white"><TextReveal>Partners - Werk</TextReveal></h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
          {/* Mode Toggle */}
          <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white/5 rounded-lg sm:rounded-xl">
            <MagneticButton strength={0.2} radius={100}>
              <button
                onClick={() => setPageMode('werkdruk')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pageMode === 'werkdruk' ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.activity size={14} className="sm:w-4 sm:h-4" />
                <span>Werkdruk</span>
              </button>
            </MagneticButton>
            <MagneticButton strength={0.2} radius={100}>
              <button
                onClick={() => setPageMode('lopendezaken')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pageMode === 'lopendezaken' ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.briefcase size={14} className="sm:w-4 sm:h-4" />
                <span>Lopende zaken</span>
              </button>
            </MagneticButton>
            <MagneticButton strength={0.2} radius={100}>
              <button
                onClick={() => setPageMode('urenoverzicht')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pageMode === 'urenoverzicht' ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icons.clock size={14} className="sm:w-4 sm:h-4" />
                <span>Uren per maand</span>
              </button>
            </MagneticButton>
          </div>
        </div>
      </div>

      {/* WERKDRUK MODE */}
      {pageMode === 'werkdruk' && (
        <div className="space-y-6">
          {/* Upload Button */}
          <div className="flex justify-end">
            <Popover.Root open={showUploadModal} onOpenChange={setShowUploadModal}>
              <Popover.Trigger asChild>
                <button className="btn-primary flex items-center gap-2">
                  <Icons.upload size={16} />
                  Uren uploaden
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="w-[90vw] max-w-lg bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                  sideOffset={8}
                  collisionPadding={16}
                  side="bottom"
                  align="end"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                        <Icons.upload className="text-workx-lime" size={18} />
                      </div>
                      <h2 className="font-semibold text-white text-lg">Uren uploaden</h2>
                    </div>
                    <Popover.Close className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      <Icons.x size={18} />
                    </Popover.Close>
                  </div>

                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-start gap-3">
                        <Icons.info className="text-blue-400 mt-0.5" size={16} />
                        <div className="text-sm text-white/70">
                          <p className="font-medium text-blue-400 mb-1">Uren naar werkdruk</p>
                          <p className="text-xs text-gray-400 mb-2">Datums worden automatisch uit het bestand gehaald</p>
                          <ul className="space-y-1 text-xs text-gray-400">
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> &lt;=3 uur = Rustig</li>
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> &lt;=4 uur = Normaal</li>
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400" /> &lt;=5 uur = Druk</li>
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400" /> &gt;5 uur = Heel druk</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-2">Urenoverzicht bestand (.xls / .xlsx / .docx / .rtf)</label>
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                        isUploading
                          ? 'border-workx-lime/50 bg-workx-lime/5'
                          : 'border-white/20 hover:border-workx-lime/50 hover:bg-white/5'
                      }`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploading ? (
                            <>
                              <div className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin mb-2" />
                              <p className="text-sm text-workx-lime">Verwerken...</p>
                            </>
                          ) : (
                            <>
                              <Icons.upload className="text-gray-400 mb-2" size={24} />
                              <p className="text-sm text-white/60">Klik om bestand te selecteren</p>
                              <p className="text-xs text-white/30 mt-1">of sleep het hierheen</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".docx,.rtf,.doc,.xls,.xlsx"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    <Popover.Close className="w-full btn-secondary">
                      Annuleren
                    </Popover.Close>
                  </div>
                  <Popover.Arrow className="fill-workx-gray" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Weekly Summary Card — compact overview */}
          {weeklyReport && weeklyReport.currentWeek.totalHours > 0 && (() => {
            const { currentWeek, avg, prevWeek, vsAvgPct, vsPrevPct, color, colorLabel } = weeklyReport

            const colorStyles = {
              green: { border: 'border-green-400/30', headerBg: 'from-green-500/15 via-green-400/5', text: 'text-green-400', barBg: 'bg-green-400', badge: 'bg-green-400 text-green-950', glow: 'shadow-green-400/10' },
              lime: { border: 'border-workx-lime/30', headerBg: 'from-workx-lime/15 via-workx-lime/5', text: 'text-workx-lime', barBg: 'bg-workx-lime', badge: 'bg-workx-lime text-workx-dark', glow: 'shadow-workx-lime/10' },
              orange: { border: 'border-orange-400/30', headerBg: 'from-orange-500/15 via-orange-400/5', text: 'text-orange-400', barBg: 'bg-orange-400', badge: 'bg-orange-400 text-orange-950', glow: 'shadow-orange-400/10' },
              red: { border: 'border-red-400/30', headerBg: 'from-red-500/15 via-red-400/5', text: 'text-red-400', barBg: 'bg-red-400', badge: 'bg-red-400 text-red-950', glow: 'shadow-red-400/10' },
            }
            const cs = colorStyles[color]

            return (
            <div className={`card overflow-hidden ${cs.border} shadow-lg ${cs.glow}`}>
              <div className={`p-4 sm:p-5 bg-gradient-to-r ${cs.headerBg} to-transparent`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  {/* Left: big number + label */}
                  <div className="flex items-center gap-4 sm:gap-5 flex-1">
                    <div>
                      <p className={`text-4xl sm:text-5xl font-bold tracking-tight ${cs.text} leading-none`}>
                        {currentWeek.totalHours.toFixed(0)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">teamuren</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${cs.badge} w-fit`}>
                        {colorLabel}
                      </span>
                      <p className="text-xs text-gray-500">{currentWeek.label} &middot; {currentWeek.personCount} personen</p>
                    </div>
                  </div>

                  {/* Right: comparison chips */}
                  <div className="flex gap-2 sm:gap-3">
                    <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">vs gem.</p>
                      <div className="flex items-center justify-center gap-1">
                        {vsAvgPct > 2 ? (
                          <Icons.trendingUp size={13} className="text-white/60" />
                        ) : vsAvgPct < -2 ? (
                          <Icons.trendingDown size={13} className="text-white/60" />
                        ) : null}
                        <p className="text-sm font-bold text-white">
                          {vsAvgPct > 0 ? '+' : ''}{vsAvgPct.toFixed(0)}%
                        </p>
                      </div>
                      <p className="text-[9px] text-gray-600">{avg.toFixed(0)} uur</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">vs vorig</p>
                      <div className="flex items-center justify-center gap-1">
                        {vsPrevPct > 2 ? (
                          <Icons.trendingUp size={13} className="text-white/60" />
                        ) : vsPrevPct < -2 ? (
                          <Icons.trendingDown size={13} className="text-white/60" />
                        ) : null}
                        <p className="text-sm font-bold text-white">
                          {vsPrevPct > 0 ? '+' : ''}{vsPrevPct.toFixed(0)}%
                        </p>
                      </div>
                      <p className="text-[9px] text-gray-600">{prevWeek.totalHours.toFixed(0)} uur</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          })()}

          {/* Workload Overview - employees only */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.activity className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white text-sm sm:text-base"><TextReveal>Werkdruk overzicht</TextReveal></h2>
                {/* History Navigation */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setHistoryOffset(prev => prev + 1)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Eerdere dagen"
                  >
                    <Icons.chevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setHistoryOffset(prev => Math.max(0, prev - 1))}
                    disabled={historyOffset === 0}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Recentere dagen"
                  >
                    <Icons.chevronRight size={16} />
                  </button>
                  {historyOffset > 0 && (
                    <button
                      onClick={() => setHistoryOffset(0)}
                      className="ml-1 px-2 py-1 rounded-lg bg-workx-lime/10 text-workx-lime text-xs hover:bg-workx-lime/20 transition-colors"
                    >
                      Vandaag
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-gray-400">Rustig</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-gray-400">Normaal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-gray-400">Druk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-gray-400">Zeer druk</span>
                </div>
              </div>
            </div>

            {/* Table - compact on mobile, full on desktop */}
            <div className="overflow-hidden">
              <div className="min-w-0">
                {/* Table header */}
                <div className="grid gap-1 px-2 sm:px-4 py-2 sm:py-3 bg-white/[0.02] border-b border-white/5 text-xs text-gray-400 font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: showPartners ? `minmax(56px, 130px) repeat(${last3Workdays.length}, 1fr) minmax(36px, 52px)` : `minmax(56px, 130px) repeat(${last3Workdays.length}, 1fr)` }}
                >
                  <div className="text-[10px] sm:text-xs">Naam</div>
              {last3Workdays.map(day => {
                const weekend = isWeekend(day)
                return (
                  <div key={day.toISOString()} className={`text-center text-[10px] sm:text-xs ${weekend ? 'text-purple-400' : ''}`}>
                    <span className="hidden sm:inline">{day.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}</span>
                    <span className="sm:hidden">{day.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '')}</span>
                    {weekend && <span className="hidden sm:inline text-[9px] ml-0.5 opacity-60">*</span>}
                  </div>
                )
              })}
              {showPartners && <div className="text-center text-[10px] sm:text-xs">Week</div>}
            </div>

            {/* Table body */}
            <ScrollReveal staggerChildren={0.05}>
            <div className="divide-y divide-white/5">
              {peopleToShow.map((person) => {
                const photoUrl = TEAM_PHOTOS[person]
                const firstName = person.split(' ')[0]
                const isPartner = PARTNERS.includes(person)
                const weekTotal = getWeekTotal(person)

                return (
                  <ScrollRevealItem key={person}>
                  <div
                    className={`grid gap-1 px-2 sm:px-4 py-1.5 sm:py-3 items-center hover:bg-white/[0.02] transition-colors ${isPartner ? 'bg-workx-lime/[0.02]' : ''}`}
                    style={{ gridTemplateColumns: showPartners ? `minmax(56px, 130px) repeat(${last3Workdays.length}, 1fr) minmax(36px, 52px)` : `minmax(56px, 130px) repeat(${last3Workdays.length}, 1fr)` }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <img
                        src={photoUrl}
                        alt={person}
                        className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg object-cover ring-2 ring-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-white text-xs sm:text-sm whitespace-nowrap truncate">{firstName}</p>
                        {isPartner && <p className="text-[9px] text-workx-lime/60 leading-none">Partner</p>}
                      </div>
                    </div>
                    {last3Workdays.map(day => {
                      const dateStr = formatDateForAPI(day)
                      const entry = getWorkloadEntry(person, day)
                      const level = entry?.level || null
                      const hours = entry?.hours
                      const isEditing = editingWorkload?.person === person && editingWorkload?.date === dateStr
                      const isToday = day.toDateString() === new Date().toDateString()
                      const weekend = isWeekend(day)

                      return (
                        <div key={dateStr} className={`flex justify-center ${weekend ? 'relative' : ''}`}>
                          {weekend && <div className="absolute inset-0 bg-purple-500/[0.04] rounded-lg pointer-events-none" />}
                          {isEditing ? (
                            <div className="flex items-center gap-0.5 sm:gap-1 bg-workx-dark/80 border border-white/10 rounded-lg sm:rounded-xl p-1 sm:p-2 z-10">
                              {(['green', 'yellow', 'orange', 'red'] as const).map(l => (
                                <button
                                  key={l}
                                  onClick={() => saveWorkload(person, day, l)}
                                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg ${workloadConfig[l].bg} ${workloadConfig[l].border} border-2 hover:scale-110 transition-transform flex items-center justify-center`}
                                >
                                  {level === l && <Icons.check size={12} className={workloadConfig[l].text} />}
                                </button>
                              ))}
                              <button
                                onClick={() => setEditingWorkload(null)}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                              >
                                <Icons.x size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingWorkload({ person, date: dateStr })}
                              className={`w-full h-8 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${
                                level
                                  ? `${workloadConfig[level].bg} ${workloadConfig[level].border} border`
                                  : 'bg-white/5 border border-dashed border-white/10 hover:border-white/20'
                              } ${isToday ? 'ring-2 ring-workx-lime/30 ring-offset-1 sm:ring-offset-2 ring-offset-workx-dark' : ''} ${weekend && !level ? 'border-purple-500/20' : ''}`}
                            >
                              {level ? (
                                <span className={`text-xs sm:text-sm font-bold ${workloadConfig[level].text}`}>
                                  {hours != null ? hours.toFixed(1).replace('.', ',') : workloadConfig[level].label.charAt(0)}
                                </span>
                              ) : (
                                <span className="text-[10px] sm:text-xs text-white/30">-</span>
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {/* Week total - only on Sat/Sun/Mon */}
                    {showPartners && (
                    <div className="flex justify-center items-center">
                      <span className={`text-xs sm:text-sm font-bold ${
                        weekTotal > 25 ? 'text-red-400' : weekTotal > 20 ? 'text-orange-400' : weekTotal > 0 ? 'text-white/60' : 'text-white/15'
                      }`}>
                        {weekTotal > 0 ? weekTotal.toFixed(1).replace('.', ',') : '-'}
                      </span>
                    </div>
                    )}
                  </div>
                  </ScrollRevealItem>
                )
              })}
              </div>
            </ScrollReveal>
            </div>
            </div>
          </div>

          {/* Week-over-week comparison table */}
          {weeklyReport && weeklyReport.currentWeek.totalHours > 0 && (() => {
            const { weeks, avg, color } = weeklyReport
            const maxHours = Math.max(...weeks.map(w => w.totalHours))

            const barColors = {
              green: 'bg-green-400', lime: 'bg-workx-lime', orange: 'bg-orange-400', red: 'bg-red-400',
            }
            const textColors = {
              green: 'text-green-400', lime: 'text-workx-lime', orange: 'text-orange-400', red: 'text-red-400',
            }
            const bgColors = {
              green: 'bg-green-400', lime: 'bg-workx-lime', orange: 'bg-orange-400', red: 'bg-red-400',
            }

            return (
            <div className="card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icons.trendingUp className="text-gray-400" size={16} />
                  </div>
                  <div>
                    <h2 className="font-medium text-white text-sm sm:text-base">Weekvergelijking</h2>
                    <p className="text-xs text-gray-500">Teamuren per 7-daagse periode</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                      <th className="text-left px-4 py-2.5 font-medium">Periode</th>
                      <th className="text-right px-4 py-2.5 font-medium">Uren</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Personen</th>
                      <th className="text-right px-4 py-2.5 font-medium">vs. gem.</th>
                      <th className="text-right px-4 py-2.5 font-medium w-28 sm:w-40">Verhouding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week, idx) => {
                      const isCurrentWeek = idx === 0
                      const pctOfAvg = avg > 0 ? ((week.totalHours - avg) / avg) * 100 : 0
                      const barWidthPct = maxHours > 0 ? (week.totalHours / maxHours) * 100 : 0

                      return (
                        <tr
                          key={idx}
                          className={`border-b border-white/[0.03] ${
                            isCurrentWeek ? `${bgColors[color]}/[0.06]` : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className={`text-xs ${isCurrentWeek ? textColors[color] + ' font-semibold' : 'text-gray-400'}`}>
                              {isCurrentWeek ? '→ ' : ''}{week.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-sm font-bold tabular-nums ${isCurrentWeek ? textColors[color] : 'text-white/80'}`}>
                              {week.totalHours.toFixed(0)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                            <span className="text-xs text-gray-500">{week.personCount}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {avg > 0 && week.totalHours > 0 ? (
                              <span className={`text-[11px] font-medium ${isCurrentWeek ? 'text-white' : 'text-gray-400'}`}>
                                {pctOfAvg > 0 ? '+' : ''}{pctOfAvg.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isCurrentWeek ? barColors[color] : 'bg-white/15'
                                }`}
                                style={{ width: `${Math.max(barWidthPct, 2)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )
          })()}

          {/* Info card */}
          <div className="card p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.info className="text-blue-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Over werkdruk tracking</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Klik op een cel om de werkdruk van een medewerker voor die dag in te vullen.
                  Dit overzicht helpt om snel te zien wie er veel aan het hoofd heeft en wie ruimte heeft om bij te springen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URENOVERZICHT MODE */}
      {pageMode === 'urenoverzicht' && (
        <div className="space-y-6">
          {/* Year Toggle and Upload Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    selectedYear === year ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            {selectedYear === new Date().getFullYear() && (
              <Popover.Root open={showHoursUploadModal} onOpenChange={setShowHoursUploadModal}>
                <Popover.Trigger asChild>
                  <button className="btn-primary flex items-center gap-2">
                    <Icons.upload size={16} />
                    Uren uploaden
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="w-[90vw] max-w-lg bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                    sideOffset={8}
                    collisionPadding={16}
                    side="bottom"
                    align="end"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                          <Icons.upload className="text-workx-lime" size={18} />
                        </div>
                        <h2 className="font-semibold text-white text-lg">Uren uploaden {selectedYear}</h2>
                      </div>
                      <Popover.Close className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <Icons.x size={18} />
                      </Popover.Close>
                    </div>

                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                          <Icons.info className="text-blue-400 mt-0.5" size={16} />
                          <div className="text-sm text-white/70">
                            <p className="font-medium text-blue-400 mb-1">BaseNet export</p>
                            <p className="text-xs text-gray-400">
                              Upload het urenoverzicht bestand van BaseNet (.xlsx of .rtf).
                              De uren worden automatisch per maand per medewerker samengevoegd.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-white/60 mb-2">BaseNet RTF bestand</label>
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                          isUploadingHours
                            ? 'border-workx-lime/50 bg-workx-lime/5'
                            : 'border-white/20 hover:border-workx-lime/50 hover:bg-white/5'
                        }`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploadingHours ? (
                              <>
                                <div className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin mb-2" />
                                <p className="text-sm text-workx-lime">Verwerken...</p>
                              </>
                            ) : (
                              <>
                                <Icons.upload className="text-gray-400 mb-2" size={24} />
                                <p className="text-sm text-white/60">Klik om bestand te selecteren</p>
                                <p className="text-xs text-white/30 mt-1">RTF bestand van BaseNet</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept=".rtf"
                            onChange={handleHoursUpload}
                            disabled={isUploadingHours}
                          />
                        </label>
                      </div>

                      <Popover.Close className="w-full btn-secondary">
                        Annuleren
                      </Popover.Close>
                    </div>
                    <Popover.Arrow className="fill-workx-gray" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
          </div>

          {/* Stats Cards - alleen factureerbaar */}
          <ScrollReveal staggerChildren={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ScrollRevealItem>
            <SpotlightCard className="card p-5 relative overflow-hidden group" spotlightColor="rgba(59, 130, 246, 0.08)">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                  <Icons.users className="text-blue-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-white"><AnimatedNumber value={monthlyHoursData.employees.length} /></p>
                <p className="text-sm text-gray-400">Medewerkers</p>
              </div>
            </SpotlightCard>
            </ScrollRevealItem>

            <ScrollRevealItem>
            <SpotlightCard className="card p-5 relative overflow-hidden group" spotlightColor="rgba(249, 255, 133, 0.08)">
              <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center mb-3">
                  <Icons.clock className="text-workx-lime" size={18} />
                </div>
                <p className="text-2xl font-semibold text-workx-lime"><AnimatedNumber value={Math.round(monthlyHoursData.grandTotal.billable)} /></p>
                <p className="text-sm text-gray-400">Totaal factureerbaar</p>
              </div>
            </SpotlightCard>
            </ScrollRevealItem>

            <ScrollRevealItem>
            <SpotlightCard className="card p-5 relative overflow-hidden group" spotlightColor="rgba(34, 197, 94, 0.08)">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                  <Icons.trendingUp className="text-green-400" size={18} />
                </div>
                <p className="text-2xl font-semibold text-green-400">
                  <AnimatedNumber value={monthlyHoursData.employees.length > 0 ? Math.round(monthlyHoursData.grandTotal.billable / monthlyHoursData.employees.length) : 0} />
                </p>
                <p className="text-sm text-gray-400">Gem. per medewerker</p>
              </div>
            </SpotlightCard>
            </ScrollRevealItem>
          </div>
          </ScrollReveal>

          {/* Cumulative Hours Chart */}
          {monthlyHoursData.employees.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.activity className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white">Cumulatieve ontwikkeling {selectedYear}</h2>
              </div>
              <div className="h-64 relative">
                <svg width="100%" height="100%" viewBox="0 0 800 250" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map(i => (
                    <line key={i} x1="60" y1={50 + i * 45} x2="780" y2={50 + i * 45} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  ))}
                  {/* Month labels */}
                  {MONTH_NAMES.map((month, idx) => (
                    <text key={idx} x={80 + idx * 60} y="240" fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="middle">{month}</text>
                  ))}
                  {/* Lines for each employee */}
                  {monthlyHoursData.employees.slice(0, 10).map((emp, empIdx) => {
                    const colors = ['#f9ff85', '#06b6d4', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6']
                    const color = colors[empIdx % colors.length]

                    // Calculate cumulative hours
                    let cumulative = 0
                    const points: string[] = []
                    const maxCumulative = Math.max(...monthlyHoursData.employees.map(e => {
                      let sum = 0
                      for (let m = 1; m <= 12; m++) sum += monthlyHoursData.data[e][m]?.billable || 0
                      return sum
                    })) || 1

                    for (let m = 1; m <= 12; m++) {
                      cumulative += monthlyHoursData.data[emp][m]?.billable || 0
                      if (cumulative > 0) {
                        const x = 80 + (m - 1) * 60
                        const y = 230 - (cumulative / maxCumulative) * 180
                        points.push(`${x},${y}`)
                      }
                    }

                    if (points.length < 2) return null

                    return (
                      <g key={emp}>
                        <polyline
                          points={points.join(' ')}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.8"
                        />
                        {/* End point with name */}
                        {points.length > 0 && (
                          <circle
                            cx={parseFloat(points[points.length - 1].split(',')[0])}
                            cy={parseFloat(points[points.length - 1].split(',')[1])}
                            r="4"
                            fill={color}
                          />
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/5">
                {monthlyHoursData.employees.slice(0, 10).map((emp, empIdx) => {
                  const colors = ['#f9ff85', '#06b6d4', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6']
                  const color = colors[empIdx % colors.length]
                  return (
                    <div key={emp} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-white/60">{emp.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Year Comparison Chart */}
          {prevYearHours.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.chart className="text-workx-lime" size={16} />
                </div>
                <h2 className="font-medium text-white">Vergelijking {selectedYear} vs {selectedYear - 1}</h2>
                <div className="ml-auto flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-white/20" />
                    <span className="text-white/40">{selectedYear - 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-workx-lime" />
                    <span className="text-white/40">{selectedYear}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {(() => {
                  const maxHours = Math.max(
                    ...MONTH_NAMES.map((_, idx) => {
                      const m = idx + 1
                      return Math.max(
                        monthlyHoursData.monthlyTotals[m]?.billable || 0,
                        prevYearMonthlyTotals[m]?.billable || 0
                      )
                    })
                  ) || 1

                  const currentYearTotal = Object.values(monthlyHoursData.monthlyTotals).reduce((sum, v) => sum + v.billable, 0)
                  const prevYearTotal = Object.values(prevYearMonthlyTotals).reduce((sum, v) => sum + v.billable, 0)

                  return (
                    <>
                      {MONTH_NAMES.map((month, idx) => {
                        const m = idx + 1
                        const currentHours = monthlyHoursData.monthlyTotals[m]?.billable || 0
                        const prevHours = prevYearMonthlyTotals[m]?.billable || 0

                        if (currentHours === 0 && prevHours === 0) return null

                        const diff = prevHours > 0
                          ? ((currentHours - prevHours) / prevHours * 100)
                          : currentHours > 0 ? 100 : 0

                        return (
                          <div key={month} className="group">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/50 w-8 flex-shrink-0">{month}</span>
                              <div className="flex-1 space-y-1">
                                {/* Previous year bar */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-4 bg-white/[0.02] rounded overflow-hidden">
                                    <div
                                      className="h-full bg-white/15 rounded transition-all duration-500"
                                      style={{ width: `${(prevHours / maxHours) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-white/30 w-14 text-right tabular-nums">{Math.round(prevHours)}</span>
                                </div>
                                {/* Current year bar */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-4 bg-white/[0.02] rounded overflow-hidden">
                                    <div
                                      className="h-full bg-workx-lime/60 rounded transition-all duration-500"
                                      style={{ width: `${(currentHours / maxHours) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-white/50 w-14 text-right tabular-nums font-medium">{Math.round(currentHours)}</span>
                                </div>
                              </div>
                              <span className={`text-xs w-14 text-right font-medium tabular-nums ${
                                diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white/30'
                              }`}>
                                {diff > 0 ? '+' : ''}{Math.round(diff)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}

                      {/* Totaal rij */}
                      <div className="pt-3 mt-3 border-t border-white/10">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-workx-lime font-semibold w-8 flex-shrink-0">Tot.</span>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-white/[0.02] rounded overflow-hidden">
                                <div
                                  className="h-full bg-white/15 rounded transition-all duration-500"
                                  style={{ width: `${prevYearTotal >= currentYearTotal ? 100 : (prevYearTotal / currentYearTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-white/30 w-14 text-right tabular-nums">{Math.round(prevYearTotal).toLocaleString('nl-NL')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-white/[0.02] rounded overflow-hidden">
                                <div
                                  className="h-full bg-workx-lime/60 rounded transition-all duration-500"
                                  style={{ width: `${currentYearTotal >= prevYearTotal ? 100 : (currentYearTotal / prevYearTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-workx-lime w-14 text-right tabular-nums font-semibold">{Math.round(currentYearTotal).toLocaleString('nl-NL')}</span>
                            </div>
                          </div>
                          <span className={`text-xs w-14 text-right font-bold tabular-nums ${
                            prevYearTotal > 0
                              ? ((currentYearTotal - prevYearTotal) / prevYearTotal * 100) > 0 ? 'text-green-400' : 'text-red-400'
                              : 'text-white/30'
                          }`}>
                            {prevYearTotal > 0
                              ? `${((currentYearTotal - prevYearTotal) / prevYearTotal * 100) > 0 ? '+' : ''}${Math.round((currentYearTotal - prevYearTotal) / prevYearTotal * 100)}%`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Monthly Hours Table */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                <Icons.clock className="text-workx-lime" size={16} />
              </div>
              <h2 className="font-medium text-white">Urenoverzicht {selectedYear}</h2>
              <span className="ml-auto text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">
                {monthlyHoursData.employees.length} medewerkers
              </span>
            </div>

            {monthlyHoursData.employees.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icons.clock className="text-white/20" size={32} />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Nog geen uren data</h3>
                <p className="text-gray-400 mb-4">Upload een urenoverzicht bestand om te beginnen</p>
                {selectedYear === new Date().getFullYear() && (
                  <button
                    onClick={() => setShowHoursUploadModal(true)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Icons.upload size={16} />
                    Uren uploaden
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="text-left py-3 px-4 font-medium text-white/60 sticky left-0 bg-workx-gray z-10 min-w-[200px]">
                        Medewerker
                      </th>
                      {MONTH_NAMES.map((month, idx) => (
                        <th key={idx} className="text-center py-3 px-3 font-medium text-white/60 min-w-[70px]">
                          {month}
                        </th>
                      ))}
                      <th className="text-center py-3 px-4 font-semibold text-workx-lime bg-workx-lime/5 min-w-[90px]">
                        Totaal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {monthlyHoursData.employees.map((emp) => {
                      const photoUrl = TEAM_PHOTOS[emp]
                      const total = monthlyHoursData.totals[emp]

                      return (
                        <tr key={emp} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 sticky left-0 bg-workx-gray z-10">
                            <div className="flex items-center gap-3">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={emp}
                                  className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/10"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                  <Icons.user className="text-gray-400" size={16} />
                                </div>
                              )}
                              <span className="font-medium text-white">{emp}</span>
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                            const hours = monthlyHoursData.data[emp][month]
                            const hasData = hours.billable > 0

                            return (
                              <td key={month} className="py-3 px-3 text-center">
                                {hasData ? (
                                  <span className="text-white font-medium">
                                    {hours.billable.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                                  </span>
                                ) : (
                                  <span className="text-white/20">-</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-3 px-4 text-center bg-workx-lime/5">
                            <span className="text-workx-lime font-bold">
                              {total.billable.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-workx-lime/10 border-t-2 border-workx-lime/30">
                      <td className="py-4 px-4 font-bold text-white sticky left-0 bg-workx-gray z-10">
                        Totaal
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                        const totals = monthlyHoursData.monthlyTotals[month]
                        const hasData = totals.billable > 0

                        return (
                          <td key={month} className="py-4 px-3 text-center">
                            {hasData ? (
                              <span className="text-white font-bold">
                                {totals.billable.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            ) : (
                              <span className="text-white/20">-</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="py-4 px-4 text-center bg-workx-lime/20">
                        <span className="text-workx-lime font-bold text-lg">
                          {monthlyHoursData.grandTotal.billable.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="card p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.info className="text-blue-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Factureerbare uren per maand</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Overzicht van de factureerbare uren per medewerker, opgebouwd uit de BaseNet urenregistratie.
                  {selectedYear === new Date().getFullYear() && ' Upload maandelijks een nieuw RTF-bestand om de gegevens bij te werken.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOEWIJZING MODE */}
      {pageMode === 'toewijzing' && (
        <ZakenToewijzing isPartner={true} />
      )}

      {/* LOPENDE ZAKEN MODE */}
      {pageMode === 'lopendezaken' && (
        <LopendeZakenTab />
      )}

    </div>
  )
}

// ─── Lopende Zaken Tab ───

const LZ_MEMBER_COLORS = [
  'from-blue-500 to-blue-400',
  'from-purple-500 to-purple-400',
  'from-orange-500 to-orange-400',
  'from-emerald-500 to-emerald-400',
  'from-pink-500 to-pink-400',
  'from-cyan-500 to-cyan-400',
  'from-amber-500 to-amber-400',
  'from-indigo-500 to-indigo-400',
]

function formatLzDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface LzCaseMember { personName: string; workedHours: number }
interface LzCaseItem { projectName: string; totalWorkedHours: number; totalBillableHours: number; members: LzCaseMember[] }
interface LzData { cases: LzCaseItem[]; period: { startDate: string; endDate: string } }

function LopendeZakenTab() {
  const { data, error, isLoading } = useLopendeZaken() as { data: LzData | undefined; error: Error | undefined; isLoading: boolean }
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const cases = data?.cases || []
  const maxHours = cases[0]?.totalWorkedHours || 1
  const totalHours = cases.reduce((sum, c) => sum + c.totalWorkedHours, 0)
  const uniqueMembers = new Set(cases.flatMap(c => c.members.map(m => m.personName)))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Lopende zaken laden...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto">
            <Icons.x size={24} className="text-red-400" />
          </div>
          <p className="text-white/60">Kon lopende zaken niet laden</p>
        </div>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto">
            <Icons.briefcase size={24} className="text-white/30" />
          </div>
          <p className="text-white/60">Geen zaken gevonden</p>
          <p className="text-white/30 text-sm">Er zijn geen uren geregistreerd in de afgelopen 30 dagen</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period + stats */}
      {data?.period && (
        <p className="text-sm text-white/40">
          {formatLzDate(data.period.startDate)} — {formatLzDate(data.period.endDate)}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icons.clock size={18} className="text-workx-lime" />
            <span className="text-xs text-white/40">Totaal uren</span>
          </div>
          <p className="text-2xl font-semibold text-white">{Math.round(totalHours).toLocaleString('nl-NL')}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icons.briefcase size={18} className="text-blue-400" />
            <span className="text-xs text-white/40">Actieve zaken</span>
          </div>
          <p className="text-2xl font-semibold text-white">{cases.length}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icons.users size={18} className="text-purple-400" />
            <span className="text-xs text-white/40">Teamleden</span>
          </div>
          <p className="text-2xl font-semibold text-white">{uniqueMembers.size}</p>
        </div>
      </div>

      {/* Cases list */}
      <div className="space-y-2.5">
        {cases.map((c, i) => {
          const isExpanded = expandedIndex === i
          const barWidth = (c.totalWorkedHours / maxHours) * 100
          const isTop3 = i < 3

          return (
            <div key={c.projectName} className={`rounded-2xl border overflow-hidden transition-all ${
              isExpanded
                ? 'border-white/15 bg-white/[0.04] shadow-lg shadow-black/20'
                : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]'
            }`}>
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left group"
              >
                {/* Rank badge */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isTop3
                    ? 'bg-gradient-to-br from-workx-lime/25 to-workx-lime/10 border border-workx-lime/20'
                    : 'bg-white/5 border border-white/5'
                }`}>
                  <span className={`text-xs font-bold ${isTop3 ? 'text-workx-lime' : 'text-white/30'}`}>{i + 1}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    {/* Dossier name chip */}
                    <span className="text-[13px] font-semibold text-white tracking-tight truncate">{c.projectName}</span>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {/* Hours badge */}
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                        isTop3
                          ? 'bg-workx-lime/15 text-workx-lime border border-workx-lime/15'
                          : 'bg-white/5 text-white/50 border border-white/5'
                      }`}>{c.totalWorkedHours}u</span>
                      {/* Members count */}
                      <div className="flex items-center gap-1">
                        <Icons.users size={12} className="text-white/20" />
                        <span className="text-xs text-white/30">{c.members.length}</span>
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isTop3
                          ? 'bg-gradient-to-r from-workx-lime to-workx-lime/60'
                          : 'bg-gradient-to-r from-white/20 to-white/10'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <div className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                  <Icons.chevronDown size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-white/5">
                  <div className="ml-[46px] space-y-2">
                    {c.members.map((m, mi) => {
                      const memberBarWidth = (m.workedHours / c.totalWorkedHours) * 100
                      const color = LZ_MEMBER_COLORS[mi % LZ_MEMBER_COLORS.length]
                      const photo = getPhotoUrl(m.personName)

                      return (
                        <div key={m.personName} className="flex items-center gap-3">
                          {photo ? (
                            <Image src={photo} alt={m.personName} width={28} height={28} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-[11px] font-medium text-white">{m.personName.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-sm text-white/70 w-36 truncate flex-shrink-0">{m.personName}</span>
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${memberBarWidth}%` }} />
                          </div>
                          <span className="text-xs font-mono text-white/40 w-10 text-right flex-shrink-0">{m.workedHours}u</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
