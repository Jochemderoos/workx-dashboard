'use client'

import { useState, useEffect, useMemo } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Attendee {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  timeSlot: 'FULL_DAY' | 'MORNING' | 'AFTERNOON'
}

interface AttendanceData {
  date: string
  attendees: Attendee[]
  totalWorkplaces: number
  occupiedWorkplaces: number
  availableWorkplaces: number
  isCurrentUserAttending: boolean
  currentUserTimeSlot: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | null
  currentUserId: string
}

const TIME_SLOTS = [
  { value: 'FULL_DAY', label: 'Hele dag', icon: '🏢' },
  { value: 'MORNING', label: 'Ochtend', icon: '🌅' },
  { value: 'AFTERNOON', label: 'Middag', icon: '🌆' },
] as const

// Helper functie om lokale datum string te krijgen (YYYY-MM-DD)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface WeekDayData {
  date: string
  dayName: string
  dayNumber: number
  attendees: Attendee[]
  isToday: boolean
}

export default function AppjeplekjePage() {
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()))
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY')

  // Week overview state
  const [weekData, setWeekData] = useState<WeekDayData[]>([])
  const [isLoadingWeek, setIsLoadingWeek] = useState(true)

  // Month attendance data for calendar glow + photos
  const [monthAttendance, setMonthAttendance] = useState<Record<string, { name: string; avatarUrl: string | null; timeSlot: string }[]>>({})

  // Fetch month attendance when calendar month changes
  useEffect(() => {
    const fetchMonthAttendance = async () => {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const startDate = getLocalDateString(new Date(year, month, 1))
      const endDate = getLocalDateString(new Date(year, month + 1, 0))
      try {
        const res = await fetch(`/api/office-attendance?startDate=${startDate}&endDate=${endDate}`)
        if (res.ok) {
          const data = await res.json()
          setMonthAttendance(data.byDate || {})
        }
      } catch { /* ignore */ }
    }
    fetchMonthAttendance()
  }, [currentMonth, attendanceData]) // Re-fetch when attendance changes

  // Haal data op voor geselecteerde datum
  useEffect(() => {
    fetchAttendance(selectedDate)
  }, [selectedDate])

  // Haal weekoverzicht op
  useEffect(() => {
    fetchWeekOverview()
  }, [])

  // Haal data op voor de huidige week (ma-vr) - parallel voor snelheid
  const fetchWeekOverview = async () => {
    setIsLoadingWeek(true)
    try {
      const today = new Date()
      const dayOfWeek = today.getDay()
      // Bereken maandag van deze week
      const monday = new Date(today)
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      monday.setDate(today.getDate() + diff)

      const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']

      // Maak alle dates en fetch ze PARALLEL
      const fetchPromises = Array.from({ length: 5 }, async (_, i) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        const dateStr = getLocalDateString(date)
        const isToday = dateStr === getLocalDateString(today)

        try {
          const res = await fetch(`/api/office-attendance?date=${dateStr}`)
          if (res.ok) {
            const data = await res.json()
            return {
              date: dateStr,
              dayName: dayNames[i],
              dayNumber: date.getDate(),
              attendees: data.attendees || [],
              isToday,
            }
          }
        } catch {
          // Ignore errors
        }
        return {
          date: dateStr,
          dayName: dayNames[i],
          dayNumber: date.getDate(),
          attendees: [],
          isToday,
        }
      })

      const weekDays = await Promise.all(fetchPromises)
      setWeekData(weekDays)
    } catch (error) {
      console.error('Error fetching week overview:', error)
    } finally {
      setIsLoadingWeek(false)
    }
  }

  const fetchAttendance = async (date: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/office-attendance?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setAttendanceData(data)
        // Update selected time slot if user is attending
        if (data.currentUserTimeSlot) {
          setSelectedTimeSlot(data.currentUserTimeSlot)
        }
      } else {
        console.error('API error:', res.status)
        // Set default data
        setAttendanceData({
          date,
          attendees: [],
          totalWorkplaces: 11,
          occupiedWorkplaces: 0,
          availableWorkplaces: 11,
          isCurrentUserAttending: false,
          currentUserTimeSlot: null,
          currentUserId: '',
        })
      }
    } catch (error) {
      console.error('Error fetching attendance:', error)
      // Set default data on error
      setAttendanceData({
        date,
        attendees: [],
        totalWorkplaces: 11,
        occupiedWorkplaces: 0,
        availableWorkplaces: 11,
        isCurrentUserAttending: false,
        currentUserTimeSlot: null,
        currentUserId: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle aanwezigheid
  const toggleAttendance = async () => {
    if (!attendanceData || isToggling) return
    setIsToggling(true)

    try {
      let res: Response

      if (attendanceData.isCurrentUserAttending) {
        // Afmelden
        res = await fetch(`/api/office-attendance?date=${selectedDate}`, {
          method: 'DELETE',
        })
      } else {
        // Aanmelden
        res = await fetch('/api/office-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, timeSlot: selectedTimeSlot }),
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        alert(errorData.error || 'Er ging iets mis')
        return
      }

      // Refresh data
      await fetchAttendance(selectedDate)
      await fetchWeekOverview()
    } catch (error) {
      console.error('Error toggling attendance:', error)
      alert('Er ging iets mis met de verbinding')
    } finally {
      setIsToggling(false)
    }
  }

  // Update time slot (if already attending)
  const updateTimeSlot = async (newTimeSlot: 'FULL_DAY' | 'MORNING' | 'AFTERNOON') => {
    if (!attendanceData?.isCurrentUserAttending || isToggling) return
    setIsToggling(true)
    setSelectedTimeSlot(newTimeSlot)

    try {
      const res = await fetch('/api/office-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, timeSlot: newTimeSlot }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        alert(errorData.error || 'Er ging iets mis')
        return
      }

      // Refresh data
      await fetchAttendance(selectedDate)
      await fetchWeekOverview()
    } catch (error) {
      console.error('Error updating time slot:', error)
      alert('Er ging iets mis met de verbinding')
    } finally {
      setIsToggling(false)
    }
  }

  // Genereer kalender dagen voor huidige maand
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Voeg dagen van vorige maand toe tot we bij maandag zijn
    const firstDayOfWeek = firstDay.getDay()
    const daysToAdd = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Start op maandag
    for (let i = daysToAdd; i > 0; i--) {
      const date = new Date(year, month, 1 - i)
      days.push({ date, isCurrentMonth: false })
    }

    // Voeg dagen van huidige maand toe
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Voeg dagen van volgende maand toe tot we 35 of 42 dagen hebben
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false })
    }

    return days
  }, [currentMonth])

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + direction)
      return newDate
    })
  }

  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const isPast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Progress bar percentage
  const occupancyPercentage = attendanceData
    ? (attendanceData.occupiedWorkplaces / attendanceData.totalWorkplaces) * 100
    : 0

  // Bepaal kleur van progress bar
  const getProgressColor = () => {
    if (occupancyPercentage < 50) return 'bg-green-500'
    if (occupancyPercentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Format geselecteerde datum
  const formatSelectedDate = () => {
    const date = new Date(selectedDate)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Vandaag'
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Morgen'
    }
    return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-4 sm:space-y-6 fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
            <img
              src="/workx-pand.png"
              alt="Kantoor"
              className="h-8 sm:h-10 w-auto opacity-80"
            />
            Appjeplekje
          </h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Meld je aan voor een werkplek op kantoor</p>
        </div>
      </div>

      {/* Week Overview - Main View */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icons.calendar size={18} className="text-workx-lime" />
            <h2 className="font-medium text-white">Deze week op kantoor</h2>
          </div>
          <p className="text-xs text-gray-400">
            Week {Math.ceil((new Date().getDate() + new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay()) / 7)}
          </p>
        </div>

        {isLoadingWeek ? (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {weekData.map((day) => {
              // Check of dag in het verleden is (voor mobiel filtering)
              const now = new Date()
              const currentHour = now.getHours()
              const todayStr = getLocalDateString(now)
              const isPastDay = currentHour >= 20
                ? day.date <= todayStr  // Na 20:00: vandaag is ook verleden
                : day.date < todayStr   // Voor 20:00: alleen gisteren en eerder

              return (
              <div
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`p-3 rounded-xl transition-all cursor-pointer ${
                  isPastDay ? 'hidden sm:block' : '' // Verberg verleden dagen op mobiel
                } ${
                  day.date === selectedDate
                    ? 'bg-workx-lime/20 border-2 border-workx-lime/50 ring-2 ring-workx-lime/20'
                    : day.isToday
                      ? 'bg-white/10 border-2 border-workx-lime/40'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <span className={`text-sm font-medium ${day.isToday ? 'text-workx-lime' : 'text-white'}`}>
                    {day.dayName}
                  </span>
                  <span className={`text-lg font-bold ${
                    day.date === selectedDate ? 'text-workx-lime' : day.isToday ? 'text-workx-lime' : 'text-white/60'
                  }`}>
                    {day.dayNumber}
                  </span>
                </div>

                {/* Attendees list */}
                {day.attendees.length > 0 ? (
                  <div className="space-y-2">
                    {day.attendees.map((attendee) => {
                      const photoUrl = getPhotoUrl(attendee.name)
                      const firstName = attendee.name.split(' ')[0]
                      return (
                        <div key={attendee.id} className="flex items-center gap-2">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={attendee.name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium text-white/80 flex-shrink-0">
                              {attendee.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-white/90 truncate block">{firstName}</span>
                            {attendee.timeSlot && attendee.timeSlot !== 'FULL_DAY' && (
                              <span className="text-[10px] text-white/40">
                                {attendee.timeSlot === 'MORNING' ? 'ochtend' : 'middag'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-xs text-gray-500">Nog niemand</p>
                  </div>
                )}

                {/* Footer with count */}
                {day.attendees.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/5">
                    <p className="text-[10px] text-gray-400 text-center">
                      {day.attendees.length} {day.attendees.length === 1 ? 'persoon' : 'personen'}
                    </p>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Calendar */}
        <div className="lg:col-span-2">
          <div className="card p-3 sm:p-5">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Icons.chevronLeft size={18} className="text-white/60" />
              </button>
              <h2 className="text-base sm:text-lg font-medium text-white">
                {currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Icons.chevronRight size={18} className="text-white/60" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                <div key={day} className="text-center text-xs sm:text-xs font-medium text-gray-400 py-1 sm:py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((dayInfo, index) => {
                const dateStr = getLocalDateString(dayInfo.date)
                const todayStr = getLocalDateString(new Date())
                const isCurrentDay = dateStr === todayStr
                const isSelectedDay = dateStr === selectedDate
                const weekend = isWeekend(dayInfo.date)
                const past = isPast(dayInfo.date) && !isCurrentDay
                const dayAttendees = monthAttendance[dateStr] || []
                const hasAttendees = dayAttendees.length > 0 && dayInfo.isCurrentMonth

                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (!weekend && !past) {
                        setSelectedDate(dateStr)
                      }
                    }}
                    disabled={weekend || past}
                    className={`
                      relative rounded-md sm:rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm font-medium transition-all p-0.5 sm:p-1 min-h-[2.5rem] sm:min-h-[3.5rem]
                      ${!dayInfo.isCurrentMonth ? 'text-white/20' : ''}
                      ${weekend ? 'text-white/20 cursor-not-allowed' : ''}
                      ${past && !weekend ? 'text-white/30 cursor-not-allowed' : ''}
                      ${isCurrentDay && !isSelectedDay ? 'bg-workx-lime/20 text-workx-lime ring-1 sm:ring-2 ring-workx-lime/40' : ''}
                      ${isSelectedDay ? 'bg-workx-lime text-black font-bold' : ''}
                      ${hasAttendees && !isSelectedDay && !isCurrentDay ? 'bg-workx-lime/5 ring-1 ring-workx-lime/20 shadow-[0_0_8px_rgba(249,255,133,0.15)]' : ''}
                      ${!weekend && !past && !isSelectedDay && !hasAttendees && dayInfo.isCurrentMonth ? 'hover:bg-white/10 text-white cursor-pointer' : ''}
                      ${hasAttendees && !isSelectedDay && !isCurrentDay ? 'hover:bg-workx-lime/15 cursor-pointer' : ''}
                    `}
                  >
                    <span>{dayInfo.date.getDate()}</span>
                    {/* Attendance photo dots */}
                    {hasAttendees && (
                      <div className="flex -space-x-1 mt-0.5">
                        {dayAttendees.slice(0, 3).map((a, i) => {
                          const photoUrl = getPhotoUrl(a.name, a.avatarUrl)
                          return photoUrl ? (
                            <img
                              key={i}
                              src={photoUrl}
                              alt={a.name}
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover border ${isSelectedDay ? 'border-black/30' : 'border-workx-dark'}`}
                              title={a.name}
                            />
                          ) : (
                            <div
                              key={i}
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[7px] font-bold border ${isSelectedDay ? 'bg-black/20 text-black border-black/30' : 'bg-workx-lime/30 text-workx-lime border-workx-dark'}`}
                              title={a.name}
                            >
                              {a.name.charAt(0)}
                            </div>
                          )
                        })}
                        {dayAttendees.length > 3 && (
                          <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[7px] font-bold border ${isSelectedDay ? 'bg-black/20 text-black border-black/30' : 'bg-white/10 text-white/60 border-workx-dark'}`}>
                            +{dayAttendees.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-workx-lime/20 ring-1 ring-workx-lime/40"></div>
                Vandaag
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-workx-lime"></div>
                Geselecteerd
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-workx-lime/5 ring-1 ring-workx-lime/20 shadow-[0_0_6px_rgba(249,255,133,0.15)]"></div>
                Ingeschreven
              </span>
            </div>
          </div>
        </div>

        {/* Right: Selected Day Details */}
        <div className="space-y-4">
          {/* Date & Status */}
          <div className="card p-5">
            <div className="text-center mb-4">
              <p className="text-workx-lime text-sm font-medium">{formatSelectedDate()}</p>
              <p className="text-gray-400 text-xs mt-1">
                {new Date(selectedDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 bg-white/5 rounded-lg animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded animate-pulse"></div>
              </div>
            ) : attendanceData ? (
              <>
                {/* Occupancy Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">Bezetting</span>
                    <span className="text-sm font-medium text-white">
                      {attendanceData.occupiedWorkplaces} / {attendanceData.totalWorkplaces}
                    </span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                      style={{ width: `${occupancyPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">
                    {attendanceData.availableWorkplaces} {attendanceData.availableWorkplaces === 1 ? 'plek' : 'plekken'} beschikbaar
                  </p>
                </div>

                {/* Time Slot Selector */}
                <div className="mb-4">
                  <label className="block text-sm text-white/60 mb-2">Wanneer kom je?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.value}
                        onClick={() => {
                          if (attendanceData.isCurrentUserAttending) {
                            updateTimeSlot(slot.value)
                          } else {
                            setSelectedTimeSlot(slot.value)
                          }
                        }}
                        disabled={isToggling}
                        className={`
                          py-2 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1
                          ${selectedTimeSlot === slot.value
                            ? 'bg-workx-lime/20 text-workx-lime border border-workx-lime/40'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                          }
                        `}
                      >
                        <span className="text-base">{slot.icon}</span>
                        <span>{slot.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={toggleAttendance}
                  disabled={isToggling || (attendanceData.availableWorkplaces === 0 && !attendanceData.isCurrentUserAttending)}
                  className={`
                    w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                    ${attendanceData.isCurrentUserAttending
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                      : attendanceData.availableWorkplaces === 0
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-workx-lime text-black hover:bg-workx-lime/90'
                    }
                  `}
                >
                  {isToggling ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : attendanceData.isCurrentUserAttending ? (
                    <>
                      <Icons.x size={18} />
                      Afmelden
                    </>
                  ) : attendanceData.availableWorkplaces === 0 ? (
                    'Vol'
                  ) : (
                    <>
                      <Icons.check size={18} />
                      Aanmelden
                    </>
                  )}
                </button>

                {attendanceData.isCurrentUserAttending && (
                  <p className="text-center text-xs text-green-400 mt-2 flex items-center justify-center gap-1">
                    <Icons.check size={14} />
                    Je bent aangemeld ({TIME_SLOTS.find(s => s.value === attendanceData.currentUserTimeSlot)?.label || 'Hele dag'})
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-gray-400">Kon data niet laden</p>
            )}
          </div>

          {/* Attendees List */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icons.users size={18} className="text-white/60" />
              <h3 className="font-medium text-white">Wie komt er?</h3>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : attendanceData && attendanceData.attendees.length > 0 ? (
              <div className="space-y-2">
                {attendanceData.attendees.map((attendee) => {
                  const photoUrl = getPhotoUrl(attendee.name)
                  return (
                    <div
                      key={attendee.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        attendee.userId === attendanceData.currentUserId
                          ? 'bg-workx-lime/10 border border-workx-lime/20'
                          : 'bg-white/5'
                      }`}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={attendee.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-white/60">
                          {attendee.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm block ${
                          attendee.userId === attendanceData.currentUserId
                            ? 'text-workx-lime font-medium'
                            : 'text-white/80'
                        }`}>
                          {attendee.name}
                          {attendee.userId === attendanceData.currentUserId && ' (jij)'}
                        </span>
                        {attendee.timeSlot && attendee.timeSlot !== 'FULL_DAY' && (
                          <span className="text-xs text-white/40">
                            {attendee.timeSlot === 'MORNING' ? '🌅 Ochtend' : '🌆 Middag'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <img
                    src="/workx-pand.png"
                    alt="Kantoor"
                    className="h-10 w-auto opacity-60"
                  />
                </div>
                <p className="text-white/50 text-sm">Nog niemand aangemeld</p>
                <p className="text-white/30 text-xs mt-1">Wees de eerste!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
