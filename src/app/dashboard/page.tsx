'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import { TEAM_PHOTOS, ADVOCATEN, getPhotoUrl } from '@/lib/team-photos'
import { LUSTRUM_CONFIG, MALLORCA_FACTS, getCountdown } from '@/lib/lustrum-data'

// Inline Logo Component - yellow background with black text
function WorkxLogoSmall() {
  return (
    <div className="inline-block rounded-lg overflow-hidden" style={{ background: '#f9ff85' }}>
      <div className="relative flex flex-col justify-center px-4 py-3" style={{ width: 120 }}>
        <span
          className="leading-none"
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: '#1e1e1e',
            fontFamily: "'PP Neue Montreal', system-ui, -apple-system, sans-serif"
          }}
        >
          Workx
        </span>
        <span
          className="uppercase"
          style={{
            fontSize: '8px',
            letterSpacing: '2px',
            marginTop: '2px',
            fontWeight: 500,
            color: '#1e1e1e',
            fontFamily: "'PP Neue Montreal', system-ui, -apple-system, sans-serif"
          }}
        >
          ADVOCATEN
        </span>
      </div>
    </div>
  )
}

// Team verjaardagen - echte data uit loonstroken
const TEAM_BIRTHDAYS = [
  { name: 'Hanna Blaauboer', birthDate: '12-23' },        // 23-12-1991
  { name: 'Justine Schellekens', birthDate: '06-29' },    // 29-6-1994
  { name: 'Marlieke Schipper', birthDate: '01-10' },      // 10-1-1992
  { name: 'Wies van Pesch', birthDate: '01-16' },          // 16-1-1991
  { name: 'Emma van der Vos', birthDate: '09-04' },       // 4-9-1992
  { name: 'Alain Heunen', birthDate: '04-03' },            // 3-4-1991
  { name: 'Kay Maes', birthDate: '01-24' },               // 24-1-1999
  { name: 'Erika van Zadelhof', birthDate: '06-23' },     // 23-6-1995
  { name: 'Heleen Pesser', birthDate: '07-14' },           // 14-7-1999
  { name: 'Barbara Rip', birthDate: '04-04' },            // 4-4-1996
  { name: 'Lotte van Sint Truiden', birthDate: '06-03' }, // 3-6-2002
  { name: 'Julia Groen', birthDate: '07-15' },            // 15-7-1992
  { name: 'Jochem de Roos', birthDate: '03-02' },         // Enige echte uit originele lijst
]

// Team photos en advocaten lijst komen nu uit @/lib/team-photos

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  isAllDay: boolean
  location: string | null
  color: string
}

interface WorkItem {
  id: string
  title: string
  status: string
  priority: string
  clientName: string | null
}

interface WeatherData {
  temperature: number
  weatherCode: number
  windSpeed: number
  humidity: number
  location: string
  isLoading: boolean
}

// Weather code mapping to icon and description
const getWeatherInfo = (code: number) => {
  // WMO Weather codes: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
  if (code === 0) return { icon: '☀️', desc: 'Helder' }
  if (code <= 3) return { icon: '⛅', desc: 'Deels bewolkt' }
  if (code <= 49) return { icon: '🌫️', desc: 'Mistig' }
  if (code <= 59) return { icon: '🌧️', desc: 'Motregen' }
  if (code <= 69) return { icon: '🌧️', desc: 'Regen' }
  if (code <= 79) return { icon: '🌨️', desc: 'Sneeuw' }
  if (code <= 84) return { icon: '🌧️', desc: 'Buien' }
  if (code <= 94) return { icon: '🌨️', desc: 'Sneeuwbuien' }
  if (code <= 99) return { icon: '⛈️', desc: 'Onweer' }
  return { icon: '🌤️', desc: 'Onbekend' }
}

// Vacation interface for fetched data
interface VacationData {
  id: string
  personName: string
  startDate: string
  endDate: string
  note: string | null
  color: string
}

// Calendar absence interface
interface CalendarAbsence {
  id: string
  personName: string
  startDate: string
  endDate: string
  note: string | null
  color: string
  isCalendarEvent: boolean
}

// Feedback interface
interface FeedbackItem {
  id: string
  type: 'BUG' | 'IDEA' | 'QUESTION' | 'OTHER'
  title: string
  description: string
  submittedBy: string
  createdAt: string
}

// Current user interface
interface CurrentUser {
  name: string
  role: string
}

// Office attendance interface
interface OfficeAttendanceData {
  date: string
  attendees: { id: string; userId: string; name: string; avatarUrl: string | null }[]
  totalWorkplaces: number
  occupiedWorkplaces: number
  availableWorkplaces: number
  isCurrentUserAttending: boolean
}

// Vakantiedagen en ouderschapsverlof worden geladen uit de database via API
// Deze waarden worden nu leeg gelaten - data komt van de ingelogde gebruiker
const VACATION_BALANCE = {
  userName: '',
  year: new Date().getFullYear(),
  wettelijkeDagen: 0,
  bovenwettelijkeDagen: 0,
  overgedragenVorigJaar: 0,
  opgenomenDitJaar: 0,
  geplandDitJaar: 0,
  lastUpdatedBy: '',
  lastUpdated: '',
}

const PARENTAL_LEAVE = {
  hasParentalLeave: false,
  userName: '',
  year: new Date().getFullYear(),
  betaaldTotaalWeken: 0,
  betaaldOpgenomenWeken: 0,
  onbetaaldTotaalWeken: 0,
  onbetaaldOpgenomenWeken: 0,
  inzetPerWeek: 0,
  startDatum: '',
  eindDatum: '',
  kindNaam: '',
  kindGeboorteDatum: '',
  lastUpdatedBy: '',
  lastUpdated: '',
}

const quickLinks = [
  { href: '/dashboard/agenda', Icon: Icons.calendar, label: 'Agenda', desc: 'Events & verjaardagen', color: 'from-blue-500/20 to-blue-600/10', iconAnim: 'icon-calendar-hover' },
  { href: '/dashboard/bonus', Icon: Icons.euro, label: 'Bonus', desc: 'Berekeningen', color: 'from-green-500/20 to-green-600/10', iconAnim: 'icon-euro-hover' },
  { href: '/dashboard/werk', Icon: Icons.briefcase, label: 'Werk', desc: 'Taken beheren', color: 'from-red-500/20 to-red-600/10', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/lustrum', Icon: Icons.star, label: 'Lustrum', desc: '15 jaar Workx!', color: 'from-orange-500/20 to-amber-600/10', iconAnim: 'icon-star-hover' },
]

// Appjeplekje Widget - Compact office attendance widget
function AppjeplekjeWidget({
  data,
  isToggling,
  onToggle,
}: {
  data: OfficeAttendanceData | null
  isToggling: boolean
  onToggle: () => void
}) {
  if (!data) {
    return (
      <Link
        href="/dashboard/appjeplekje"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 border-2 border-cyan-500/30 p-4 block"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <span className="text-xl">🏢</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Appjeplekje</p>
            <p className="text-[11px] text-cyan-300/70">Laden...</p>
          </div>
        </div>
        <div className="h-3 bg-white/10 rounded-full animate-pulse"></div>
      </Link>
    )
  }

  const occupancyPercentage = (data.occupiedWorkplaces / data.totalWorkplaces) * 100
  const getProgressColor = () => {
    if (occupancyPercentage < 50) return 'bg-green-500'
    if (occupancyPercentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getProgressBgColor = () => {
    if (occupancyPercentage < 50) return 'bg-green-500/20'
    if (occupancyPercentage < 80) return 'bg-yellow-500/20'
    return 'bg-red-500/20'
  }

  return (
    <Link
      href="/dashboard/appjeplekje"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 border-2 border-cyan-500/30 hover:border-cyan-400/50 p-4 group transition-all block shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20"
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-400/30 transition-colors" />
      <div className="absolute -bottom-4 -left-4 text-5xl opacity-10 group-hover:opacity-20 transition-opacity">🏢</div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-xl">🏢</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Appjeplekje</p>
              <p className="text-[11px] text-cyan-300/70 font-medium">📅 Vandaag op kantoor</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggle()
            }}
            disabled={isToggling || (data.availableWorkplaces === 0 && !data.isCurrentUserAttending)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
              data.isCurrentUserAttending
                ? 'bg-green-500/30 text-green-300 border border-green-400/40 shadow-green-500/20 hover:bg-green-500/40'
                : data.availableWorkplaces === 0
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-cyan-500/30 hover:shadow-cyan-400/40 hover:scale-105'
            }`}
          >
            {isToggling ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
            ) : data.isCurrentUserAttending ? (
              <span className="flex items-center gap-1.5"><Icons.check size={14} /> Aangemeld</span>
            ) : data.availableWorkplaces === 0 ? (
              'Vol'
            ) : (
              <span className="flex items-center gap-1.5"><Icons.plus size={14} /> Aanmelden</span>
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className={`h-3 ${getProgressBgColor()} rounded-full overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60 font-medium">
            {data.occupiedWorkplaces}/{data.totalWorkplaces} plekken bezet
            {data.availableWorkplaces > 0 && (
              <span className="text-cyan-300/70 ml-1">
                · {data.availableWorkplaces} vrij
              </span>
            )}
          </span>
          {data.attendees.length > 0 && (
            <div className="flex -space-x-2">
              {data.attendees.slice(0, 5).map((a) => {
                const photoUrl = getPhotoUrl(a.name)
                return (
                  <div
                    key={a.id}
                    className="w-7 h-7 rounded-full bg-white/10 border-2 border-cyan-900 flex items-center justify-center text-[10px] text-white/60 overflow-hidden"
                    title={a.name}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      a.name.charAt(0)
                    )}
                  </div>
                )
              })}
              {data.attendees.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/30 border-2 border-cyan-900 flex items-center justify-center text-[10px] text-cyan-300 font-bold">
                  +{data.attendees.length - 5}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// Lustrum Teaser Widget with rotating content
function LustrumTeaserWidget() {
  const [countdown, setCountdown] = useState(getCountdown())
  const [teaserIndex, setTeaserIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdown())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Rotate teaser content every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTeaserIndex((prev) => (prev + 1) % 4)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  // Get daily fact
  const dailyFact = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )
    return MALLORCA_FACTS[dayOfYear % MALLORCA_FACTS.length]
  }, [])

  const teasers = [
    // Countdown
    {
      content: (
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[
              { value: countdown.days, label: 'd' },
              { value: countdown.hours, label: 'u' },
              { value: countdown.minutes, label: 'm' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <span className="text-2xl font-bold text-orange-400 tabular-nums">
                  {String(item.value).padStart(2, '0')}
                </span>
                <span className="text-xs text-white/40">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm text-white">tot Mallorca!</p>
            <p className="text-xs text-white/40">30 sep - 4 okt 2026</p>
          </div>
        </div>
      ),
    },
    // Daily fact
    {
      content: (
        <div>
          <p className="text-xs text-amber-400 mb-1">💡 Weetje van de dag</p>
          <p className="text-sm text-white/80 line-clamp-2">{dailyFact}</p>
        </div>
      ),
    },
    // Weather teaser
    {
      content: (
        <div className="flex items-center gap-4">
          <span className="text-4xl">☀️</span>
          <div>
            <p className="text-sm text-white">Perfect weer in oktober</p>
            <p className="text-xs text-white/40">Gemiddeld 22°C in Mallorca</p>
          </div>
        </div>
      ),
    },
    // Location teaser
    {
      content: (
        <div className="flex items-center gap-4">
          <span className="text-4xl">🏠</span>
          <div>
            <p className="text-sm text-white">Can Fressa, Alaró</p>
            <p className="text-xs text-white/40">Finca bij de Serra de Tramuntana</p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
            <span className="text-lg">🌴</span>
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Lustrum 15 Jaar</h2>
          </div>
        </div>
        <Link href="/dashboard/lustrum" className="text-sm text-orange-400 hover:underline flex items-center gap-1">
          Bekijk alles
          <Icons.arrowRight size={14} />
        </Link>
      </div>

      <Link
        href="/dashboard/lustrum"
        className="card p-4 block group hover:border-orange-500/30 transition-all relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute -bottom-4 -left-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity">
          🎉
        </div>

        <div className="relative">
          {/* Rotating content */}
          <div className="min-h-[60px] flex items-center">
            {teasers[teaserIndex].content}
          </div>

          {/* Dots indicator */}
          <div className="flex gap-1.5 mt-3">
            {teasers.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  setTeaserIndex(i)
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === teaserIndex ? 'bg-orange-400 w-4' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function DashboardHome() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [vacations, setVacations] = useState<VacationData[]>([])
  const [calendarAbsences, setCalendarAbsences] = useState<CalendarAbsence[]>([])
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showVacationDetails, setShowVacationDetails] = useState(false)
  const [showCountdownPopup, setShowCountdownPopup] = useState(false)
  const [countdownDays, setCountdownDays] = useState(0)
  const [officeAttendance, setOfficeAttendance] = useState<OfficeAttendanceData | null>(null)
  const [isTogglingAttendance, setIsTogglingAttendance] = useState(false)
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    windSpeed: 0,
    humidity: 0,
    location: 'Amsterdam',
    isLoading: true,
  })

  // Calculate next birthday
  const nextBirthday = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()

    const upcomingBirthdays = TEAM_BIRTHDAYS.map(member => {
      const [month, day] = member.birthDate.split('-').map(Number)
      let birthdayThisYear = new Date(currentYear, month - 1, day)

      if (birthdayThisYear < today) {
        birthdayThisYear = new Date(currentYear + 1, month - 1, day)
      }

      const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const isToday = birthdayThisYear.toDateString() === today.toDateString()
      return { ...member, date: birthdayThisYear, daysUntil, isToday }
    }).sort((a, b) => a.daysUntil - b.daysUntil)

    return upcomingBirthdays.slice(0, 3) // Return top 3
  }, [])

  // Check if someone has birthday TODAY
  const birthdayToday = useMemo(() => {
    return nextBirthday.find(b => b.daysUntil === 0)
  }, [nextBirthday])

  // Calculate who's away this week (vacations + calendar absences)
  const awayThisWeek = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

    const vacationAway = vacations.filter(v => {
      const start = new Date(v.startDate)
      const end = new Date(v.endDate)
      return start <= endOfWeek && end >= startOfWeek
    }).map(v => {
      const start = new Date(v.startDate)
      const end = new Date(v.endDate)
      const isToday = start <= today && end >= today
      return { ...v, isToday }
    })

    const calendarAway = calendarAbsences.filter(a => {
      const start = new Date(a.startDate)
      const end = new Date(a.endDate)
      return start <= endOfWeek && end >= startOfWeek
    }).map(a => {
      const start = new Date(a.startDate)
      const end = new Date(a.endDate)
      const isToday = start <= today && end >= today
      return { ...a, isToday }
    })

    // Combine and deduplicate
    const combined = [...vacationAway, ...calendarAway]
    const seen = new Set<string>()
    return combined.filter(a => {
      if (seen.has(a.personName)) return false
      seen.add(a.personName)
      return true
    })
  }, [vacations, calendarAbsences])

  // Get 2 weeks of workdays (Monday-Friday only)
  const twoWeeksWorkdays = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday of current week

    const days: { date: Date; isCurrentWeek: boolean }[] = []

    // Week 1 (current week) - Mon to Fri
    for (let i = 0; i < 5; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push({ date, isCurrentWeek: true })
    }

    // Week 2 (next week) - Mon to Fri
    for (let i = 7; i < 12; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push({ date, isCurrentWeek: false })
    }

    return days
  }, [])

  // Helper to get absences for a specific date (combines vacations + calendar absences)
  const getAbsencesForDate = (date: Date) => {
    // Normalize date to YYYY-MM-DD string for comparison
    const checkDateStr = date.toISOString().split('T')[0]

    // Get vacation absences
    const vacationAbsences = vacations.filter(v => {
      const startStr = new Date(v.startDate).toISOString().split('T')[0]
      const endStr = new Date(v.endDate).toISOString().split('T')[0]
      return startStr <= checkDateStr && endStr >= checkDateStr
    })

    // Get calendar absences (part-time days, etc.)
    const calAbsences = calendarAbsences.filter(a => {
      const startStr = new Date(a.startDate).toISOString().split('T')[0]
      const endStr = new Date(a.endDate).toISOString().split('T')[0]
      return startStr <= checkDateStr && endStr >= checkDateStr
    })

    // Combine and deduplicate by person name
    const combined = [...vacationAbsences, ...calAbsences]
    const seen = new Set<string>()
    return combined.filter(a => {
      if (seen.has(a.personName)) return false
      seen.add(a.personName)
      return true
    })
  }

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number, locationName: string) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Europe%2FAmsterdam`
        )
        if (res.ok) {
          const data = await res.json()
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            windSpeed: Math.round(data.current.wind_speed_10m),
            humidity: data.current.relative_humidity_2m,
            location: locationName,
            isLoading: false,
          })
        }
      } catch (e) {
        console.error('Weather fetch error:', e)
        setWeather(prev => ({ ...prev, isLoading: false }))
      }
    }

    // Try to get user location, fallback to Amsterdam
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Got user location - reverse geocode for city name would require another API
          // For simplicity, just use "Uw locatie"
          fetchWeather(position.coords.latitude, position.coords.longitude, 'Uw locatie')
        },
        () => {
          // Geolocation denied or failed - use Amsterdam
          fetchWeather(52.3676, 4.9041, 'Amsterdam')
        },
        { timeout: 5000 }
      )
    } else {
      // No geolocation support - use Amsterdam
      fetchWeather(52.3676, 4.9041, 'Amsterdam')
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Check for countdown milestones (200, 150, 100, 50, and every day from 10 onwards)
  useEffect(() => {
    const countdown = getCountdown()
    const days = countdown.days
    setCountdownDays(days)

    const milestones = [200, 150, 100, 50]
    const isMilestone = milestones.includes(days) || (days <= 10 && days >= 0)

    if (isMilestone) {
      // Check localStorage to not show same milestone twice per day
      const today = new Date().toISOString().split('T')[0]
      const storageKey = `lustrum-milestone-${days}-${today}`
      const alreadyShown = localStorage.getItem(storageKey)

      if (!alreadyShown) {
        setShowCountdownPopup(true)
        localStorage.setItem(storageKey, 'true')
      }
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchEvents(), fetchWork(), fetchVacations(), fetchCalendarAbsences(), fetchFeedback(), fetchCurrentUser(), fetchOfficeAttendance()]).finally(() => setIsLoading(false))
  }, [])

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/calendar?upcoming=true&limit=5')
      if (res.ok) setEvents(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const fetchWork = async () => {
    try {
      const res = await fetch('/api/work?limit=5')
      if (res.ok) {
        const data = await res.json()
        setWorkItems(data.filter((w: WorkItem) => w.status !== 'COMPLETED').slice(0, 5))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchVacations = async () => {
    try {
      const res = await fetch('/api/vacation/requests?all=true')
      if (res.ok) {
        const data = await res.json()
        // Transform API data to VacationData format
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#ef4444', '#6366f1']
        const transformed: VacationData[] = data.map((v: any, i: number) => ({
          id: v.id,
          personName: v.user?.name || 'Onbekend',
          startDate: v.startDate,
          endDate: v.endDate,
          note: v.reason || null,
          color: colors[i % colors.length],
        }))
        setVacations(transformed)
      }
    } catch (e) {
      console.error('Error fetching vacations:', e)
    }
  }

  // Fetch calendar events with ABSENCE category (part-time days, etc.)
  const fetchCalendarAbsences = async () => {
    try {
      // Get 2 weeks range
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
      const endOfNextWeek = new Date(startOfWeek)
      endOfNextWeek.setDate(startOfWeek.getDate() + 13) // Sunday next week

      const res = await fetch(`/api/calendar?startDate=${startOfWeek.toISOString()}&endDate=${endOfNextWeek.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        // Filter only ABSENCE category events and transform
        const absenceEvents = data
          .filter((e: any) => e.category === 'ABSENCE')
          .map((e: any) => ({
            id: e.id,
            personName: e.createdBy?.name || e.title.replace('Afwezig: ', ''),
            startDate: e.startTime,
            endDate: e.endTime,
            note: e.description || e.title,
            color: '#f97316', // Orange for absences
            isCalendarEvent: true,
          }))
        setCalendarAbsences(absenceEvents)
      }
    } catch (e) {
      console.error('Error fetching calendar absences:', e)
    }
  }

  const fetchFeedback = async () => {
    try {
      const res = await fetch('/api/feedback')
      if (res.ok) {
        const data = await res.json()
        setFeedbackItems(data)
      }
    } catch (e) {
      console.error('Error fetching feedback:', e)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        setCurrentUser({ name: data.name, role: data.role })
      }
    } catch (e) {
      console.error('Error fetching user:', e)
    }
  }

  const fetchOfficeAttendance = async () => {
    try {
      // Use local date to avoid timezone issues
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const res = await fetch(`/api/office-attendance?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        setOfficeAttendance(data)
      } else {
        console.error('Error fetching office attendance:', res.status, res.statusText)
        // Set default data so widget still renders
        setOfficeAttendance({
          date: today,
          attendees: [],
          totalWorkplaces: 11,
          occupiedWorkplaces: 0,
          availableWorkplaces: 11,
          isCurrentUserAttending: false,
        })
      }
    } catch (e) {
      console.error('Error fetching office attendance:', e)
      // Set default data so widget still renders
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      setOfficeAttendance({
        date: today,
        attendees: [],
        totalWorkplaces: 11,
        occupiedWorkplaces: 0,
        availableWorkplaces: 11,
        isCurrentUserAttending: false,
      })
    }
  }

  const toggleOfficeAttendance = async () => {
    if (!officeAttendance || isTogglingAttendance) return
    setIsTogglingAttendance(true)

    try {
      // Use local date to avoid timezone issues
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      let res: Response

      if (officeAttendance.isCurrentUserAttending) {
        res = await fetch(`/api/office-attendance?date=${today}`, { method: 'DELETE' })
      } else {
        res = await fetch('/api/office-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today }),
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        alert(errorData.error || 'Er ging iets mis')
        return
      }

      await fetchOfficeAttendance()
    } catch (e) {
      console.error('Error toggling attendance:', e)
      alert('Er ging iets mis met de verbinding')
    } finally {
      setIsTogglingAttendance(false)
    }
  }

  const deleteFeedback = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setFeedbackItems(prev => prev.filter(f => f.id !== id))
      }
    } catch (e) {
      console.error('Error deleting feedback:', e)
    }
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (d.toDateString() === now.toDateString()) return 'Vandaag'
    if (d.toDateString() === tomorrow.toDateString()) return 'Morgen'
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Goedemorgen'
    if (hour < 18) return 'Goedemiddag'
    return 'Goedenavond'
  }

  const priorityColors: Record<string, string> = {
    LOW: 'bg-white/30',
    MEDIUM: 'bg-blue-400',
    HIGH: 'bg-orange-400',
    URGENT: 'bg-red-400',
  }

  const statusLabels: Record<string, string> = {
    NEW: 'Nieuw',
    IN_PROGRESS: 'Bezig',
    PENDING_REVIEW: 'Review',
    ON_HOLD: 'On hold',
  }

  const weatherInfo = getWeatherInfo(weather.weatherCode)

  // Check if current user is admin/partner (Jochem)
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

  // Feedback type config
  const feedbackTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    BUG: { icon: Icons.alertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    IDEA: { icon: Icons.zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    QUESTION: { icon: Icons.help, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    OTHER: { icon: Icons.chat, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  }

  return (
    <div className="space-y-8 fade-in">
      {/* LUSTRUM COUNTDOWN MILESTONE POPUP */}
      {showCountdownPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          {/* Confetti background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(60)].map((_, i) => (
              <span
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`,
                  fontSize: `${1 + Math.random() * 1.5}rem`,
                }}
              >
                {['🎉', '✨', '🌴', '☀️', '🎊', '🏝️', '🍹', '⭐', '🥳', '🎈'][Math.floor(Math.random() * 10)]}
              </span>
            ))}
          </div>

          {/* Popup Content */}
          <div className="relative max-w-lg w-full bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border-2 border-orange-500/40 rounded-3xl p-8 shadow-2xl text-center transform animate-pulse">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-6xl">
              {countdownDays <= 10 ? '🚨' : '🎉'}
            </div>

            <div className="mt-4 mb-6">
              <p className="text-orange-400 text-lg font-medium mb-2">
                {countdownDays <= 10 ? 'Bijna zover!' : 'Lustrum Countdown'}
              </p>
              <div className="text-7xl font-bold text-white mb-2">
                {countdownDays}
              </div>
              <p className="text-2xl text-white/80">
                {countdownDays === 1 ? 'dag' : 'dagen'} tot Mallorca!
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {['🌴', '☀️', '🏝️', '✈️', '🍷'].map((emoji, i) => (
                <span
                  key={i}
                  className="text-3xl animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {emoji}
                </span>
              ))}
            </div>

            <p className="text-white/60 mb-6">
              30 september - 4 oktober 2026<br />
              <span className="text-orange-400">Can Fressa, Mallorca</span>
            </p>

            <button
              onClick={() => setShowCountdownPopup(false)}
              className="px-8 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              {countdownDays <= 10 ? 'Ik ben er klaar voor! 🎉' : 'Sluit af'}
            </button>
          </div>
        </div>
      )}

      {/* BIRTHDAY CELEBRATION - Full screen confetti when someone has birthday TODAY */}
      {birthdayToday && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden birthday-celebration">
          {/* Massive confetti burst */}
          {[...Array(50)].map((_, i) => (
            <span
              key={i}
              className="birthday-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
                fontSize: `${1 + Math.random() * 2}rem`,
              }}
            >
              {['🎉', '🎊', '🥳', '🎈', '🎁', '⭐', '✨', '🎀', '🎂', '💫'][Math.floor(Math.random() * 10)]}
            </span>
          ))}
          <style jsx>{`
            .birthday-confetti {
              position: absolute;
              top: -50px;
              animation: birthdayFall linear infinite;
            }
            @keyframes birthdayFall {
              0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
              50% { opacity: 1; }
              100% { transform: translateY(110vh) rotate(1080deg) scale(0.5); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Hero Header with Logo */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-workx-gray to-workx-dark border border-white/10 p-4 sm:p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-workx-lime/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-workx-lime/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Workx Logo */}
            <div className="hidden md:block">
              <WorkxLogoSmall />
            </div>
            <div>
              <p className="text-workx-lime text-xs sm:text-sm font-medium mb-1">{getGreeting()}</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">Welkom bij Workx</h1>
              <p className="text-white/50 max-w-md hidden sm:block">
                Beheer je zaken, bereken bonussen en houd je team op de hoogte. Alles in één dashboard.
              </p>
            </div>
          </div>

          {/* Mobile Appjeplekje Widget - Only visible on mobile */}
          <div className="lg:hidden">
            <AppjeplekjeWidget
              data={officeAttendance}
              isToggling={isTogglingAttendance}
              onToggle={toggleOfficeAttendance}
            />
          </div>

          <div className="hidden lg:flex items-start gap-8">
            {/* Weather Widget */}
            <div className="text-center bg-white/5 rounded-xl p-4 min-w-[120px]">
              {weather.isLoading ? (
                <div className="animate-pulse">
                  <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2" />
                  <div className="h-4 bg-white/10 rounded w-16 mx-auto" />
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-1">{weatherInfo.icon}</div>
                  <p className="text-2xl font-semibold text-white">{weather.temperature}°</p>
                  <p className="text-xs text-white/40">{weatherInfo.desc}</p>
                  <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-white/30">
                    <span className="flex items-center gap-0.5">
                      <Icons.wind size={10} />
                      {weather.windSpeed} km/h
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Icons.droplet size={10} />
                      {weather.humidity}%
                    </span>
                  </div>
                  <p className="text-[10px] text-white/20 mt-1">{weather.location}</p>
                </>
              )}
            </div>

            {/* Time */}
            <div className="text-right">
              <div className="text-5xl font-light text-white tabular-nums">
                {currentTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-white/40 mt-1">
                {currentTime.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {/* Workx Pand with bicycle hover animation */}
              <div className="workx-pand-container h-20 mt-3 ml-auto">
                <img src="/workx-pand.png" alt="Workx Pand" className="h-full opacity-50 hover:opacity-70 transition-opacity" />
                <img src="/fiets.png" alt="Fiets" className="fiets" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links Grid + Appjeplekje (Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Links - Takes 3 columns on desktop */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Snelle toegang</h2>
            <span className="text-xs text-white/30">{quickLinks.length} tools</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLinks.map(({ href, Icon, label, desc, color, iconAnim }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-workx-lime/30 hover:bg-white/[0.05] transition-all duration-300 ${iconAnim}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/60 group-hover:text-workx-lime group-hover:bg-workx-lime/10 transition-all mb-3 icon-animated">
                  <Icon size={20} />
                </div>
                <h3 className="font-medium text-white text-sm mb-0.5">{label}</h3>
                <p className="text-[11px] text-white/40">{desc}</p>
              </div>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icons.arrowRight size={14} className="text-workx-lime" />
              </div>
            </Link>
          ))}
          </div>
        </div>

        {/* Desktop Appjeplekje Widget - Only visible on desktop */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Kantoor</h2>
          </div>
          <AppjeplekjeWidget
            data={officeAttendance}
            isToggling={isTogglingAttendance}
            onToggle={toggleOfficeAttendance}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Events & Absence Column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Absence Overview - 2 Weeks */}
          <div className="card p-3 sm:p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative">
              {/* Header - stays fixed */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 flex items-center justify-center">
                    <Icons.users className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Wie is er weg?</h2>
                    <p className="text-xs text-white/40">Overzicht komende 2 weken</p>
                  </div>
                </div>
                <Link href="/dashboard/vakanties" className="text-sm text-workx-lime hover:underline flex items-center gap-1">
                  Beheren
                  <Icons.arrowRight size={14} />
                </Link>
              </div>

              {/* 2-Week Grid */}
              <div className="space-y-2 sm:space-y-4">
                  {/* Week labels */}
                  <div className="grid grid-cols-5 gap-0.5 sm:gap-2">
                    {['Ma', 'Di', 'Wo', 'Do', 'Vr'].map(day => (
                      <div key={day} className="text-center text-[8px] sm:text-[10px] font-medium text-white/30 uppercase">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Current Week */}
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-white/50 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-workx-lime"></span>
                      Deze week
                    </p>
                    <div className="grid grid-cols-5 gap-0.5 sm:gap-2">
                    {twoWeeksWorkdays.slice(0, 5).map((dayInfo, i) => {
                      const isToday = dayInfo.date.toDateString() === new Date().toDateString()
                      const absences = getAbsencesForDate(dayInfo.date)
                      const isPast = dayInfo.date < new Date() && !isToday

                      return (
                        <div
                          key={i}
                          className={`rounded-md sm:rounded-xl p-1 sm:p-3 min-h-[70px] sm:min-h-[140px] transition-all ${
                            isToday
                              ? 'bg-workx-lime/10 ring-1 sm:ring-2 ring-workx-lime/40'
                              : isPast
                              ? 'bg-white/[0.02] opacity-50'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className={`text-center mb-0.5 pb-0.5 sm:mb-2 sm:pb-2 border-b ${isToday ? 'border-workx-lime/20' : 'border-white/5'}`}>
                            <p className={`text-xs sm:text-lg font-bold ${isToday ? 'text-workx-lime' : 'text-white'}`}>
                              {dayInfo.date.getDate()}
                            </p>
                          </div>

                          {absences.length === 0 ? (
                            <div className="flex items-center justify-center h-6 sm:h-16">
                              <Icons.check size={12} className="text-green-500/40 sm:w-[18px] sm:h-[18px]" />
                            </div>
                          ) : (
                            <div className="space-y-0.5 sm:space-y-1">
                              {absences.slice(0, 3).map((v, j) => (
                                <div
                                  key={j}
                                  className="flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5"
                                  title={v.personName}
                                >
                                  <div
                                    className="w-3.5 h-3.5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[7px] sm:text-[10px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: v.color + '30', color: v.color }}
                                  >
                                    {v.personName.charAt(0)}
                                  </div>
                                  <span className="text-[9px] sm:text-xs text-white/70 truncate hidden sm:inline">
                                    {v.personName.split(' ')[0]}
                                  </span>
                                </div>
                              ))}
                              {absences.length > 3 && (
                                <p className="text-[7px] sm:text-[10px] text-white/40 text-center">+{absences.length - 3}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Next Week */}
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-white/50 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Volgende week
                  </p>
                  <div className="grid grid-cols-5 gap-0.5 sm:gap-2">
                    {twoWeeksWorkdays.slice(5, 10).map((dayInfo, i) => {
                      const absences = getAbsencesForDate(dayInfo.date)

                      return (
                        <div
                          key={i}
                          className="rounded-md sm:rounded-xl p-1 sm:p-3 min-h-[70px] sm:min-h-[140px] bg-white/[0.03] hover:bg-white/5 transition-all"
                        >
                          <div className="text-center mb-0.5 pb-0.5 sm:mb-2 sm:pb-2 border-b border-white/5">
                            <p className="text-xs sm:text-lg font-bold text-white/80">
                              {dayInfo.date.getDate()}
                            </p>
                          </div>

                          {absences.length === 0 ? (
                            <div className="flex items-center justify-center h-6 sm:h-16">
                              <Icons.check size={12} className="text-green-500/30 sm:w-[18px] sm:h-[18px]" />
                            </div>
                          ) : (
                            <div className="space-y-0.5 sm:space-y-1">
                              {absences.slice(0, 3).map((v, j) => (
                                <div
                                  key={j}
                                  className="flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5"
                                  title={v.personName}
                                >
                                  <div
                                    className="w-3.5 h-3.5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[7px] sm:text-[10px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: v.color + '30', color: v.color }}
                                  >
                                    {v.personName.charAt(0)}
                                  </div>
                                  <span className="text-[9px] sm:text-xs text-white/60 truncate hidden sm:inline">
                                    {v.personName.split(' ')[0]}
                                  </span>
                                </div>
                              ))}
                              {absences.length > 3 && (
                                <p className="text-[7px] sm:text-[10px] text-white/40 text-center">+{absences.length - 3}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4 text-[10px] text-white/30">
                <span className="flex items-center gap-1.5">
                  <Icons.check size={12} className="text-green-500/50" />
                  Iedereen aanwezig
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-workx-lime/20 ring-1 ring-workx-lime/40"></div>
                  Vandaag
                </span>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.calendar className="text-workx-lime" size={16} />
                </div>
                <h2 className="text-lg font-medium text-white">Aankomende events</h2>
              </div>
              <Link href="/dashboard/agenda" className="text-sm text-workx-lime hover:underline flex items-center gap-1">
                Bekijk agenda
                <Icons.arrowRight size={14} />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card h-20 animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icons.calendar className="text-white/20" size={28} />
                </div>
                <p className="text-white/50 mb-2">Geen aankomende events</p>
                <Link href="/dashboard/agenda" className="text-sm text-workx-lime hover:underline">
                  Event toevoegen
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event, index) => (
                  <Link
                    key={event.id}
                    href="/dashboard/agenda"
                    className="card p-4 flex items-center gap-4 group hover:border-white/10 transition-all"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate group-hover:text-workx-lime transition-colors">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-white/40">
                        <span className="flex items-center gap-1">
                          <Icons.calendar size={12} />
                          {formatDate(event.startTime)}
                        </span>
                        {!event.isAllDay && (
                          <span className="flex items-center gap-1">
                            <Icons.clock size={12} />
                            {formatTime(event.startTime)}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1 truncate">
                            <Icons.mapPin size={12} />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icons.chevronRight className="text-white/20 group-hover:text-workx-lime transition-colors" size={18} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lustrum Teaser Widget */}
        <LustrumTeaserWidget />
      </div>

      {/* Feedback (Admin) or Vacation & Birthday Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin: Feedback Widget / Others: Vacation Card */}
        {isAdmin ? (
          /* Feedback Widget for Admin */
          <div className="card p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Icons.chat className="text-purple-400" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Feedback</p>
                    <p className="text-xs text-white/40">{feedbackItems.length} items</p>
                  </div>
                </div>
                <Link href="/dashboard/feedback" className="text-xs text-purple-400 hover:underline">
                  Alles bekijken
                </Link>
              </div>

              {feedbackItems.length === 0 ? (
                <div className="text-center py-6">
                  <Icons.check className="text-green-400 mx-auto mb-2" size={24} />
                  <p className="text-sm text-white/50">Geen feedback</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {feedbackItems.slice(0, 5).map((item) => {
                    const config = feedbackTypeConfig[item.type] || feedbackTypeConfig.OTHER
                    const TypeIcon = config.icon
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <TypeIcon className={config.color} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{item.title}</p>
                          <p className="text-xs text-white/40">
                            {item.submittedBy} · {new Date(item.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteFeedback(item.id)}
                          className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Verwijderen"
                        >
                          <Icons.x size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Vacation Card for Employees */
          <div className="card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

            <button
              onClick={() => setShowVacationDetails(!showVacationDetails)}
              className="w-full text-left relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                    <Icons.sun className="text-workx-lime" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {PARENTAL_LEAVE.hasParentalLeave ? 'Mijn Vakantiedagen en Ouderschapsverlof' : 'Mijn vakantiedagen'}
                    </p>
                    <p className="text-xs text-white/40">Saldo {VACATION_BALANCE.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-workx-lime">
                      {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar - VACATION_BALANCE.opgenomenDitJaar - VACATION_BALANCE.geplandDitJaar}
                    </p>
                    <p className="text-xs text-white/40">vakantiedagen over</p>
                  </div>
                  <Icons.chevronDown
                    size={18}
                    className={`text-white/30 transition-transform ${showVacationDetails ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-orange-400"
                  style={{ width: `${(VACATION_BALANCE.opgenomenDitJaar / (VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar)) * 100}%` }}
                />
                <div
                  className="h-full bg-blue-400"
                  style={{ width: `${(VACATION_BALANCE.geplandDitJaar / (VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar)) * 100}%` }}
                />
              </div>
            </button>

            {/* Expandable details */}
            {showVacationDetails && (
              <div className="mt-4 pt-4 border-t border-white/5 space-y-4 fade-in">
                {/* Vakantiedagen */}
                <div>
                  <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">Vakantiedagen</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-lg font-semibold text-workx-lime">
                        {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar}
                      </p>
                      <p className="text-[10px] text-white/40">Totaal</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-lg font-semibold text-orange-400">{VACATION_BALANCE.opgenomenDitJaar}</p>
                      <p className="text-[10px] text-white/40">Opgenomen</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-lg font-semibold text-blue-400">{VACATION_BALANCE.geplandDitJaar}</p>
                      <p className="text-[10px] text-white/40">Gepland</p>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5 mt-3">
                    <div className="flex justify-between text-white/50">
                      <span>Wettelijk</span>
                      <span className="text-white">{VACATION_BALANCE.wettelijkeDagen}d</span>
                    </div>
                    <div className="flex justify-between text-white/50">
                      <span>Bovenwettelijk</span>
                      <span className="text-white">{VACATION_BALANCE.bovenwettelijkeDagen}d</span>
                    </div>
                    <div className="flex justify-between text-white/50">
                      <span>Overgedragen</span>
                      <span className="text-white">{VACATION_BALANCE.overgedragenVorigJaar}d</span>
                    </div>
                  </div>
                </div>

                {/* Ouderschapsverlof */}
                {PARENTAL_LEAVE.hasParentalLeave && (
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Ouderschapsverlof</p>
                      <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                        {PARENTAL_LEAVE.kindNaam}
                      </span>
                    </div>

                    {/* Betaald verlof */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-green-400 font-medium">Betaald (70% UWV)</span>
                        <span className="text-xs text-white/40">
                          {PARENTAL_LEAVE.betaaldOpgenomenWeken} / {PARENTAL_LEAVE.betaaldTotaalWeken} weken
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full"
                          style={{ width: `${(PARENTAL_LEAVE.betaaldOpgenomenWeken / PARENTAL_LEAVE.betaaldTotaalWeken) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-green-400 mt-1 font-medium">
                        {PARENTAL_LEAVE.betaaldTotaalWeken - PARENTAL_LEAVE.betaaldOpgenomenWeken} weken resterend
                      </p>
                    </div>

                    {/* Onbetaald verlof */}
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-purple-400 font-medium">Onbetaald</span>
                        <span className="text-xs text-white/40">
                          {PARENTAL_LEAVE.onbetaaldOpgenomenWeken} / {PARENTAL_LEAVE.onbetaaldTotaalWeken} weken
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${(PARENTAL_LEAVE.onbetaaldOpgenomenWeken / PARENTAL_LEAVE.onbetaaldTotaalWeken) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-purple-400 mt-1 font-medium">
                        {PARENTAL_LEAVE.onbetaaldTotaalWeken - PARENTAL_LEAVE.onbetaaldOpgenomenWeken} weken resterend
                      </p>
                    </div>

                    {/* Inzet planning */}
                    <div className="mt-3 text-xs space-y-1">
                      <div className="flex justify-between text-white/50">
                        <span>Inzet per week</span>
                        <span className="text-white">{PARENTAL_LEAVE.inzetPerWeek} uur</span>
                      </div>
                      <div className="flex justify-between text-white/50">
                        <span>Te gebruiken tot</span>
                        <span className="text-white">
                          {new Date(PARENTAL_LEAVE.eindDatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-white/30 pt-2 border-t border-white/5">
                  Bijgewerkt door {VACATION_BALANCE.lastUpdatedBy} op {new Date(VACATION_BALANCE.lastUpdated).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Birthday Card - GROOTS on birthday, normal otherwise */}
        <Link
          href="/dashboard/agenda"
          className={`card p-4 relative overflow-hidden group transition-all ${
            birthdayToday
              ? 'ring-4 ring-pink-500/50 bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-yellow-500/20 animate-pulse'
              : 'hover:border-pink-500/30'
          }`}
        >
          {/* Glowing orbs */}
          <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-all duration-700 ${
            birthdayToday ? 'bg-pink-500/30 scale-150' : 'bg-pink-500/5 group-hover:bg-pink-500/20 group-hover:scale-150'
          }`} />
          <div className={`absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 transition-all duration-700 ${
            birthdayToday ? 'bg-purple-500/30 scale-125' : 'bg-purple-500/5 group-hover:bg-purple-500/15 group-hover:scale-125'
          }`} />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform ${
                  birthdayToday ? 'bg-gradient-to-br from-pink-500/40 to-purple-500/30 scale-125 animate-bounce' : 'bg-gradient-to-br from-pink-500/20 to-purple-500/10 group-hover:scale-110'
                }`}>
                  <span className={`${birthdayToday ? 'text-3xl' : 'text-xl group-hover:animate-bounce'}`}>🎂</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Verjaardagen</p>
                  <p className="text-xs text-white/40">
                    {birthdayToday ? '🎉 VANDAAG JARIG!' : 'Binnenkort jarig'}
                  </p>
                </div>
              </div>
              <Icons.arrowRight size={16} className="text-white/20 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
            </div>

            {/* Featured birthday - First person */}
            {nextBirthday[0] && (
              <div className={`mb-3 p-3 -mx-1 rounded-xl border transition-all ${
                birthdayToday
                  ? 'bg-gradient-to-r from-pink-500/30 via-purple-500/20 to-yellow-500/20 border-pink-500/50'
                  : 'bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-pink-500/5 border-pink-500/20 group-hover:border-pink-500/40 group-hover:from-pink-500/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl flex items-center justify-center shadow-lg ${
                    birthdayToday ? 'w-16 h-16 text-4xl shadow-pink-500/30 animate-bounce' : 'w-12 h-12 text-2xl shadow-pink-500/10'
                  } bg-gradient-to-br from-pink-500/30 to-purple-500/20`}>
                    🎉
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-white ${birthdayToday ? 'text-lg' : ''}`}>{nextBirthday[0].name}</span>
                      {nextBirthday[0].daysUntil === 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-500 text-white animate-pulse shadow-lg shadow-pink-500/50">
                          🥳 VANDAAG JARIG!
                        </span>
                      )}
                      {nextBirthday[0].daysUntil === 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                          MORGEN
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-pink-400">
                        {nextBirthday[0].date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  </div>
                  {!birthdayToday && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-pink-400">{nextBirthday[0].daysUntil}</p>
                      <p className="text-[10px] text-white/40">{nextBirthday[0].daysUntil === 1 ? 'dag' : 'dagen'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other upcoming birthdays */}
            <div className="space-y-2">
              {nextBirthday.slice(1).map((person) => (
                <div
                  key={person.name}
                  className="flex items-center justify-between py-1.5 px-2 -mx-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center text-sm">
                      🎂
                    </div>
                    <div>
                      <span className="text-sm text-white/70">{person.name.split(' ')[0]}</span>
                      <span className="text-xs text-white/30 ml-2">
                        {person.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-white/40">
                    {person.daysUntil}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom section with Team and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Team Photos - Left side */}
        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.users className="text-workx-lime" size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Team</p>
                <p className="text-xs text-white/40">{ADVOCATEN.length} advocaten</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ADVOCATEN.map((name) => {
                const photoUrl = TEAM_PHOTOS[name]
                return (
                  <div key={name} className="relative group/avatar" title={name}>
                    <img
                      src={photoUrl}
                      alt={name}
                      className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10 hover:ring-workx-lime/50 transition-all hover:scale-110"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stats - Right side */}
        {[
          { icon: Icons.briefcase, label: 'Open zaken', value: workItems.length.toString(), color: 'text-blue-400', bg: 'bg-blue-500/10', iconAnim: 'icon-briefcase-hover' },
          { icon: Icons.calendar, label: 'Events deze week', value: events.length.toString(), color: 'text-purple-400', bg: 'bg-purple-500/10', iconAnim: 'icon-calendar-hover' },
          { icon: Icons.clock, label: 'Vandaag', value: new Date().toLocaleDateString('nl-NL', { weekday: 'short' }), color: 'text-orange-400', bg: 'bg-orange-500/10', iconAnim: 'icon-clock-hover' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`card p-5 group hover:border-white/10 transition-all relative overflow-hidden ${stat.iconAnim}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform icon-animated`}>
                <stat.icon className={stat.color} size={18} />
              </div>
            </div>
            <p className="relative text-2xl font-semibold text-white mb-1 group-hover:text-workx-lime transition-colors">{stat.value}</p>
            <p className="relative text-sm text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
