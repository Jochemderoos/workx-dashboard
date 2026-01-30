'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

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
  { href: '/dashboard/team', Icon: Icons.users, label: 'Team', desc: "Collega's", color: 'from-cyan-500/20 to-cyan-600/10' },
]

export default function DashboardHome() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

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

      {/* Vacation Balance Card */}
      <div className="card p-6 relative overflow-hidden border-workx-lime/20">
        <div className="absolute top-0 right-0 w-48 h-48 bg-workx-lime/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-green-500/10 flex items-center justify-center">
                <Icons.sun className="text-workx-lime" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Mijn vakantiedagen</h2>
                <p className="text-sm text-white/40">Saldo {VACATION_BALANCE.year}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/30">Laatst bijgewerkt door</p>
              <p className="text-sm text-white/50">{VACATION_BALANCE.lastUpdatedBy}</p>
              <p className="text-xs text-white/30">{new Date(VACATION_BALANCE.lastUpdated).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>

          {/* Main balance display */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/40 mb-1">Totaal beschikbaar</p>
              <p className="text-3xl font-bold text-workx-lime">
                {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar}
              </p>
              <p className="text-xs text-white/30 mt-1">dagen dit jaar</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/40 mb-1">Opgenomen</p>
              <p className="text-3xl font-bold text-orange-400">
                {VACATION_BALANCE.opgenomenDitJaar}
              </p>
              <p className="text-xs text-white/30 mt-1">dagen gebruikt</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/40 mb-1">Gepland</p>
              <p className="text-3xl font-bold text-blue-400">
                {VACATION_BALANCE.geplandDitJaar}
              </p>
              <p className="text-xs text-white/30 mt-1">dagen ingepland</p>
            </div>

            <div className="bg-gradient-to-br from-workx-lime/10 to-green-500/5 rounded-xl p-4 border border-workx-lime/20">
              <p className="text-xs text-workx-lime/70 mb-1">Resterend</p>
              <p className="text-3xl font-bold text-white">
                {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar - VACATION_BALANCE.opgenomenDitJaar - VACATION_BALANCE.geplandDitJaar}
              </p>
              <p className="text-xs text-white/30 mt-1">dagen over</p>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-xs text-white/40 mb-3 font-medium">Opbouw saldo</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-workx-lime"></span>
                  Wettelijke vakantiedagen
                </span>
                <span className="text-white font-medium">{VACATION_BALANCE.wettelijkeDagen} dagen</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Bovenwettelijke dagen
                </span>
                <span className="text-white font-medium">{VACATION_BALANCE.bovenwettelijkeDagen} dagen</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  Overgedragen van {VACATION_BALANCE.year - 1}
                </span>
                <span className="text-white font-medium">{VACATION_BALANCE.overgedragenVorigJaar} dagen</span>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex items-center justify-between text-sm">
                <span className="text-white/80 font-medium">Totaal {VACATION_BALANCE.year}</span>
                <span className="text-workx-lime font-semibold">
                  {VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar} dagen
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
              <span>Verbruik dit jaar</span>
              <span>
                {Math.round(((VACATION_BALANCE.opgenomenDitJaar + VACATION_BALANCE.geplandDitJaar) / (VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar)) * 100)}% gebruikt/gepland
              </span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-orange-400 transition-all"
                style={{ width: `${(VACATION_BALANCE.opgenomenDitJaar / (VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar)) * 100}%` }}
              />
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${(VACATION_BALANCE.geplandDitJaar / (VACATION_BALANCE.wettelijkeDagen + VACATION_BALANCE.bovenwettelijkeDagen + VACATION_BALANCE.overgedragenVorigJaar)) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1.5 text-white/40">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                Opgenomen
              </span>
              <span className="flex items-center gap-1.5 text-white/40">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Gepland
              </span>
              <span className="flex items-center gap-1.5 text-white/40">
                <span className="w-2 h-2 rounded-full bg-white/10"></span>
                Beschikbaar
              </span>
            </div>
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
        {/* Events Column */}
        <div className="lg:col-span-2">
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
