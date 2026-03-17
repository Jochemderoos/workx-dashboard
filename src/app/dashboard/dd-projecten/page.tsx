'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'

interface Member {
  id: string
  userId: string
  role: string
  hours: number
  user: { id: string; name: string; role: string }
}

interface Project {
  id: string
  name: string
  client: string
  description: string | null
  status: string
  completedAt: string | null
  createdAt: string
  members: Member[]
}

interface TeamMember {
  id: string
  name: string
  role: string
}

interface WorkloadEntry {
  personName: string
  projectName: string
  date: string
  billableHours: number
  workedHours: number
}

interface DDCase {
  projectName: string
  fullProjectName: string
  totalHours: number
  hours7d: number // last 7 days
  members: { personName: string; hours: number; hours7d: number }[]
  linkedProject?: Project
}

const DD_CLIENTS = ['De Breij', 'Stek', 'JB Law', 'Strasuwolfs']

const CLIENT_COLORS: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  'De Breij': { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  'Stek': { dot: 'bg-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'JB Law': { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'Strasuwolfs': { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

const MEMBER_COLORS = [
  'from-blue-500 to-blue-400',
  'from-purple-500 to-purple-400',
  'from-orange-500 to-orange-400',
  'from-emerald-500 to-emerald-400',
  'from-pink-500 to-pink-400',
  'from-cyan-500 to-cyan-400',
  'from-amber-500 to-amber-400',
  'from-indigo-500 to-indigo-400',
]

export default function DDProjectenPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [workloadData, setWorkloadData] = useState<WorkloadEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] as string[] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role

  const fetchAll = useCallback(async () => {
    try {
      const [projRes, teamRes, wlRes] = await Promise.all([
        fetch('/api/dd-projecten'),
        fetch('/api/claude/users'),
        fetch('/api/workload/details?weeks=4'),
      ])
      if (projRes.ok) setProjects(await projRes.json())
      if (teamRes.ok) {
        const users = await teamRes.json()
        setTeamMembers(users.filter((u: TeamMember) => u.role !== 'EXTERNAL'))
      }
      if (wlRes.ok) setWorkloadData(await wlRes.json())
    } catch {
      toast.error('Kon gegevens niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Process workload data into DD structures with time-based grouping ───
  const { clientGroups, teamOverview, stats, unmatchedManualProjects } = useMemo(() => {
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Group workload entries by projectName, filter for DD clients, track time buckets
    const projectMap = new Map<string, {
      client: string
      members: Map<string, { total: number; h7d: number }>
      totalHours: number
      hours7d: number
      hours14d: number
    }>()

    for (const entry of workloadData) {
      const client = DD_CLIENTS.find(c => entry.projectName.toLowerCase().includes(c.toLowerCase()))
      if (!client) continue
      const hours = entry.workedHours || entry.billableHours || 0
      if (hours <= 0) continue

      if (!projectMap.has(entry.projectName)) {
        projectMap.set(entry.projectName, { client, members: new Map(), totalHours: 0, hours7d: 0, hours14d: 0 })
      }
      const proj = projectMap.get(entry.projectName)!
      proj.totalHours += hours
      if (entry.date >= d7) proj.hours7d += hours
      if (entry.date >= d14) proj.hours14d += hours

      const mem = proj.members.get(entry.personName) || { total: 0, h7d: 0 }
      mem.total += hours
      if (entry.date >= d7) mem.h7d += hours
      proj.members.set(entry.personName, mem)
    }

    // Build cases per client + link manual DDProjects
    const groups = new Map<string, DDCase[]>()
    const matchedProjectIds = new Set<string>()

    for (const [fullName, data] of Array.from(projectMap.entries())) {
      const cleanName = fullName.includes('/') ? fullName.split('/').slice(1).join('/').trim() : fullName
      const members = Array.from(data.members.entries())
        .map(([name, m]) => ({ personName: name, hours: Math.round(m.total * 10) / 10, hours7d: Math.round(m.h7d * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
      const totalHours = Math.round(data.totalHours * 10) / 10
      const hours7d = Math.round(data.hours7d * 10) / 10

      let linkedProject: Project | undefined
      for (const p of projects) {
        if (p.status === 'afgerond') continue
        const matchesName = fullName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(cleanName.toLowerCase())
        const matchesClient = fullName.toLowerCase().includes(p.client.toLowerCase())
        if (matchesName || matchesClient) {
          linkedProject = p
          matchedProjectIds.add(p.id)
          break
        }
      }

      if (!groups.has(data.client)) groups.set(data.client, [])
      groups.get(data.client)!.push({ projectName: cleanName, fullProjectName: fullName, totalHours, hours7d, members, linkedProject })
    }

    // Sort cases: most recently active first (by hours7d desc, then totalHours)
    for (const cases of Array.from(groups.values())) {
      cases.sort((a, b) => b.hours7d - a.hours7d || b.totalHours - a.totalHours)
    }

    // Team overview: aggregate per person with time buckets
    const personMap = new Map<string, { total: number; h7d: number; h14d: number }>()
    for (const entry of workloadData) {
      const client = DD_CLIENTS.find(c => entry.projectName.toLowerCase().includes(c.toLowerCase()))
      if (!client) continue
      const hours = entry.workedHours || entry.billableHours || 0
      if (hours <= 0) continue
      const mem = personMap.get(entry.personName) || { total: 0, h7d: 0, h14d: 0 }
      mem.total += hours
      if (entry.date >= d7) mem.h7d += hours
      if (entry.date >= d14) mem.h14d += hours
      personMap.set(entry.personName, mem)
    }
    const team = Array.from(personMap.entries())
      .map(([name, m]) => ({ personName: name, totalHours: Math.round(m.total * 10) / 10, hours7d: Math.round(m.h7d * 10) / 10, hours14d: Math.round(m.h14d * 10) / 10 }))
      .sort((a, b) => b.hours7d - a.hours7d || b.totalHours - a.totalHours)

    // Stats
    const totalHours = Math.round(team.reduce((s, m) => s + m.totalHours, 0) * 10) / 10
    const totalHours7d = Math.round(team.reduce((s, m) => s + m.hours7d, 0) * 10) / 10
    let totalCases = 0
    for (const cases of Array.from(groups.values())) totalCases += cases.length

    // Unmatched manual projects (not linked to any werkdruk case)
    const unmatched = projects.filter(p => !matchedProjectIds.has(p.id) && p.status !== 'afgerond')

    return { clientGroups: groups, teamOverview: team, stats: { totalHours, totalHours7d, totalCases, teamCount: team.length }, unmatchedManualProjects: unmatched }
  }, [workloadData, projects])

  // ─── CRUD handlers ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.client.trim()) return
    try {
      if (editingProject) {
        const res = await fetch('/api/dd-projecten', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProject.id, ...form }),
        })
        if (!res.ok) throw new Error()
        toast.success('Project bijgewerkt')
      } else {
        const res = await fetch('/api/dd-projecten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success('Project aangemaakt')
      }
      resetForm()
      fetchAll()
    } catch {
      toast.error('Kon project niet opslaan')
    }
  }

  const toggleProjectStatus = async (project: Project) => {
    const nextStatus = project.status === 'actief' ? 'afgerond' : 'actief'
    try {
      await fetch('/api/dd-projecten', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, status: nextStatus }),
      })
      fetchAll()
      if (nextStatus === 'afgerond') toast.success('Project afgerond!')
    } catch {
      toast.error('Kon status niet bijwerken')
    }
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit project wilt verwijderen?')) return
    try {
      await fetch(`/api/dd-projecten?id=${id}`, { method: 'DELETE' })
      toast.success('Project verwijderd')
      fetchAll()
    } catch {
      toast.error('Kon project niet verwijderen')
    }
  }

  const startEdit = (project: Project) => {
    setEditingProject(project)
    setForm({
      name: project.name,
      client: project.client,
      description: project.description || '',
      memberIds: project.members.map(m => m.userId),
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] })
    setShowForm(false)
    setEditingProject(null)
  }

  const completedProjects = projects.filter(p => p.status === 'afgerond')

  // ─── Role check ───
  if (!loading && userRole && userRole !== 'PARTNER' && userRole !== 'ADMIN') {
    return (
      <div className="max-w-5xl mx-auto fade-in">
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Geen toegang</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>DD Projecten is alleen beschikbaar voor partners en kantoormanagement.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: '#f9ff85' }} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.briefcase size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>DD Projecten</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Afgelopen 4 weken — automatisch bijgewerkt op basis van werkdruk</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 transition-colors" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Icons.clock size={18} className="text-workx-lime" />
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Uren (7 dagen)</span>
          </div>
          <p className="text-2xl font-semibold text-workx-lime">{Math.round(stats.totalHours7d).toLocaleString('nl-NL')}</p>
        </div>
        <div className="rounded-xl border p-4 transition-colors" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Icons.clock size={18} style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Uren (4 weken)</span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{Math.round(stats.totalHours).toLocaleString('nl-NL')}</p>
        </div>
        <div className="rounded-xl border p-4 transition-colors" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Icons.briefcase size={18} className="text-blue-400" />
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Actieve zaken</span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{stats.totalCases}</p>
        </div>
        <div className="rounded-xl border p-4 transition-colors" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Icons.users size={18} className="text-purple-400" />
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Teamleden</span>
          </div>
          <p className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{stats.teamCount}</p>
        </div>
      </div>

      {/* ─── Team Overzicht ─── */}
      {teamOverview.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Icons.users size={16} className="text-workx-lime" />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Team overzicht</h2>
          </div>
          <div className="space-y-3">
            {teamOverview.map((member, i) => {
              const max7d = teamOverview[0]?.hours7d || 1
              const barWidth = max7d > 0 ? (member.hours7d / max7d) * 100 : 0
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length]
              const photo = getPhotoUrl(member.personName)
              return (
                <div key={member.personName} className="flex items-center gap-3">
                  {photo ? (
                    <Image src={photo} alt={member.personName} width={32} height={32} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-medium text-white">{member.personName.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium w-40 truncate flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{member.personName}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono tabular-nums w-12 text-right font-semibold" style={{ color: member.hours7d > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{member.hours7d}u</span>
                    <span className="text-[10px] font-mono tabular-nums w-12 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{member.totalHours}u tot</span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] mt-3" style={{ color: 'var(--color-text-tertiary)' }}>Balk en vetgedrukte uren = afgelopen 7 dagen · &quot;tot&quot; = totaal 4 weken</p>
        </div>
      )}

      {/* ─── Per-client sections ─── */}
      {DD_CLIENTS.filter(c => clientGroups.has(c)).map(client => {
        const cases = clientGroups.get(client)!
        const client7dHours = Math.round(cases.reduce((s, c) => s + c.hours7d, 0) * 10) / 10
        const clientTotalHours = Math.round(cases.reduce((s, c) => s + c.totalHours, 0) * 10) / 10
        const cc = CLIENT_COLORS[client] || CLIENT_COLORS['De Breij']

        // Find max 7d hours across ALL clients for relative bar sizing
        const allCases = DD_CLIENTS.filter(c => clientGroups.has(c)).flatMap(c => clientGroups.get(c)!)
        const max7dHours = Math.max(...allCases.map(c => c.hours7d), 1)

        // Split cases by recency
        const recent7d = cases.filter(c => c.hours7d > 0)
        const older = cases.filter(c => c.hours7d === 0)

        return (
          <div key={client} className="space-y-3">
            {/* Client header */}
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>{client}</h2>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {cases.length} {cases.length === 1 ? 'zaak' : 'zaken'} · {client7dHours}u (7d) · {clientTotalHours}u totaal
              </span>
            </div>

            {/* Recent cases (7 days) */}
            {recent7d.length > 0 && (
              <div className="space-y-2">
                {recent7d.map((c, i) => {
                  const key = `${client}-${i}`
                  const isExpanded = expandedKey === key
                  const activityBar = (c.hours7d / max7dHours) * 100
                  return (
                    <div key={c.fullProjectName} className={`rounded-2xl border overflow-hidden transition-all ${
                      isExpanded ? `${cc.border} ${cc.bg} shadow-lg` : 'hover:shadow-md'
                    }`} style={!isExpanded ? { borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' } : undefined}>
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left group"
                      >
                        {/* Rank badge */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cc.bg}`}>
                          <span className={`text-xs font-bold ${cc.text}`}>{i + 1}</span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold tracking-tight truncate" style={{ color: 'var(--color-text-primary)' }}>{c.projectName}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold tabular-nums ${cc.bg} ${cc.text}`}>{c.hours7d}u 7d</span>
                              <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{c.totalHours}u tot</span>
                              <div className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                <Icons.users size={12} />
                                <span className="text-xs">{c.members.length}</span>
                              </div>
                            </div>
                          </div>
                          {/* Activity bar: shows relative intensity vs other DD projects (7d) */}
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                            <div className={`h-full rounded-full bg-gradient-to-r from-workx-lime to-workx-lime/60 transition-all duration-700`} style={{ width: `${activityBar}%` }} />
                          </div>
                        </div>

                        <div className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                          <Icons.chevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <div className="ml-[46px] space-y-2">
                            {c.members.map((m, mi) => {
                              const memberBarWidth = c.totalHours > 0 ? (m.hours / c.totalHours) * 100 : 0
                              const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
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
                                  <span className="text-sm w-36 truncate flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{m.personName}</span>
                                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                                    <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${memberBarWidth}%` }} />
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-xs font-mono w-10 text-right font-semibold" style={{ color: m.hours7d > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{m.hours7d}u</span>
                                    <span className="text-[10px] font-mono w-10 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{m.hours}u</span>
                                  </div>
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
            )}

            {/* Older cases (no hours in 7 days, but hours in 4 weeks) */}
            {older.length > 0 && (
              <div className="space-y-2">
                {recent7d.length > 0 && (
                  <p className="text-[10px] uppercase tracking-wider font-medium mt-2" style={{ color: 'var(--color-text-tertiary)' }}>Eerder (geen uren afgelopen 7 dagen)</p>
                )}
                {older.map((c, i) => {
                  const key = `${client}-older-${i}`
                  const isExpanded = expandedKey === key
                  return (
                    <div key={c.fullProjectName} className="rounded-2xl border overflow-hidden transition-all opacity-60 hover:opacity-80" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                        className="w-full flex items-center gap-3.5 px-4 py-3 text-left"
                      >
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-bg-tertiary)' }}>
                          <Icons.briefcase size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{c.projectName}</span>
                            <span className="text-[10px] font-mono tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{c.totalHours}u</span>
                          </div>
                        </div>
                        <div className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                          <Icons.chevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <div className="ml-[38px] space-y-1.5">
                            {c.members.map((m, mi) => {
                              const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                              const photo = getPhotoUrl(m.personName)
                              return (
                                <div key={m.personName} className="flex items-center gap-2">
                                  {photo ? (
                                    <Image src={photo} alt={m.personName} width={22} height={22} className="w-[22px] h-[22px] rounded object-cover flex-shrink-0" />
                                  ) : (
                                    <div className={`w-[22px] h-[22px] rounded bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                                      <span className="text-[9px] font-medium text-white">{m.personName.charAt(0)}</span>
                                    </div>
                                  )}
                                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{m.personName}</span>
                                  <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{m.hours}u</span>
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
            )}
          </div>
        )
      })}

      {/* Empty state when no werkdruk data */}
      {stats.totalCases === 0 && unmatchedManualProjects.length === 0 && (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.briefcase className="text-blue-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Nog geen DD zaken</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Er zijn geen uren gevonden voor DD-clients in de afgelopen 4 weken. Upload werkdruk data of voeg handmatig een project toe.</p>
        </div>
      )}

      {/* ─── Handmatig toegevoegd ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-workx-lime" />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              Handmatig toegevoegd
            </h2>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingProject(null); setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] }) }}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Icons.plus size={14} />
            Nieuw project
          </button>
        </div>

        {unmatchedManualProjects.length > 0 ? (
          <div className="space-y-2">
            {unmatchedManualProjects.map(project => {
              const cc = CLIENT_COLORS[project.client] || CLIENT_COLORS['De Breij']
              const key = `manual-${project.id}`
              const isExpanded = expandedKey === key
              return (
                <div key={project.id} className={`rounded-2xl border overflow-hidden transition-all ${
                  isExpanded ? `${cc.border} ${cc.bg}` : 'hover:shadow-md'
                }`} style={!isExpanded ? { borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' } : undefined}>
                  <div className="flex items-center gap-3.5 px-4 py-3.5">
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      className="flex items-center gap-3.5 flex-1 min-w-0 text-left"
                    >
                      <div className={`w-8 h-8 rounded-xl ${cc.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icons.briefcase size={14} className={cc.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{project.name}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${cc.bg} ${cc.text}`}>{project.client}</span>
                        </div>
                        {project.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        <Icons.users size={12} />
                        <span className="text-xs">{project.members.length}</span>
                      </div>
                      <div className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                        <Icons.chevronDown size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleProjectStatus(project)} className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10" title="Markeer als afgerond">
                        <Icons.check size={15} className="text-emerald-400" />
                      </button>
                      <button onClick={() => startEdit(project)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} title="Bewerken">
                        <Icons.edit size={14} />
                      </button>
                      <button onClick={() => deleteProject(project.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors" title="Verwijderen">
                        <Icons.trash size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && project.members.length > 0 && (
                    <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="ml-[46px] space-y-2">
                        {project.members.map((m, mi) => {
                          const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                          const photo = getPhotoUrl(m.user.name)
                          return (
                            <div key={m.id} className="flex items-center gap-3">
                              {photo ? (
                                <Image src={photo} alt={m.user.name} width={28} height={28} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-[11px] font-medium text-white">{m.user.name.charAt(0)}</span>
                                </div>
                              )}
                              <span className="text-sm flex-1" style={{ color: 'var(--color-text-secondary)' }}>{m.user.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                                {m.role === 'partner' ? 'Partner' : 'Medewerker'}
                              </span>
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
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Nog geen handmatige projecten. Klik op &quot;Nieuw project&quot; om een zaak toe te voegen met teamtoewijzing.
            </p>
          </div>
        )}
      </div>

      {/* ─── Afgeronde projecten ─── */}
      {completedProjects.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedKey(expandedKey === 'completed-section' ? null : 'completed-section')}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Icons.chevronRight size={14} className={`transition-transform ${expandedKey === 'completed-section' ? 'rotate-90' : ''}`} />
            Afgerond ({completedProjects.length})
          </button>
          {expandedKey === 'completed-section' && (
            <div className="space-y-2 opacity-60">
              {completedProjects.map(project => {
                const cc = CLIENT_COLORS[project.client] || CLIENT_COLORS['De Breij']
                return (
                  <div key={project.id} className="rounded-xl border group" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className={`w-8 h-8 rounded-lg ${cc.bg} flex items-center justify-center`}>
                        <Icons.check size={14} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-through" style={{ color: 'var(--color-text-tertiary)' }}>{project.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          <span className={cc.text}>{project.client}</span>
                          {project.completedAt && (
                            <span>Afgerond {new Date(project.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleProjectStatus(project)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} title="Heropen">
                          <Icons.arrowRight size={14} />
                        </button>
                        <button onClick={() => deleteProject(project.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors">
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Form Modal ─── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="card p-6 w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {editingProject ? 'Project bewerken' : 'Nieuw DD Project'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Projectnaam *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="Bijv. Castellum - Project Eurohill"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Client *</label>
                <div className="flex flex-wrap gap-2">
                  {DD_CLIENTS.map(c => {
                    const cc = CLIENT_COLORS[c] || CLIENT_COLORS['De Breij']
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, client: c })}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                          form.client === c
                            ? `${cc.bg} ${cc.text} ${cc.border}`
                            : 'border-transparent'
                        }`}
                        style={{
                          background: form.client === c ? undefined : 'var(--color-bg-tertiary)',
                          color: form.client === c ? undefined : 'var(--color-text-tertiary)',
                        }}
                      >
                        {c}
                      </button>
                    )
                  })}
                  <input
                    type="text"
                    value={DD_CLIENTS.includes(form.client) ? '' : form.client}
                    onChange={e => setForm({ ...form, client: e.target.value })}
                    className="input-field flex-1 min-w-[100px]"
                    placeholder="Anders..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Beschrijving</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Korte omschrijving van het DD project"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Teamleden</label>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map(m => {
                    const photo = getPhotoUrl(m.name)
                    const isSelected = form.memberIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setForm(f => ({
                            ...f,
                            memberIds: f.memberIds.includes(m.id)
                              ? f.memberIds.filter(id => id !== m.id)
                              : [...f.memberIds, m.id],
                          }))
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isSelected
                            ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30'
                            : 'border-transparent'
                        }`}
                        style={{
                          background: isSelected ? undefined : 'var(--color-bg-tertiary)',
                          color: isSelected ? undefined : 'var(--color-text-tertiary)',
                        }}
                      >
                        {photo ? (
                          <Image src={photo} alt={m.name} width={18} height={18} className="w-[18px] h-[18px] rounded object-cover" />
                        ) : null}
                        {m.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingProject ? 'Opslaan' : 'Aanmaken'}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
