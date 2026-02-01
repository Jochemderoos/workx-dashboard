'use client'

import { useState, useEffect, useMemo } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Attendee {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
}

interface AttendanceData {
  date: string
  attendees: Attendee[]
  totalWorkplaces: number
  occupiedWorkplaces: number
  availableWorkplaces: number
  isCurrentUserAttending: boolean
  currentUserId: string
}

// Helper functie om lokale datum string te krijgen (YYYY-MM-DD)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AppjeplekjePage() {
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()))
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Haal data op voor geselecteerde datum
  useEffect(() => {
    fetchAttendance(selectedDate)
  }, [selectedDate])

  const fetchAttendance = async (date: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/office-attendance?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setAttendanceData(data)
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
          body: JSON.stringify({ date: selectedDate }),
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
    } catch (error) {
      console.error('Error toggling attendance:', error)
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
            <span className="text-2xl sm:text-3xl">🏢</span>
            Appjeplekje
          </h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Meld je aan voor een werkplek op kantoor</p>
        </div>
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
                <div key={day} className="text-center text-[10px] sm:text-xs font-medium text-white/40 py-1 sm:py-2">
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
                      aspect-square rounded-md sm:rounded-lg flex items-center justify-center text-xs sm:text-sm font-medium transition-all
                      ${!dayInfo.isCurrentMonth ? 'text-white/20' : ''}
                      ${weekend ? 'text-white/20 cursor-not-allowed' : ''}
                      ${past && !weekend ? 'text-white/30 cursor-not-allowed' : ''}
                      ${isCurrentDay && !isSelectedDay ? 'bg-workx-lime/20 text-workx-lime ring-1 sm:ring-2 ring-workx-lime/40' : ''}
                      ${isSelectedDay ? 'bg-workx-lime text-black font-bold' : ''}
                      ${!weekend && !past && !isSelectedDay && dayInfo.isCurrentMonth ? 'hover:bg-white/10 text-white cursor-pointer' : ''}
                    `}
                  >
                    {dayInfo.date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5 flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px] text-white/40">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-workx-lime/20 ring-1 ring-workx-lime/40"></div>
                Vandaag
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-workx-lime"></div>
                Geselecteerd
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
              <p className="text-white/40 text-xs mt-1">
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
                  <p className="text-xs text-white/40 mt-1.5 text-center">
                    {attendanceData.availableWorkplaces} {attendanceData.availableWorkplaces === 1 ? 'plek' : 'plekken'} beschikbaar
                  </p>
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
                    Je bent aangemeld voor deze dag
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-white/40">Kon data niet laden</p>
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
                      <span className={`text-sm ${
                        attendee.userId === attendanceData.currentUserId
                          ? 'text-workx-lime font-medium'
                          : 'text-white/80'
                      }`}>
                        {attendee.name}
                        {attendee.userId === attendanceData.currentUserId && ' (jij)'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">🏢</span>
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
