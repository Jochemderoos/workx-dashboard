'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

// Lodewijk profile info
const LODEWIJK = {
  name: 'Lodewijk van Thiel',
  subtitle: 'Extern advocaat',
  internRate: 155,
  externRate: 310,
  userId: 'lodewijk-van-thiel', // Used as advocateUserId
  capacityMin: 24, // minimale uren/week
  capacityMax: 32, // maximale uren/week
}

interface WorkloadEntry {
  id: string
  personName: string
  date: string
  level: string
  hours: number | null
  createdAt: string
  updatedAt: string
}

interface WorkloadDetailEntry {
  id: string
  personName: string
  date: string
  projectName: string
  activityType: string
  description: string | null
  billableHours: number
  workedHours: number
}

interface ProjectSummary {
  projectName: string
  totalBillableHours: number
  totalWorkedHours: number
  daysActive: number
  lastDate: string
  details: WorkloadDetailEntry[]
}


// ─── Workload Bar ───────────────────────────────────────────────────────

function WorkloadBar({ hours }: { hours: number }) {
  const maxHours = 42
  const pct = Math.min((hours / maxHours) * 100, 100)
  let color = 'from-green-500 to-green-400'
  let label = 'Licht'
  if (hours > 32) { color = 'from-red-500 to-red-400'; label = 'Zwaar' }
  else if (hours > 28) { color = 'from-orange-500 to-orange-400'; label = 'Hoog' }
  else if (hours > 24) { color = 'from-yellow-500 to-yellow-400'; label = 'Normaal' }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/40">Werkdruk</span>
        <span className="text-white/60">{label}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/20">
        <span>0u</span>
        <span>24u</span>
        <span>32u</span>
        <span>42u</span>
      </div>
    </div>
  )
}

// ─── Weekly Hours Overview ──────────────────────────────────────────────

function getWeekBounds(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Monday = start of week (ISO)
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) - (weeksAgo * 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('nl-NL', opts)} - ${end.toLocaleDateString('nl-NL', opts)}`
}

function getBarColor(hours: number): string {
  if (hours > 32) return 'from-red-500 to-red-400'
  if (hours > 28) return 'from-orange-500 to-orange-400'
  if (hours > 24) return 'from-yellow-500 to-yellow-400'
  return 'from-green-500 to-green-400'
}

interface WeekData {
  start: Date
  end: Date
  label: string
  hours: number
  pct: number
  isCurrent: boolean
}

function WeeklyHoursOverview({ entries }: { entries: WorkloadEntry[] }) {
  const weeks: WeekData[] = useMemo(() => {
    const result: WeekData[] = []
    for (let i = 0; i < 4; i++) {
      const { start, end } = getWeekBounds(i)
      const startStr = start.toISOString().slice(0, 10)
      const endStr = end.toISOString().slice(0, 10)
      const weekEntries = entries.filter(e => e.date >= startStr && e.date <= endStr)
      const hours = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      result.push({
        start,
        end,
        label: formatWeekLabel(start, end),
        hours: Math.round(hours * 10) / 10,
        pct: Math.min((hours / LODEWIJK.capacityMax) * 100, 100),
        isCurrent: i === 0,
      })
    }
    return result
  }, [entries])

  const trend = useMemo(() => {
    if (weeks.length < 2 || weeks[1].hours === 0) return null
    const diff = ((weeks[0].hours - weeks[1].hours) / weeks[1].hours) * 100
    return Math.round(diff * 10) / 10
  }, [weeks])

  const average = useMemo(() => {
    const total = weeks.reduce((sum, w) => sum + w.hours, 0)
    return Math.round((total / weeks.length) * 10) / 10
  }, [weeks])

  // Don't render if no data at all
  const hasData = entries.some(e => e.hours && e.hours > 0)
  if (!hasData) return null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="relative p-6 sm:p-8 space-y-5">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Icons.clock size={18} className="text-workx-lime/70" />
          Weekoverzicht declarabele uren
        </h3>

        <div className="space-y-3">
          {weeks.map((week, i) => (
            <div key={i} className={`rounded-xl p-3 transition-colors ${week.isCurrent ? 'bg-white/[0.04] ring-1 ring-workx-lime/20' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/50">
                  {week.label}
                  {week.isCurrent && <span className="ml-2 text-workx-lime/70 text-[10px] font-medium">(deze week)</span>}
                </span>
                <span className="text-xs font-medium text-white/70">{week.hours}u</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getBarColor(week.hours)} transition-all duration-500`}
                    style={{ width: `${week.pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/30 w-8 text-right">{Math.round(week.pct)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: trend + gemiddelde + capaciteit */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-white/5 text-xs text-white/40">
          {trend !== null && (
            <span className={`flex items-center gap-1 ${trend >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {trend >= 0 ? <Icons.trendingUp size={14} /> : <Icons.trendingDown size={14} />}
              {trend >= 0 ? '+' : ''}{trend}% t.o.v. vorige week
            </span>
          )}
          <span>Gemiddeld: <span className="text-white/60 font-medium">{average} uur/week</span></span>
          <span>Capaciteit: <span className="text-white/60 font-medium">{LODEWIJK.capacityMin}-{LODEWIJK.capacityMax} uur/week</span></span>
        </div>
      </div>
    </div>
  )
}


// ─── Cases From Upload ──────────────────────────────────────────────────

function CasesFromUpload({ summaries }: { summaries: ProjectSummary[] }) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  if (summaries.length === 0) return null

  const maxHours = Math.max(...summaries.map(s => s.totalBillableHours))
  const totalHours = summaries.reduce((sum, s) => sum + s.totalBillableHours, 0)

  // Shorten project name for display: "Stek Advocaten B.V. / Castellum - Project Eurohill" → "Castellum - Project Eurohill"
  const shortName = (name: string) => {
    const parts = name.split(' / ')
    return parts.length > 1 ? parts.slice(1).join(' / ') : name
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="relative p-6 sm:p-8 space-y-5">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Icons.briefcase size={18} className="text-workx-lime/70" />
          Uren per zaak (laatste 4 weken)
        </h3>

        <div className="space-y-3">
          {summaries.map((summary) => {
            const pct = maxHours > 0 ? (summary.totalBillableHours / maxHours) * 100 : 0
            const isExpanded = expandedProject === summary.projectName

            return (
              <div key={summary.projectName}>
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : summary.projectName)}
                  className="w-full text-left rounded-xl p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white/80 font-medium truncate mr-3">
                      {shortName(summary.projectName)}
                    </span>
                    <span className="text-sm font-bold text-white/70 flex-shrink-0">
                      {summary.totalBillableHours}u
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-workx-lime/80 to-workx-lime transition-all duration-500"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span>Laatst: {formatDate(summary.lastDate)}</span>
                    <span>&middot;</span>
                    <span>{summary.daysActive} {summary.daysActive === 1 ? 'dag' : 'dagen'}</span>
                    <Icons.chevronDown
                      size={12}
                      className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded detail rows */}
                {isExpanded && (
                  <div className="ml-3 mt-1 mb-2 pl-3 border-l border-white/5 space-y-1">
                    {summary.details.map((d, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-1.5 text-xs">
                        <span className="text-white/30 w-14 flex-shrink-0">{formatDate(d.date)}</span>
                        <span className="text-white/50 w-10 text-right flex-shrink-0">{d.billableHours}u</span>
                        {d.description && (
                          <span className="text-white/25 truncate">{d.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer totaal */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
          <span>
            Totaal: <span className="text-white/60 font-medium">{Math.round(totalHours * 10) / 10}u</span> over {summaries.length} {summaries.length === 1 ? 'zaak' : 'zaken'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function WerkLodewijkPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [workloadEntries, setWorkloadEntries] = useState<WorkloadEntry[]>([])
  const [workloadDetails, setWorkloadDetails] = useState<WorkloadDetailEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const user = session?.user as { role?: string } | undefined

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && user?.role !== 'PARTNER' && user?.role !== 'ADMIN' && user?.role !== 'EXTERNAL') {
      router.push('/dashboard')
    }
  }, [status, user?.role, router])

  // Fetch workload entries for Lodewijk
  const fetchWorkload = useCallback(async () => {
    try {
      const year = new Date().getFullYear()
      const res = await fetch(`/api/workload?year=${year}&personName=${encodeURIComponent(LODEWIJK.name)}`)
      if (res.ok) {
        const data = await res.json()
        setWorkloadEntries(data)
      }
    } catch {
      // Silently fail — weekoverzicht just won't show
    }
  }, [])

  // Fetch workload detail entries (uren per zaak) — laatste 4 weken
  const fetchWorkloadDetails = useCallback(async () => {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 28) // 4 weken terug
      const startStr = startDate.toISOString().slice(0, 10)
      const endStr = endDate.toISOString().slice(0, 10)
      const res = await fetch(
        `/api/workload-details?personName=${encodeURIComponent(LODEWIJK.name)}&startDate=${startStr}&endDate=${endStr}`
      )
      if (res.ok) {
        const data = await res.json()
        setWorkloadDetails(data)
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchWorkload()
      fetchWorkloadDetails()
      setIsLoading(false)
    }
  }, [status, fetchWorkload, fetchWorkloadDetails])

  // Current week actual hours from workload data
  const currentWeekActual = useMemo(() => {
    if (workloadEntries.length === 0) return null
    const { start, end } = getWeekBounds(0)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const weekEntries = workloadEntries.filter(e => e.date >= startStr && e.date <= endStr && e.hours)
    if (weekEntries.length === 0) return null
    return Math.round(weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0) * 10) / 10
  }, [workloadEntries])

  // Actieve zaken: unieke projecten uit laatste 2 weken
  const recentProjects = useMemo(() => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const cutoff = twoWeeksAgo.toISOString().slice(0, 10)
    const projects = new Set<string>()
    for (const d of workloadDetails) {
      if (d.date >= cutoff) projects.add(d.projectName)
    }
    return projects
  }, [workloadDetails])

  // Aggregatie: uren per zaak (project) uit workloadDetails
  const projectSummaries: ProjectSummary[] = useMemo(() => {
    if (workloadDetails.length === 0) return []

    const map = new Map<string, { totalBillable: number; totalWorked: number; dates: Set<string>; lastDate: string; details: WorkloadDetailEntry[] }>()

    for (const d of workloadDetails) {
      const existing = map.get(d.projectName)
      if (existing) {
        existing.totalBillable += d.billableHours
        existing.totalWorked += d.workedHours
        existing.dates.add(d.date)
        if (d.date > existing.lastDate) existing.lastDate = d.date
        existing.details.push(d)
      } else {
        map.set(d.projectName, {
          totalBillable: d.billableHours,
          totalWorked: d.workedHours,
          dates: new Set([d.date]),
          lastDate: d.date,
          details: [d],
        })
      }
    }

    return Array.from(map.entries())
      .map(([projectName, data]) => ({
        projectName,
        totalBillableHours: Math.round(data.totalBillable * 10) / 10,
        totalWorkedHours: Math.round(data.totalWorked * 10) / 10,
        daysActive: data.dates.size,
        lastDate: data.lastDate,
        details: data.details.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => b.totalBillableHours - a.totalBillableHours)
  }, [workloadDetails])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-workx-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  const photoUrl = getPhotoUrl(LODEWIJK.name)

  return (
    <div className="min-h-screen bg-workx-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Profile Card ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-workx-lime/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-workx-lime/30 shadow-lg shadow-workx-lime/10">
                  {photoUrl ? (
                    <Image src={photoUrl} alt={LODEWIJK.name} width={96} height={96} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center text-workx-dark text-2xl font-bold">
                      L
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-white">{LODEWIJK.name}</h1>
                <p className="text-white/40 text-sm mt-0.5">{LODEWIJK.subtitle}</p>

                {/* Rate cards */}
                <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Intern</p>
                    <p className="text-lg font-bold text-white">&euro;{LODEWIJK.internRate} <span className="text-xs text-white/40 font-normal">/uur</span></p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Extern</p>
                    <p className="text-lg font-bold text-white">&euro;{LODEWIJK.externRate} <span className="text-xs text-white/40 font-normal">/uur</span></p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Actieve zaken</p>
                    <p className="text-lg font-bold text-workx-lime">{recentProjects.size}</p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Uren/week</p>
                    <p className="text-lg font-bold text-white">
                      {currentWeekActual !== null ? currentWeekActual : '–'}
                    </p>
                  </div>
                </div>

                {/* Workload bar */}
                <div className="mt-4 max-w-md">
                  {currentWeekActual !== null && <WorkloadBar hours={currentWeekActual} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Weekly Hours Overview ─────────────────────────────────── */}
        <WeeklyHoursOverview entries={workloadEntries} />

        {/* ── Uren per zaak (uit upload) ─────────────────────────────── */}
        <CasesFromUpload summaries={projectSummaries} />

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <Icons.alertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-white/5 rounded">
              <Icons.x size={14} />
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
