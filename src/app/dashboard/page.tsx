'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

// Team verjaardagen (zelfde als agenda)
const TEAM_BIRTHDAYS = [
  { name: 'Marnix Ritmeester', birthDate: '03-12' },
  { name: 'Maaike de Jong', birthDate: '07-23' },
  { name: 'Marlieke Schipper', birthDate: '01-08' },
  { name: 'Kay Maes', birthDate: '05-17' },
  { name: 'Justine Schellekens', birthDate: '09-04' },
  { name: 'Juliette Niersman', birthDate: '11-21' },
  { name: 'Jochem de Roos', birthDate: '04-29' },
  { name: 'Julia Groen', birthDate: '08-15' },
  { name: 'Hanna Blaauboer', birthDate: '02-06' },
  { name: 'Erika van Zadelhof', birthDate: '06-30' },
  { name: 'Emma van der Vos', birthDate: '10-11' },
  { name: 'Bas den Ridder', birthDate: '12-03' },
  { name: 'Barbara Rip', birthDate: '02-19' },
  { name: 'Lotte van Sint Truiden', birthDate: '07-07' },
]

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

// Demo vakanties deze week (voor overzicht wie er weg is)
const DEMO_VACATIONS = [
  { id: '1', personName: 'Marnix Ritmeester', startDate: '2026-01-27', endDate: '2026-01-31', note: 'Skivakantie', color: '#60a5fa' },
  { id: '2', personName: 'Julia Groen', startDate: '2026-01-29', endDate: '2026-02-02', note: 'Lang weekend', color: '#f9ff85' },
  { id: '3', personName: 'Bas den Ridder', startDate: '2026-01-30', endDate: '2026-01-30', note: 'Tandarts', color: '#a78bfa' },
  { id: '4', personName: 'Hanna Blaauboer', startDate: '2026-02-03', endDate: '2026-02-07', note: 'Voorjaarsvakantie', color: '#34d399' },
  { id: '5', personName: 'Kay Maes', startDate: '2026-02-10', endDate: '2026-02-14', note: null, color: '#fb923c' },
  { id: '6', personName: 'Emma van der Vos', startDate: '2026-01-28', endDate: '2026-01-29', note: 'Ziek', color: '#f87171' },
]

// Demo vakantiedagen data (alsof Hanna dit heeft ingevoerd)
const VACATION_BALANCE = {
  userName: 'Jochem de Roos', // Huidige gebruiker (demo)
  year: 2025,
  wettelijkeDagen: 20,        // Wettelijke vakantiedagen
  bovenwettelijkeDagen: 5,    // Bovenwettelijke dagen
  overgedragenVorigJaar: 3.5, // Overgedragen van vorig jaar
  opgenomenDitJaar: 8,        // Al opgenomen dit jaar
  geplandDitJaar: 5,          // Gepland maar nog niet opgenomen
  lastUpdatedBy: 'Hanna Blaauboer',
  lastUpdated: '2025-01-28',
}

const quickLinks = [
  { href: '/dashboard/agenda', Icon: Icons.calendar, label: 'Agenda', desc: 'Events & verjaardagen', color: 'from-blue-500/20 to-blue-600/10' },
  { href: '/dashboard/bonus', Icon: Icons.euro, label: 'Bonus', desc: 'Berekeningen', color: 'from-green-500/20 to-green-600/10' },
  { href: '/dashboard/transitie', Icon: Icons.calculator, label: 'Transitie', desc: 'Vergoeding', color: 'from-purple-500/20 to-purple-600/10' },
  { href: '/dashboard/vakanties', Icon: Icons.sun, label: 'Vakanties', desc: 'Wie is er weg', color: 'from-orange-500/20 to-orange-600/10' },
  { href: '/dashboard/werk', Icon: Icons.briefcase, label: 'Werk', desc: 'Taken beheren', color: 'from-red-500/20 to-red-600/10' },
]

export default function DashboardHome() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showVacationDetails, setShowVacationDetails] = useState(false)

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
      return { ...member, date: birthdayThisYear, daysUntil }
    }).sort((a, b) => a.daysUntil - b.daysUntil)

    return upcomingBirthdays.slice(0, 3) // Return top 3
  }, [])

  // Calculate who's away this week
  const awayThisWeek = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

    return DEMO_VACATIONS.filter(v => {
      const start = new Date(v.startDate)
      const end = new Date(v.endDate)
      return start <= endOfWeek && end >= startOfWeek
    }).map(v => {
      const start = new Date(v.startDate)
      const end = new Date(v.endDate)
      const isToday = start <= today && end >= today
      return { ...v, isToday }
    })
  }, [])

  // Get days of this week for the mini calendar
  const weekDays = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    Promise.all([fetchEvents(), fetchWork()]).finally(() => setIsLoading(false))
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

  return (
    <div className="space-y-8 fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-workx-gray to-workx-dark border border-white/10 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-workx-lime/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-workx-lime/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-workx-lime text-sm font-medium mb-1">{getGreeting()}</p>
            <h1 className="text-3xl font-semibold text-white mb-2">Welkom bij Workx</h1>
            <p className="text-white/50 max-w-md">
              Beheer je zaken, bereken bonussen en houd je team op de hoogte. Alles in één dashboard.
            </p>
          </div>

          <div className="hidden lg:block text-right">
            <div className="text-5xl font-light text-white tabular-nums">
              {currentTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <p className="text-white/40 mt-1">
              {currentTime.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Snelle toegang</h2>
          <span className="text-xs text-white/30">{quickLinks.length} tools</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map(({ href, Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-workx-lime/30 hover:bg-white/[0.05] transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/60 group-hover:text-workx-lime group-hover:bg-workx-lime/10 transition-all mb-3">
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events & Absence Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Absence This Week Card */}
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Icons.sun className="text-yellow-400" size={16} />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-white">Afwezig deze week</h2>
                    <p className="text-xs text-white/40">{awayThisWeek.filter(v => v.isToday).length} vandaag afwezig</p>
                  </div>
                </div>
                <Link href="/dashboard/vakanties" className="text-sm text-workx-lime hover:underline flex items-center gap-1">
                  Alle vakanties
                  <Icons.arrowRight size={14} />
                </Link>
              </div>

              {/* Mini week calendar */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekDays.map((day, i) => {
                  const isToday = day.toDateString() === new Date().toDateString()
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const absencesOnDay = DEMO_VACATIONS.filter(v => {
                    const start = new Date(v.startDate)
                    const end = new Date(v.endDate)
                    return start <= day && end >= day
                  })

                  return (
                    <div
                      key={i}
                      className={`text-center p-2 rounded-lg ${
                        isToday ? 'bg-workx-lime/10 ring-1 ring-workx-lime/30' : isWeekend ? 'bg-white/[0.02]' : 'bg-white/5'
                      }`}
                    >
                      <p className={`text-[10px] font-medium uppercase ${isToday ? 'text-workx-lime' : 'text-white/40'}`}>
                        {day.toLocaleDateString('nl-NL', { weekday: 'short' })}
                      </p>
                      <p className={`text-sm font-semibold ${isToday ? 'text-workx-lime' : 'text-white'}`}>
                        {day.getDate()}
                      </p>
                      {absencesOnDay.length > 0 && (
                        <div className="flex justify-center gap-0.5 mt-1">
                          {absencesOnDay.slice(0, 3).map((v, j) => (
                            <div
                              key={j}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: v.color }}
                            />
                          ))}
                          {absencesOnDay.length > 3 && (
                            <span className="text-[8px] text-white/40">+{absencesOnDay.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* List of people away */}
              {awayThisWeek.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-white/40">Iedereen is aanwezig deze week</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {awayThisWeek.map((vacation, index) => {
                    const startDate = new Date(vacation.startDate)
                    const endDate = new Date(vacation.endDate)
                    const isSingleDay = vacation.startDate === vacation.endDate

                    return (
                      <div
                        key={vacation.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          vacation.isToday ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5 hover:bg-white/10'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm flex-shrink-0"
                          style={{ backgroundColor: vacation.color + '30', color: vacation.color }}
                        >
                          {vacation.personName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{vacation.personName}</p>
                            {vacation.isToday && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                                Nu afwezig
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-white/40">
                              {isSingleDay
                                ? startDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
                                : `${startDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                              }
                            </p>
                            {vacation.note && (
                              <>
                                <span className="text-white/20">·</span>
                                <p className="text-xs text-white/40 truncate">{vacation.note}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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

        {/* Work Items Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Icons.briefcase className="text-orange-400" size={16} />
              </div>
              <h2 className="text-lg font-medium text-white">Open taken</h2>
            </div>
            <Link href="/dashboard/werk" className="text-sm text-workx-lime hover:underline flex items-center gap-1">
              Alles
              <Icons.arrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-16 animate-pulse" />
              ))}
            </div>
          ) : workItems.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Icons.check className="text-green-400" size={20} />
              </div>
              <p className="text-white/50 text-sm">Geen open taken</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workItems.map((item, index) => (
                <Link
                  key={item.id}
                  href="/dashboard/werk"
                  className="card p-3 group hover:border-white/10 transition-all block"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityColors[item.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate group-hover:text-workx-lime transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-white/40">{statusLabels[item.status] || item.status}</span>
                        {item.clientName && (
                          <>
                            <span className="text-white/20">·</span>
                            <span className="text-[11px] text-white/40 truncate">{item.clientName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vacation & Birthday Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Compact Vacation Card */}
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
                  <p className="text-sm font-medium text-white">Mijn vakantiedagen</p>
                  <p className="text-xs text-white/40">Saldo {VACATION_BALANCE.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-workx-lime">
                    {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar - VACATION_BALANCE.opgenomenDitJaar - VACATION_BALANCE.geplandDitJaar}
                  </p>
                  <p className="text-xs text-white/40">dagen over</p>
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
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3 fade-in">
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

              <div className="text-xs space-y-1.5">
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

              <p className="text-[10px] text-white/30 pt-2 border-t border-white/5">
                Bijgewerkt door {VACATION_BALANCE.lastUpdatedBy} op {new Date(VACATION_BALANCE.lastUpdated).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          )}
        </div>

        {/* Birthday Card */}
        <Link href="/dashboard/agenda" className="card p-4 relative overflow-hidden group hover:border-pink-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/10 transition-colors" />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <span className="text-lg">🎂</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Verjaardagen</p>
                  <p className="text-xs text-white/40">Binnenkort jarig</p>
                </div>
              </div>
              <Icons.arrowRight size={16} className="text-white/20 group-hover:text-pink-400 transition-colors" />
            </div>

            <div className="space-y-2">
              {nextBirthday.map((person, i) => (
                <div
                  key={person.name}
                  className={`flex items-center justify-between ${i === 0 ? 'bg-pink-500/10 -mx-2 px-2 py-1.5 rounded-lg' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {i === 0 && <span className="text-sm">🎉</span>}
                    <span className={`text-sm ${i === 0 ? 'text-pink-400 font-medium' : 'text-white/60'}`}>
                      {person.name.split(' ')[0]}
                    </span>
                  </div>
                  <div className="text-right">
                    {person.daysUntil === 0 ? (
                      <span className="text-xs font-medium text-pink-400 bg-pink-500/20 px-2 py-0.5 rounded-full">Vandaag!</span>
                    ) : person.daysUntil === 1 ? (
                      <span className="text-xs font-medium text-orange-400">Morgen</span>
                    ) : (
                      <span className={`text-xs ${i === 0 ? 'text-pink-400' : 'text-white/40'}`}>
                        over {person.daysUntil} dagen
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Icons.briefcase, label: 'Open zaken', value: workItems.length.toString(), color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { icon: Icons.calendar, label: 'Events deze week', value: events.length.toString(), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: Icons.clock, label: 'Vandaag', value: new Date().toLocaleDateString('nl-NL', { weekday: 'short' }), color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { icon: Icons.zap, label: 'Productiviteit', value: '94%', color: 'text-workx-lime', bg: 'bg-workx-lime/10' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="card p-5 group hover:border-white/10 transition-all"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={stat.color} size={18} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white mb-1">{stat.value}</p>
            <p className="text-sm text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
