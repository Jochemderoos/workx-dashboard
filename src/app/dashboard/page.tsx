'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { TEAM_PHOTOS, ALL_TEAM_MEMBERS, getPhotoUrl } from '@/lib/team-photos'
import { LUSTRUM_CONFIG, MALLORCA_FACTS, getCountdown } from '@/lib/lustrum-data'
import { formatDateForAPI, parseDateFromAPI } from '@/lib/date-utils'
import toast from 'react-hot-toast'
import SpotlightCard from '@/components/ui/SpotlightCard'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import ScrollReveal, { ScrollRevealItem } from '@/components/ui/ScrollReveal'
import MagneticButton from '@/components/ui/MagneticButton'
import Sparkline from '@/components/ui/Sparkline'
import TextReveal from '@/components/ui/TextReveal'
// import { BeamConnector } from '@/components/ui/AnimatedBeam'

// Logo Component - uses actual Workx logo
function WorkxLogoSmall() {
  return (
    <img src="/workx-logo.png" alt="Workx Advocaten" className="h-14 w-auto" draggable={false} />
  )
}

// Skeleton block helper
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-wave rounded-lg ${className}`} />
}

// Full dashboard skeleton shown during initial load
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in">
      {/* Hero skeleton */}
      <div className="rounded-2xl bg-gradient-to-br from-workx-gray to-workx-dark border border-white/10 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Skeleton className="hidden md:block w-14 h-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72 hidden sm:block" />
            </div>
          </div>
          <div className="hidden lg:flex items-start gap-8">
            <Skeleton className="w-[120px] h-[120px] rounded-xl" />
            <div className="text-right space-y-2">
              <Skeleton className="h-12 w-32 ml-auto" />
              <Skeleton className="h-4 w-48 ml-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick links + Appjeplekje skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <Skeleton className="w-10 h-10 rounded-lg mb-3" />
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-2">
          <div className="mb-4"><Skeleton className="h-5 w-20" /></div>
          <div className="rounded-2xl border-2 border-white/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex gap-2 mt-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="w-8 h-8 rounded-full" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Absence overview skeleton */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </div>
          {/* Events skeleton */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="space-y-1.5">
              {[1,2,3].map(i => (
                <div key={i} className="card p-3 flex items-center gap-3">
                  <Skeleton className="w-1 h-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Lustrum skeleton */}
        <Skeleton className="h-64 rounded-2xl" />
      </div>

      {/* Bottom cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
          </div>
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Team verjaardagen - wordt geladen uit database via /api/birthdays
interface TeamBirthday {
  name: string
  birthDate: string // MM-DD format
  avatarUrl?: string | null
}

// Team photos en advocaten lijst komen nu uit @/lib/team-photos

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  isAllDay: boolean
  location: string | null
  color: string
  category?: string
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

// Newsletter assignment interface
interface NewsletterAssignment {
  id: string
  assigneeId: string
  deadline: string
  topic: string | null
  status: 'PENDING' | 'SUBMITTED'
  reminderPushedAt: string | null
  reminderDismissed: boolean
  assignee: { id: string; name: string; avatarUrl?: string | null }
  createdBy: { id: string; name: string }
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

// Vakantiedagen en ouderschapsverlof worden dynamisch geladen
interface VacationBalanceData {
  userName: string
  year: number
  overgedragenVorigJaar: number
  opbouwLopendJaar: number
  bijgekocht: number
  opgenomenLopendJaar: number
  totaalDagen: number
  resterend: number
  lastUpdatedBy: string
  lastUpdated: string
  isPartner: boolean
  hasBalance: boolean
}

interface ParentalLeaveData {
  id: string
  userId: string
  betaaldTotaalWeken: number
  betaaldOpgenomenWeken: number
  onbetaaldTotaalWeken: number
  onbetaaldOpgenomenWeken: number
  kindNaam: string | null
  kindGeboorteDatum: string | null
  startDatum: string | null
  eindDatum: string | null
  inzetPerWeek: number | null
  note: string | null
}

const allQuickLinks = [
  { href: '/dashboard/agenda', Icon: Icons.calendar, label: 'Agenda', desc: 'Events & verjaardagen', color: 'from-blue-500/20 to-blue-600/10', iconAnim: 'icon-calendar-hover', hideFor: [] as string[] },
  { href: '/dashboard/bonus', Icon: Icons.euro, label: 'Bonus', desc: 'Berekeningen', color: 'from-green-500/20 to-green-600/10', iconAnim: 'icon-euro-hover', hideFor: ['PARTNER', 'OFFICE_MANAGER'] },
  { href: '/dashboard/werk', Icon: Icons.briefcase, label: 'Werk', desc: 'Taken beheren', color: 'from-red-500/20 to-red-600/10', iconAnim: 'icon-briefcase-hover', hideFor: ['MEDEWERKER', 'ADVOCAAT'] },
  { href: '/dashboard/lustrum', Icon: Icons.star, label: 'Lustrum', desc: '15 jaar Workx!', color: 'from-orange-500/20 to-amber-600/10', iconAnim: 'icon-star-hover', hideFor: [] as string[] },
]

// Appjeplekje Widget - Compact office attendance widget with today/tomorrow tabs
function AppjeplekjeWidget({
  todayData,
  tomorrowData,
  isTogglingToday,
  isTogglingTomorrow,
  onToggleToday,
  onToggleTomorrow,
}: {
  todayData: OfficeAttendanceData | null
  tomorrowData: OfficeAttendanceData | null
  isTogglingToday: boolean
  isTogglingTomorrow: boolean
  onToggleToday: () => void
  onToggleTomorrow: () => void
}) {
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow'>('today')
  const [dateLabels, setDateLabels] = useState({ today: '', tomorrow: '' })

  useEffect(() => {
    const now = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDateLabels({
      today: `${now.getDate()} ${now.toLocaleDateString('nl-NL', { month: 'short' })}`,
      tomorrow: `${tomorrow.getDate()} ${tomorrow.toLocaleDateString('nl-NL', { month: 'short' })}`
    })
  }, [])

  const data = selectedDay === 'today' ? todayData : tomorrowData
  const isToggling = selectedDay === 'today' ? isTogglingToday : isTogglingTomorrow
  const onToggle = selectedDay === 'today' ? onToggleToday : onToggleTomorrow

  if (!data) {
    return (
      <Link
        href="/dashboard/appjeplekje"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 border-2 border-cyan-500/30 p-4 block"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <img
              src="/workx-pand.png"
              alt="Kantoor"
              className="h-7 w-auto opacity-60"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Appjeplekje</p>
            <p className="text-xs text-cyan-300">Laden...</p>
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
      className={`relative overflow-hidden rounded-2xl p-4 group transition-all block shadow-lg ${
        data.isCurrentUserAttending
          ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-cyan-500/10 border-2 border-emerald-400/50 hover:border-emerald-400/60 shadow-emerald-500/15 hover:shadow-emerald-500/25'
          : 'bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 border-2 border-cyan-500/30 hover:border-cyan-400/50 shadow-cyan-500/10 hover:shadow-cyan-500/20'
      }`}
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-400/30 transition-colors" />
      <div className="absolute -bottom-4 -left-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <img src="/workx-pand.png" alt="" className="h-16 w-auto" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <img
                src="/workx-pand.png"
                alt="Kantoor"
                className="h-7 w-auto opacity-80"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Appjeplekje</p>
              <p className="text-xs text-cyan-300 font-medium">
                {selectedDay === 'today' ? 'Vandaag' : 'Morgen'} · {selectedDay === 'today' ? dateLabels.today : dateLabels.tomorrow}
              </p>
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
                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
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

        {/* Day selector tabs */}
        <div className="flex gap-1 mb-3 p-1 bg-white/5 rounded-lg">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDay('today') }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedDay === 'today'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Vandaag
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDay('tomorrow') }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedDay === 'tomorrow'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Morgen
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
          <span className="text-xs text-gray-400 font-medium">
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
                    className="w-7 h-7 rounded-full bg-white/10 border-2 border-cyan-900 flex items-center justify-center text-xs text-gray-400 overflow-hidden"
                    title={a.name}
                  >
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={a.name}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      a.name.charAt(0)
                    )}
                  </div>
                )
              })}
              {data.attendees.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/30 border-2 border-cyan-900 flex items-center justify-center text-xs text-cyan-300 font-bold">
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
        <div className="w-full">
          <p className="text-sm text-gray-400 mb-2">Nog <span className="text-orange-400 font-semibold">{countdown.days}</span> dagen tot Mallorca!</p>
          <div className="flex gap-2">
            {[
              { value: countdown.days, label: 'd' },
              { value: countdown.hours, label: 'u' },
              { value: countdown.minutes, label: 'm' },
              { value: countdown.seconds, label: 's' },
            ].map((item) => (
              <div key={item.label} className="text-center bg-orange-500/10 rounded-lg px-2 py-1.5 flex-1">
                <span className="text-xl font-bold text-orange-400 tabular-nums block">
                  {String(item.value).padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">30 sep - 4 okt 2026</p>
        </div>
      ),
    },
    // Daily fact
    {
      content: (
        <div>
          <p className="text-xs text-amber-400 mb-2 flex items-center gap-2">
            <span className="text-lg">💡</span> Weetje van de dag
          </p>
          <p className="text-base text-gray-200 line-clamp-2">{dailyFact}</p>
        </div>
      ),
    },
    // Weather teaser
    {
      content: (
        <div className="flex items-center gap-5">
          <span className="text-5xl">☀️</span>
          <div>
            <p className="text-base font-medium text-white">Perfect weer in oktober</p>
            <p className="text-sm text-gray-400">Gemiddeld 22°C in Mallorca</p>
          </div>
        </div>
      ),
    },
    // Location teaser
    {
      content: (
        <div className="flex items-center gap-5">
          <span className="text-5xl">🏠</span>
          <div>
            <p className="text-base font-medium text-white">Can Fressa, Alaró</p>
            <p className="text-sm text-gray-400">Finca bij de Serra de Tramuntana</p>
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
          <h2 className="text-lg font-medium text-white whitespace-nowrap">15 Jaar Workx</h2>
        </div>
        <Link href="/dashboard/lustrum" className="text-sm text-orange-400 hover:underline flex items-center gap-1">
          Bekijk alles
          <Icons.arrowRight size={14} />
        </Link>
      </div>

      <Link
        href="/dashboard/lustrum"
        className="card p-5 block group hover:border-orange-500/30 transition-all relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/20 transition-colors" />
        <div className="absolute -bottom-4 -left-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity">
          🎉
        </div>

        <div className="relative">
          {/* Rotating content */}
          <div className="min-h-[80px] flex items-center">
            {teasers[teaserIndex].content}
          </div>

          {/* Dots indicator */}
          <div className="flex gap-1.5 mt-4">
            {teasers.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault()
                  setTeaserIndex(i)
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === teaserIndex ? 'bg-orange-400 w-4' : 'bg-white/20 w-1.5'
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
  const [tomorrowAttendance, setTomorrowAttendance] = useState<OfficeAttendanceData | null>(null)
  const [isTogglingAttendance, setIsTogglingAttendance] = useState(false)
  const [isTogglingTomorrowAttendance, setIsTogglingTomorrowAttendance] = useState(false)
  const [vacationBalance, setVacationBalance] = useState<VacationBalanceData | null>(null)
  const [parentalLeave, setParentalLeave] = useState<ParentalLeaveData | null>(null)
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    windSpeed: 0,
    humidity: 0,
    location: 'Amsterdam',
    isLoading: true,
  })
  const [teamBirthdays, setTeamBirthdays] = useState<TeamBirthday[]>([])
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)
  const [birthdayAudioRef, setBirthdayAudioRef] = useState<HTMLAudioElement | null>(null)
  const [newsletterReminders, setNewsletterReminders] = useState<NewsletterAssignment[]>([])
  const [newsletterOverview, setNewsletterOverview] = useState<NewsletterAssignment[] | null>(null)
  const [isNewsletterManager, setIsNewsletterManager] = useState(false)
  // Fetch dashboard data from bundled API endpoint (combines 8 API calls into 1)
  const fetchDashboardSummary = async () => {
    try {
      const res = await fetch('/api/dashboard/summary')
      if (res.ok) {
        const data = await res.json()

        // Set calendar events
        if (data.calendarEvents) {
          setEvents(data.calendarEvents)
        }

        // Set office attendance (today)
        if (data.officeAttendance) {
          setOfficeAttendance(data.officeAttendance)
        }

        // Set tomorrow attendance
        if (data.tomorrowAttendance) {
          setTomorrowAttendance(data.tomorrowAttendance)
        }

        // Set vacation balance
        if (data.vacationBalance) {
          setVacationBalance(data.vacationBalance)
        }

        // Set parental leave
        if (data.parentalLeave && data.parentalLeave.length > 0) {
          setParentalLeave(data.parentalLeave[0])
        }

        // Set current user
        if (data.currentUser) {
          setCurrentUser({ name: data.currentUser.name, role: data.currentUser.role })
        }

        // Set birthdays
        if (data.birthdays) {
          const formattedBirthdays = data.birthdays
            .filter((u: any) => u.birthDate)
            .map((u: any) => {
              // birthDate is stored as MM-DD string directly
              return {
                name: u.name,
                birthDate: u.birthDate, // Already in MM-DD format
                avatarUrl: u.avatarUrl
              }
            })
          setTeamBirthdays(formattedBirthdays)
        }

        // Set feedback
        if (data.feedback) {
          setFeedbackItems(data.feedback.map((f: any) => ({
            id: f.id,
            type: f.type,
            title: f.title,
            description: f.description,
            submittedBy: f.submittedByName,
            createdAt: f.createdAt,
          })))
        }

        // Set newsletter data
        if (data.newsletterReminders) {
          setNewsletterReminders(data.newsletterReminders)
        }
        if (data.newsletterOverview !== undefined) {
          setNewsletterOverview(data.newsletterOverview)
        }
        if (data.isNewsletterManager !== undefined) {
          setIsNewsletterManager(data.isNewsletterManager)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard summary:', error)
    }
  }

  // Calculate next birthday
  const nextBirthday = useMemo(() => {
    if (teamBirthdays.length === 0) return []

    // Use midnight today for fair date comparison (avoids time-of-day issues)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const currentYear = today.getFullYear()

    const upcomingBirthdays = teamBirthdays.map(member => {
      const [month, day] = member.birthDate.split('-').map(Number)
      let birthdayThisYear = new Date(currentYear, month - 1, day)

      const isToday = birthdayThisYear.getTime() === today.getTime()

      if (birthdayThisYear < today) {
        birthdayThisYear = new Date(currentYear + 1, month - 1, day)
      }

      const daysUntil = isToday ? 0 : Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { ...member, date: isToday ? new Date(currentYear, month - 1, day) : birthdayThisYear, daysUntil, isToday }
    }).sort((a, b) => a.daysUntil - b.daysUntil)

    return upcomingBirthdays.slice(0, 3) // Return top 3
  }, [teamBirthdays])

  // Check if someone has birthday TODAY
  const birthdayToday = useMemo(() => {
    return nextBirthday.find(b => b.daysUntil === 0)
  }, [nextBirthday])

  // Auto-stop confetti after 10 seconds
  const [showConfetti, setShowConfetti] = useState(true)
  useEffect(() => {
    if (birthdayToday) {
      const timer = setTimeout(() => setShowConfetti(false), 10000)
      return () => clearTimeout(timer)
    }
  }, [birthdayToday])

  // Filter quick links based on user role
  const quickLinks = useMemo(() => {
    const userRole = currentUser?.role || 'MEDEWERKER'
    return allQuickLinks.filter(link => !link.hideFor.includes(userRole))
  }, [currentUser?.role])

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
    // Normalize date to YYYY-MM-DD string for comparison (using local date formatting to avoid timezone issues)
    const checkDateStr = formatDateForAPI(date)

    // Get vacation absences
    const vacationAbsences = vacations.filter(v => {
      const startStr = formatDateForAPI(parseDateFromAPI(v.startDate) || new Date(v.startDate))
      const endStr = formatDateForAPI(parseDateFromAPI(v.endDate) || new Date(v.endDate))
      return startStr <= checkDateStr && endStr >= checkDateStr
    })

    // Get calendar absences (part-time days, etc.)
    const calAbsences = calendarAbsences.filter(a => {
      const startStr = formatDateForAPI(parseDateFromAPI(a.startDate) || new Date(a.startDate))
      const endStr = formatDateForAPI(parseDateFromAPI(a.endDate) || new Date(a.endDate))
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

    // Altijd Amsterdam gebruiken (geen locatie-tracking meer)
    fetchWeather(52.3676, 4.9041, 'Amsterdam')
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
      const today = formatDateForAPI(new Date())
      const storageKey = `lustrum-milestone-${days}-${today}`
      const alreadyShown = localStorage.getItem(storageKey)

      if (!alreadyShown) {
        setShowCountdownPopup(true)
        localStorage.setItem(storageKey, 'true')
      }
    }
  }, [])

  // Main data fetch: 1 bundled API call + 3 specialized calls (was 11 separate calls)
  useEffect(() => {
    Promise.all([
      fetchDashboardSummary(),  // Bundled: events, attendance, balance, parental, user, birthdays, feedback
      fetchWork(),              // Separate: needs specific query params
      fetchVacations(),         // Separate: needs all=true
      fetchCalendarAbsences(),  // Separate: needs date range filter
    ]).finally(() => setIsLoading(false))
  }, [])

  // fetchEvents removed - now handled by fetchDashboardSummary

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

      const res = await fetch(`/api/calendar?startDate=${formatDateForAPI(startOfWeek)}&endDate=${formatDateForAPI(endOfNextWeek)}`)
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

  // fetchFeedback and fetchCurrentUser removed - now handled by fetchDashboardSummary

  // Helper to format date string
  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const fetchOfficeAttendance = async () => {
    try {
      const now = new Date()
      const today = formatDateStr(now)
      const res = await fetch(`/api/office-attendance?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        setOfficeAttendance(data)
      } else {
        console.error('Error fetching office attendance:', res.status, res.statusText)
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
      const now = new Date()
      const today = formatDateStr(now)
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

  const fetchTomorrowAttendance = async () => {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = formatDateStr(tomorrow)
      const res = await fetch(`/api/office-attendance?date=${tomorrowStr}`)
      if (res.ok) {
        const data = await res.json()
        setTomorrowAttendance(data)
      } else {
        setTomorrowAttendance({
          date: tomorrowStr,
          attendees: [],
          totalWorkplaces: 11,
          occupiedWorkplaces: 0,
          availableWorkplaces: 11,
          isCurrentUserAttending: false,
        })
      }
    } catch (e) {
      console.error('Error fetching tomorrow attendance:', e)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setTomorrowAttendance({
        date: formatDateStr(tomorrow),
        attendees: [],
        totalWorkplaces: 11,
        occupiedWorkplaces: 0,
        availableWorkplaces: 11,
        isCurrentUserAttending: false,
      })
    }
  }

  // fetchVacationBalance and fetchParentalLeave removed - now handled by fetchDashboardSummary

  const toggleOfficeAttendance = async () => {
    if (!officeAttendance || isTogglingAttendance) return
    setIsTogglingAttendance(true)

    try {
      const now = new Date()
      const today = formatDateStr(now)
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
        toast.error(errorData.error || 'Er ging iets mis')
        return
      }

      await fetchOfficeAttendance()
    } catch (e) {
      console.error('Error toggling attendance:', e)
      toast.error('Er ging iets mis met de verbinding')
    } finally {
      setIsTogglingAttendance(false)
    }
  }

  const toggleTomorrowAttendance = async () => {
    if (!tomorrowAttendance || isTogglingTomorrowAttendance) return
    setIsTogglingTomorrowAttendance(true)

    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = formatDateStr(tomorrow)
      let res: Response

      if (tomorrowAttendance.isCurrentUserAttending) {
        res = await fetch(`/api/office-attendance?date=${tomorrowStr}`, { method: 'DELETE' })
      } else {
        res = await fetch('/api/office-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: tomorrowStr }),
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        toast.error(errorData.error || 'Er ging iets mis')
        return
      }

      await fetchTomorrowAttendance()
    } catch (e) {
      console.error('Error toggling tomorrow attendance:', e)
      toast.error('Er ging iets mis met de verbinding')
    } finally {
      setIsTogglingTomorrowAttendance(false)
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

  // Newsletter helper functions
  const dismissNewsletterReminder = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/newsletter-assignments/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      if (res.ok) {
        setNewsletterReminders(prev => prev.filter(r => r.id !== assignmentId))
      }
    } catch (e) {
      console.error('Error dismissing reminder:', e)
    }
  }

  const markArticleSubmitted = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/newsletter-assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId, status: 'SUBMITTED' }),
      })
      if (res.ok) {
        // Remove from reminders
        setNewsletterReminders(prev => prev.filter(r => r.id !== assignmentId))
        // Update overview if present
        if (newsletterOverview) {
          setNewsletterOverview(prev => prev ? prev.map(a =>
            a.id === assignmentId ? { ...a, status: 'SUBMITTED' } : a
          ) : null)
        }
      }
    } catch (e) {
      console.error('Error updating article status:', e)
    }
  }

  const pushNewsletterReminder = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/newsletter-assignments/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      if (res.ok) {
        // Update overview
        if (newsletterOverview) {
          setNewsletterOverview(prev => prev ? prev.map(a =>
            a.id === assignmentId ? { ...a, reminderPushedAt: new Date().toISOString(), reminderDismissed: false } : a
          ) : null)
        }
      }
    } catch (e) {
      console.error('Error pushing reminder:', e)
    }
  }

  // Calculate urgency level for newsletter deadline
  const getDeadlineUrgency = (deadline: string): 'normal' | 'warning' | 'urgent' => {
    const now = new Date()
    const dl = new Date(deadline)
    const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 7) return 'urgent'
    if (daysLeft <= 14) return 'warning'
    return 'normal'
  }

  // Filter PENDING assignments for the overview widget
  const pendingOverviewArticles = newsletterOverview?.filter(a => a.status === 'PENDING') || []

  // Show skeleton during initial load
  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-8 stagger">
      {/* LUSTRUM COUNTDOWN MILESTONE POPUP */}
      {showCountdownPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] overflow-y-auto" onClick={() => setShowCountdownPopup(false)}>
          <div className="min-h-full flex items-start justify-center p-4" style={{ paddingTop: '15vh' }}>
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
            <div className="relative max-w-lg w-full bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border-2 border-orange-500/40 rounded-3xl p-8 shadow-2xl text-center transform animate-pulse animate-modal-in" onClick={(e) => e.stopPropagation()}>
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
              <p className="text-2xl text-gray-200">
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

            <p className="text-gray-400 mb-6">
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
        </div>
      )}

      {/* BIRTHDAY CELEBRATION - Full screen confetti when someone has birthday TODAY */}
      {birthdayToday && showConfetti && (
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-workx-gray to-workx-dark border border-white/10 p-4 sm:p-6 lg:p-8 card-glow-border noise-overlay-strong">
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
              <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                <TextReveal stagger={0.04} duration={0.35} delay={0.1}>Welkom bij Workx</TextReveal>
              </h1>
              <p className="text-gray-400 max-w-md hidden sm:block">
                Beheer je zaken, bereken bonussen en houd je team op de hoogte. Alles in één dashboard.
              </p>
            </div>
          </div>

          {/* Mobile Appjeplekje Widget - Only visible on mobile */}
          <div className="lg:hidden">
            <AppjeplekjeWidget
              todayData={officeAttendance}
              tomorrowData={tomorrowAttendance}
              isTogglingToday={isTogglingAttendance}
              isTogglingTomorrow={isTogglingTomorrowAttendance}
              onToggleToday={toggleOfficeAttendance}
              onToggleTomorrow={toggleTomorrowAttendance}
            />
          </div>

          <div className="hidden lg:flex items-start gap-8">
            {/* Weather Widget */}
            <div className="text-center liquid-glass-sm p-4 min-w-[120px]">
              {weather.isLoading ? (
                <div className="animate-pulse">
                  <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2" />
                  <div className="h-4 bg-white/10 rounded w-16 mx-auto" />
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-1">{weatherInfo.icon}</div>
                  <div className="text-2xl font-semibold text-white">
                    <AnimatedNumber value={weather.temperature} suffix="°" stiffness={50} damping={20} />
                  </div>
                  <p className="text-xs text-gray-400">{weatherInfo.desc}</p>
                  <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <Icons.wind size={10} />
                      {weather.windSpeed} km/h
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Icons.droplet size={10} />
                      {weather.humidity}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{weather.location}</p>
                </>
              )}
            </div>

            {/* Time */}
            <div className="text-right">
              <div className="text-5xl font-light text-white tabular-nums">
                {currentTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-gray-400 mt-1">
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
      <ScrollReveal direction="up" distance={40} duration={0.5} staggerChildren={0.08} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Quick Links - Takes 3 columns on desktop */}
        <ScrollRevealItem className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Snelle toegang</h2>
            <span className="text-xs text-gray-500">{quickLinks.length} tools</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map(({ href, Icon, label, desc, color, iconAnim }) => (
            <SpotlightCard
              key={href}
              as={Link}
              href={href}
              className={`group overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-workx-lime/30 hover:bg-white/[0.05] transition-all duration-300 ${iconAnim}`}
              maxTilt={8}
              spotlightSize={300}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-workx-lime group-hover:bg-workx-lime/10 transition-all mb-3 icon-animated">
                  <Icon size={20} />
                </div>
                <h3 className="font-medium text-white text-sm mb-0.5">{label}</h3>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icons.arrowRight size={14} className="text-workx-lime" />
              </div>
            </SpotlightCard>
          ))}
          </div>
        </ScrollRevealItem>

        {/* Desktop Appjeplekje Widget - Only visible on desktop, now 2 columns wide */}
        <ScrollRevealItem className="hidden lg:block lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Kantoor</h2>
          </div>
          <AppjeplekjeWidget
            todayData={officeAttendance}
            tomorrowData={tomorrowAttendance}
            isTogglingToday={isTogglingAttendance}
            isTogglingTomorrow={isTogglingTomorrowAttendance}
            onToggleToday={toggleOfficeAttendance}
            onToggleTomorrow={toggleTomorrowAttendance}
          />
        </ScrollRevealItem>
      </ScrollReveal>

      {/* NEWSLETTER WIDGETS */}
      {/* Employee reminder widget - shown when user has PENDING assignments */}
      {newsletterReminders.length > 0 && (
        <div className="space-y-3">
          {newsletterReminders.map((assignment) => {
            const urgency = getDeadlineUrgency(assignment.deadline)
            const daysLeft = Math.ceil((new Date(assignment.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            const isOverdue = daysLeft < 0

            return (
              <div
                key={assignment.id}
                className={`relative overflow-hidden rounded-2xl p-5 transition-all ${
                  urgency === 'urgent' || isOverdue
                    ? 'bg-gradient-to-br from-red-500/20 via-red-500/10 to-orange-500/10 border-2 border-red-500/50 shadow-lg shadow-red-500/20 animate-pulse-slow'
                    : urgency === 'warning'
                    ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-yellow-500/10 border-2 border-amber-500/40 shadow-lg shadow-amber-500/15'
                    : 'bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-indigo-500/10 border border-blue-500/30'
                }`}
              >
                {/* Animated glow for urgent items */}
                {(urgency === 'urgent' || isOverdue) && (
                  <>
                    <div className="absolute top-0 left-0 w-40 h-40 bg-red-500/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/15 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
                  </>
                )}
                {urgency === 'warning' && (
                  <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                )}

                <div className="relative flex items-start gap-4">
                  {/* Icon with urgency indicator */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    urgency === 'urgent' || isOverdue
                      ? 'bg-red-500/20 ring-2 ring-red-500/40'
                      : urgency === 'warning'
                      ? 'bg-amber-500/20 ring-2 ring-amber-500/30'
                      : 'bg-blue-500/15'
                  }`}>
                    <Icons.fileText size={22} className={
                      urgency === 'urgent' || isOverdue ? 'text-red-400' : urgency === 'warning' ? 'text-amber-400' : 'text-blue-400'
                    } />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${
                        urgency === 'urgent' || isOverdue ? 'text-red-300' : urgency === 'warning' ? 'text-amber-300' : 'text-white'
                      }`}>
                        Nieuwsbrief artikel
                      </h3>
                      {(urgency === 'urgent' || isOverdue) && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 animate-pulse">
                          {isOverdue ? 'VERLOPEN' : 'DRINGEND'}
                        </span>
                      )}
                      {urgency === 'warning' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300">
                          Binnenkort
                        </span>
                      )}
                    </div>

                    {assignment.topic && (
                      <p className="text-sm text-white/80 mb-2">{assignment.topic}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs">
                      <span className={`flex items-center gap-1 ${
                        urgency === 'urgent' || isOverdue ? 'text-red-400' : urgency === 'warning' ? 'text-amber-400' : 'text-gray-400'
                      }`}>
                        <Icons.clock size={12} />
                        Deadline: {new Date(assignment.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                      </span>
                      <span className={`font-medium ${
                        isOverdue ? 'text-red-400' : urgency === 'urgent' ? 'text-red-300' : urgency === 'warning' ? 'text-amber-300' : 'text-gray-400'
                      }`}>
                        {isOverdue ? `${Math.abs(daysLeft)} dagen te laat` : `Nog ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'}`}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => markArticleSubmitted(assignment.id)}
                      className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                      title="Markeer als ingeleverd"
                    >
                      <Icons.check size={14} />
                      <span className="hidden sm:inline">Ingeleverd</span>
                    </button>
                    <button
                      onClick={() => dismissNewsletterReminder(assignment.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                      title="Herinnering sluiten"
                    >
                      <Icons.x size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Newsletter Manager Overview Widget - for Erika, partners, admins */}
      {isNewsletterManager && pendingOverviewArticles.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-workx-lime/20 bg-gradient-to-br from-workx-lime/5 via-transparent to-emerald-500/5 p-5 shadow-lg shadow-workx-lime/5">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-workx-lime/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                  <Icons.fileText className="text-workx-lime" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Nieuwsbrief Overzicht</h2>
                  <p className="text-xs text-gray-400">
                    {pendingOverviewArticles.length} {pendingOverviewArticles.length === 1 ? 'artikel' : 'artikelen'} openstaand
                  </p>
                </div>
              </div>
              <Link href="/dashboard/werk" className="text-sm text-workx-lime hover:underline flex items-center gap-1">
                Beheren
                <Icons.arrowRight size={14} />
              </Link>
            </div>

            {/* Article list */}
            <div className="space-y-2">
              {pendingOverviewArticles.map((article) => {
                const urgency = getDeadlineUrgency(article.deadline)
                const daysLeft = Math.ceil((new Date(article.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                const isOverdue = daysLeft < 0
                const photoUrl = getPhotoUrl(article.assignee.name, article.assignee.avatarUrl)

                return (
                  <div
                    key={article.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      urgency === 'urgent' || isOverdue
                        ? 'bg-red-500/10 border border-red-500/20'
                        : urgency === 'warning'
                        ? 'bg-amber-500/5 border border-amber-500/15'
                        : 'bg-white/[0.03] border border-white/5'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                      {photoUrl ? (
                        <img src={photoUrl} alt={article.assignee.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                          {article.assignee.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{article.assignee.name.split(' ')[0]}</span>
                        {article.topic && (
                          <span className="text-xs text-gray-400 truncate hidden sm:inline">- {article.topic}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className={
                          isOverdue ? 'text-red-400 font-medium' : urgency === 'urgent' ? 'text-red-300' : urgency === 'warning' ? 'text-amber-400' : 'text-gray-400'
                        }>
                          {isOverdue ? `${Math.abs(daysLeft)}d te laat` : `${daysLeft}d`}
                        </span>
                        <span className="text-gray-500">
                          {new Date(article.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => pushNewsletterReminder(article.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          article.reminderPushedAt && !article.reminderDismissed
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={article.reminderPushedAt && !article.reminderDismissed ? 'Herinnering verstuurd' : 'Herinnering sturen'}
                      >
                        <Icons.bell size={14} />
                      </button>
                      <button
                        onClick={() => markArticleSubmitted(article.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                        title="Markeer als ingeleverd"
                      >
                        <Icons.check size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events & Absence Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Absence Overview - 2 Weeks */}
          <Link href="/dashboard/vakanties" className="card p-3 sm:p-5 relative overflow-hidden block group hover:border-yellow-500/30 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-yellow-500/10 transition-colors" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none group-hover:bg-orange-500/10 transition-colors" />

            <div className="relative">
              {/* Header - stays fixed */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.users className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Wie is er weg?</h2>
                    <p className="text-xs text-gray-400">Overzicht komende 2 weken</p>
                  </div>
                </div>
                <div className="text-sm text-workx-lime flex items-center gap-1">
                  Bekijk alles
                  <Icons.arrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 2-Week Grid */}
              <div className="space-y-2 sm:space-y-4">
                  {/* Week labels */}
                  <div className="grid grid-cols-5 gap-0.5 sm:gap-2">
                    {['Ma', 'Di', 'Wo', 'Do', 'Vr'].map(day => (
                      <div key={day} className="text-center text-xs sm:text-xs font-medium text-gray-500 uppercase">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Current Week */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
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
                                    className="w-3.5 h-3.5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: v.color + '30', color: v.color }}
                                  >
                                    {v.personName.charAt(0)}
                                  </div>
                                  <span className="text-xs text-white/70 truncate hidden sm:inline">
                                    {v.personName.split(' ')[0]}
                                  </span>
                                </div>
                              ))}
                              {absences.length > 3 && (
                                <p className="text-xs text-gray-400 text-center">+{absences.length - 3}</p>
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
                  <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
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
                            <p className="text-xs sm:text-lg font-bold text-gray-200">
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
                                    className="w-3.5 h-3.5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: v.color + '30', color: v.color }}
                                  >
                                    {v.personName.charAt(0)}
                                  </div>
                                  <span className="text-xs text-gray-400 truncate hidden sm:inline">
                                    {v.personName.split(' ')[0]}
                                  </span>
                                </div>
                              ))}
                              {absences.length > 3 && (
                                <p className="text-xs text-gray-400 text-center">+{absences.length - 3}</p>
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
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4 text-xs text-gray-500">
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
          </Link>

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

            {events.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Icons.calendar className="text-gray-500" size={20} />
                </div>
                <p className="text-gray-400 text-sm mb-2">Geen aankomende events</p>
                <Link href="/dashboard/agenda" className="text-xs text-workx-lime hover:underline">
                  Event toevoegen
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {events.slice(0, 3).map((event, index) => (
                  <Link
                    key={event.id}
                    href="/dashboard/agenda"
                    className="card p-3 flex items-center gap-3 group hover:border-white/10 transition-all"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-workx-lime transition-colors">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Icons.calendar size={10} />
                          {formatDate(event.startTime)}
                        </span>
                        {!event.isAllDay && (
                          <span className="flex items-center gap-1">
                            <Icons.clock size={10} />
                            {formatTime(event.startTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icons.chevronRight className="text-gray-500 group-hover:text-workx-lime transition-colors" size={14} />
                  </Link>
                ))}
                {events.length > 3 && (
                  <Link href="/dashboard/agenda" className="block text-center text-xs text-gray-500 hover:text-workx-lime py-1">
                    +{events.length - 3} meer events
                  </Link>
                )}
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
          <Link href="/dashboard/feedback" className="card p-4 relative overflow-hidden block group hover:border-purple-500/30 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.chat className="text-purple-400" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Feedback</p>
                    <p className="text-xs text-gray-400">{feedbackItems.length} items</p>
                  </div>
                </div>
                <Icons.arrowRight size={16} className="text-gray-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </div>

              {feedbackItems.length === 0 ? (
                <div className="text-center py-6">
                  <Icons.check className="text-green-400 mx-auto mb-2" size={24} />
                  <p className="text-sm text-gray-400">Geen feedback</p>
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
                          <p className="text-xs text-gray-400">
                            {item.submittedBy} · {new Date(item.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFeedback(item.id) }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
          </Link>
        ) : (
          /* Vacation Card for Employees */
          <SpotlightCard as={Link} href="/dashboard/vakanties" className="card p-4 overflow-hidden group block hover:border-workx-lime/30 transition-all card-glow-border-subtle" maxTilt={6} spotlightSize={400}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icons.sun className="text-workx-lime" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Mijn Vakantiedagen</p>
                    <p className="text-xs text-gray-400">Saldo {vacationBalance?.year || new Date().getFullYear()}</p>
                  </div>
                </div>
                <Icons.arrowRight size={16} className="text-gray-500 group-hover:text-workx-lime group-hover:translate-x-1 transition-all" />
              </div>

              {/* Vakantiedagen direct zichtbaar */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-semibold text-workx-lime">
                    <AnimatedNumber value={vacationBalance?.totaalDagen || 0} decimals={1} stiffness={60} damping={18} />
                  </div>
                  <p className="text-xs text-gray-400">Totaal</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-semibold text-orange-400">
                    <AnimatedNumber value={vacationBalance?.opgenomenLopendJaar || 0} decimals={1} stiffness={60} damping={18} />
                  </div>
                  <p className="text-xs text-gray-400">Opgenomen</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-semibold text-workx-lime">
                    <AnimatedNumber value={vacationBalance?.resterend || 0} decimals={1} stiffness={60} damping={18} />
                  </div>
                  <p className="text-xs text-gray-400">Resterend</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400"
                  style={{ width: `${vacationBalance?.totaalDagen ? (vacationBalance.opgenomenLopendJaar / vacationBalance.totaalDagen) * 100 : 0}%` }}
                />
              </div>

              {/* Ouderschapsverlof - alleen als aanwezig */}
              {parentalLeave && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowVacationDetails(!showVacationDetails) }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icons.heart className="text-purple-400" size={14} />
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Ouderschapsverlof</span>
                        {parentalLeave.kindNaam && (
                          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                            {parentalLeave.kindNaam}
                          </span>
                        )}
                      </div>
                      <Icons.chevronDown
                        size={14}
                        className={`text-gray-500 transition-transform ${showVacationDetails ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {showVacationDetails && (
                    <div className="mt-3 space-y-2 fade-in">
                      {/* Betaald verlof */}
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-green-400 font-medium">Betaald (70% UWV)</span>
                          <span className="text-xs text-gray-400">
                            {parentalLeave.betaaldOpgenomenWeken} / {parentalLeave.betaaldTotaalWeken} weken
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${parentalLeave.betaaldTotaalWeken ? (parentalLeave.betaaldOpgenomenWeken / parentalLeave.betaaldTotaalWeken) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-green-400 mt-1 font-medium">
                          {parentalLeave.betaaldTotaalWeken - parentalLeave.betaaldOpgenomenWeken} weken resterend
                        </p>
                      </div>

                      {/* Onbetaald verlof */}
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-purple-400 font-medium">Onbetaald</span>
                          <span className="text-xs text-gray-400">
                            {parentalLeave.onbetaaldOpgenomenWeken} / {parentalLeave.onbetaaldTotaalWeken} weken
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${parentalLeave.onbetaaldTotaalWeken ? (parentalLeave.onbetaaldOpgenomenWeken / parentalLeave.onbetaaldTotaalWeken) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-purple-400 mt-1 font-medium">
                          {parentalLeave.onbetaaldTotaalWeken - parentalLeave.onbetaaldOpgenomenWeken} weken resterend
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SpotlightCard>
        )}

        {/* Birthday Card - GROOTS on birthday, normal otherwise */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (nextBirthday[0]) {
              setShowBirthdayPopup(true)
              // Play happy birthday melody using Web Audio API
              try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
                // Happy Birthday melody notes (simplified)
                const melody = [
                  { note: 264, duration: 0.25 }, // C
                  { note: 264, duration: 0.25 }, // C
                  { note: 297, duration: 0.5 },  // D
                  { note: 264, duration: 0.5 },  // C
                  { note: 352, duration: 0.5 },  // F
                  { note: 330, duration: 1 },    // E
                  { note: 264, duration: 0.25 }, // C
                  { note: 264, duration: 0.25 }, // C
                  { note: 297, duration: 0.5 },  // D
                  { note: 264, duration: 0.5 },  // C
                  { note: 396, duration: 0.5 },  // G
                  { note: 352, duration: 1 },    // F
                ]
                let time = audioContext.currentTime
                melody.forEach(({ note, duration }) => {
                  const oscillator = audioContext.createOscillator()
                  const gainNode = audioContext.createGain()
                  oscillator.connect(gainNode)
                  gainNode.connect(audioContext.destination)
                  oscillator.frequency.value = note
                  oscillator.type = 'sine'
                  gainNode.gain.setValueAtTime(0.15, time)
                  gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.9)
                  oscillator.start(time)
                  oscillator.stop(time + duration)
                  time += duration
                })
                setBirthdayAudioRef(audioContext as any)
              } catch (e) {
                console.log('Audio not supported')
              }
              // Auto-hide after 6 seconds
              setTimeout(() => {
                setShowBirthdayPopup(false)
              }, 6000)
            }
          }}
          onMouseLeave={() => {
            setShowBirthdayPopup(false)
            if (birthdayAudioRef) {
              try {
                (birthdayAudioRef as any).close?.()
              } catch (e) {}
            }
          }}
        >
          {/* FUN BIRTHDAY POPUP */}
          {showBirthdayPopup && nextBirthday[0] && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-none">
              <div className="relative animate-birthday-popup">
                {/* Confetti particles */}
                <div className="absolute inset-0 -inset-x-8 -top-12">
                  {[...Array(20)].map((_, i) => (
                    <span
                      key={i}
                      className="confetti-particle"
                      style={{
                        left: `${10 + Math.random() * 80}%`,
                        animationDelay: `${Math.random() * 0.5}s`,
                        backgroundColor: ['#FF1493', '#FFD700', '#00CED1', '#FF6B6B', '#9400D3', '#32CD32'][Math.floor(Math.random() * 6)],
                      }}
                    />
                  ))}
                </div>

                {/* The head with party hat */}
                <div className="relative">
                  {/* Party hat - positioned on head */}
                  <div className="absolute -top-6 left-1/2 -translate-x-[74%] z-10">
                    <svg width="50" height="45" viewBox="0 0 50 45" fill="none" className="animate-wobble">
                      {/* Hat cone */}
                      <path d="M25 2L42 38H8L25 2Z" fill="url(#partyHat2)" />
                      {/* Pom pom on top */}
                      <circle cx="25" cy="4" r="5" fill="#FFD700" />
                      {/* Hat rim */}
                      <ellipse cx="25" cy="40" rx="18" ry="4" fill="#FF69B4" />
                      {/* Decorative dots on hat */}
                      <circle cx="18" cy="25" r="2" fill="#FFD700" />
                      <circle cx="25" cy="18" r="2" fill="#00CED1" />
                      <circle cx="32" cy="28" r="2" fill="#FFD700" />
                      <circle cx="22" cy="32" r="1.5" fill="#FF69B4" />
                      <circle cx="30" cy="22" r="1.5" fill="#32CD32" />
                      <defs>
                        <linearGradient id="partyHat2" x1="25" y1="2" x2="25" y2="38">
                          <stop stopColor="#FF1493" />
                          <stop offset="0.5" stopColor="#9400D3" />
                          <stop offset="1" stopColor="#4169E1" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* Profile image as head */}
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-pink-500 shadow-2xl shadow-pink-500/50 animate-wobble bg-gradient-to-br from-pink-500 to-purple-500">
                    {getPhotoUrl(nextBirthday[0].name, nextBirthday[0].avatarUrl) ? (
                      <img
                        src={getPhotoUrl(nextBirthday[0].name, nextBirthday[0].avatarUrl)!}
                        alt={nextBirthday[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎂
                      </div>
                    )}
                  </div>
                </div>

                {/* Name banner */}
                <div className="mt-2 px-4 py-1 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 rounded-full text-white text-sm font-bold text-center whitespace-nowrap shadow-lg animate-pulse">
                  🎉 {nextBirthday[0].name.split(' ')[0]}! 🎉
                </div>
              </div>

              {/* CSS for animations */}
              <style jsx>{`
                @keyframes birthday-popup {
                  0% { transform: translateY(20px) scale(0); opacity: 0; }
                  50% { transform: translateY(-10px) scale(1.1); }
                  100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes wobble {
                  0%, 100% { transform: rotate(-3deg); }
                  50% { transform: rotate(3deg); }
                }
                @keyframes confetti-fall {
                  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                  100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
                }
                .animate-birthday-popup {
                  animation: birthday-popup 0.5s ease-out forwards;
                }
                .animate-wobble {
                  animation: wobble 0.4s ease-in-out infinite;
                }
                .confetti-particle {
                  position: absolute;
                  width: 8px;
                  height: 8px;
                  border-radius: 2px;
                  animation: confetti-fall 2s ease-out infinite;
                }
              `}</style>
            </div>
          )}

          <Link
            href="/dashboard/agenda"
            className={`card p-4 relative overflow-hidden group transition-all block ${
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
                    <p className="text-xs text-gray-400">
                      {birthdayToday ? '🎉 VANDAAG JARIG!' : 'Binnenkort jarig'}
                    </p>
                  </div>
                </div>
                <Icons.arrowRight size={16} className="text-gray-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
              </div>

              {/* Featured birthday - First person */}
              {nextBirthday[0] && (
                <div className={`mb-3 p-3 -mx-1 rounded-xl border transition-all ${
                  birthdayToday
                    ? 'bg-gradient-to-r from-pink-500/30 via-purple-500/20 to-yellow-500/20 border-pink-500/50'
                    : 'bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-pink-500/5 border-pink-500/20 group-hover:border-pink-500/40 group-hover:from-pink-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    {/* Show profile image if available */}
                    <div className={`rounded-xl flex items-center justify-center shadow-lg overflow-hidden ${
                      birthdayToday ? 'w-16 h-16 shadow-pink-500/30 animate-bounce' : 'w-12 h-12 shadow-pink-500/10'
                    } bg-gradient-to-br from-pink-500/30 to-purple-500/20`}>
                      {getPhotoUrl(nextBirthday[0].name, nextBirthday[0].avatarUrl) ? (
                        <img
                          src={getPhotoUrl(nextBirthday[0].name, nextBirthday[0].avatarUrl)!}
                          alt={nextBirthday[0].name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className={`${birthdayToday ? 'text-4xl' : 'text-2xl'}`}>🎉</span>
                      )}
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
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
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
                        <p className="text-xs text-gray-400">{nextBirthday[0].daysUntil === 1 ? 'dag' : 'dagen'}</p>
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
                      <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center text-sm overflow-hidden">
                        {getPhotoUrl(person.name, person.avatarUrl) ? (
                          <img src={getPhotoUrl(person.name, person.avatarUrl)!} alt={person.name} className="w-full h-full object-cover" />
                        ) : (
                          '🎂'
                        )}
                      </div>
                      <div>
                        <span className="text-sm text-white/70">{person.name.split(' ')[0]}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {person.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {person.daysUntil}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Bottom section with Widget and Stats */}
      <ScrollReveal direction="up" distance={35} duration={0.5} staggerChildren={0.1} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dynamic Widget based on role */}
        <ScrollRevealItem>
        {isAdmin ? (
          /* Werkdruk Widget for Partners/Hanna */
          <SpotlightCard as={Link} href="/dashboard/werk" className="card p-5 overflow-hidden group hover:border-workx-lime/30 transition-all" maxTilt={8}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Icons.activity className="text-yellow-400" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Werkdruk</p>
                    <p className="text-xs text-gray-400">Team overzicht</p>
                  </div>
                </div>
                <Icons.arrowRight size={16} className="text-gray-500 group-hover:text-workx-lime group-hover:translate-x-1 transition-all" />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <span className="text-gray-400">Rustig</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span className="text-gray-400">Normaal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <span className="text-gray-400">Druk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-gray-400">Zeer druk</span>
                </div>
              </div>
            </div>
          </SpotlightCard>
        ) : (
          /* Feedback Widget for Employees */
          <SpotlightCard as={Link} href="/dashboard/feedback" className="card p-5 overflow-hidden group hover:border-purple-500/30 transition-all" maxTilt={8}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Icons.chat className="text-purple-400" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Feedback</p>
                    <p className="text-xs text-gray-400">Deel je ideeën</p>
                  </div>
                </div>
                <Icons.arrowRight size={16} className="text-gray-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Heb je een idee of bug gevonden? Laat het weten via de feedback pagina.
              </p>
            </div>
          </SpotlightCard>
        )}
        </ScrollRevealItem>

        {/* Stats - Right side - All clickable */}
        {[
          { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Open zaken', numValue: workItems.length, color: 'text-blue-400', bg: 'bg-blue-500/10', iconAnim: 'icon-briefcase-hover', sparkData: [3, 5, 4, 7, 6, 8, 5, 9, 7, 6] },
          { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Events deze week', numValue: events.length, color: 'text-purple-400', bg: 'bg-purple-500/10', iconAnim: 'icon-calendar-hover', sparkData: [2, 4, 3, 5, 7, 4, 6, 3, 5, 4] },
        ].map((stat, index) => (
          <ScrollRevealItem key={stat.label}>
          <SpotlightCard
            key={stat.label}
            as={Link}
            href={stat.href}
            className={`card p-5 group hover:border-white/10 transition-all overflow-hidden ${stat.iconAnim}`}
            maxTilt={10}
            spotlightSize={250}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform icon-animated`}>
                <stat.icon className={stat.color} size={18} />
              </div>
            </div>
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold text-white mb-1 group-hover:text-workx-lime transition-colors">
                  <AnimatedNumber value={stat.numValue} stiffness={60} damping={15} />
                </div>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
              <Sparkline
                data={stat.sparkData}
                width={80}
                height={32}
                color={stat.color === 'text-blue-400' ? '#60a5fa' : '#c084fc'}
                strokeWidth={1.5}
                duration={1.2}
              />
            </div>
          </SpotlightCard>
          </ScrollRevealItem>
        ))}
      </ScrollReveal>

      {/* Quick Actions */}
      <ScrollReveal direction="up" distance={30} duration={0.5}>
        <div className="card p-5 relative overflow-hidden liquid-glass noise-overlay">
          <div className="absolute top-0 right-0 w-40 h-40 bg-workx-lime/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.zap className="text-workx-lime" size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Snelle acties</h2>
                <p className="text-xs text-gray-400">Veelgebruikte handelingen</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakantie aanvragen', color: 'text-yellow-400', bg: 'bg-yellow-500/10 hover:bg-yellow-500/20' },
                { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback geven', color: 'text-purple-400', bg: 'bg-purple-500/10 hover:bg-purple-500/20' },
                { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Event toevoegen', color: 'text-blue-400', bg: 'bg-blue-500/10 hover:bg-blue-500/20' },
                { href: '/dashboard/chat', icon: Icons.chat, label: 'Chat openen', color: 'text-green-400', bg: 'bg-green-500/10 hover:bg-green-500/20' },
              ].map((action) => (
                <MagneticButton
                  key={action.label}
                  as={Link}
                  href={action.href}
                  className={`flex items-center gap-3 p-3 rounded-xl ${action.bg} transition-all group`}
                  strength={0.25}
                  radius={120}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <action.icon size={16} className={action.color} />
                  </div>
                  <span className="text-sm text-white/80 group-hover:text-white transition-colors">{action.label}</span>
                </MagneticButton>
              ))}
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  )
}
