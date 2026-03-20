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
  expectedHours: number | null
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

interface DDEstimate {
  id: string
  projectName: string
  expectedHours: number
  extraMembers: string | null // JSON array of member names
}

interface DDCase {
  projectName: string
  fullProjectName: string
  totalHours: number
  hours7d: number
  memberNames: string[] // Only names, no hours
  linkedProject?: Project
  expectedHours?: number
}

const DD_CLIENTS = ['De Breij', 'Stek', 'JB Law', 'Strauswolfs', 'Cleber']

// Map variations in project names to canonical client names
const CLIENT_ALIASES: Record<string, string> = {
  'debreij': 'De Breij',
  'de breij': 'De Breij',
  'stek': 'Stek',
  'jb law': 'JB Law',
  'strauswolfs': 'Strauswolfs',
  'strasuwolfs': 'Strauswolfs',
  'cleber': 'Cleber',
}

function matchDDClient(projectName: string): string | undefined {
  const lower = projectName.toLowerCase()
  for (const [alias, client] of Object.entries(CLIENT_ALIASES)) {
    if (lower.includes(alias)) return client
  }
  return undefined
}

const CLIENT_COLORS: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  'De Breij': { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  'Stek': { dot: 'bg-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'JB Law': { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'Strauswolfs': { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'Cleber': { dot: 'bg-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
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
  const [estimates, setEstimates] = useState<DDEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingEstimate, setEditingEstimate] = useState<string | null>(null) // fullProjectName being edited
  const [estimateInput, setEstimateInput] = useState('')
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null) // fullProjectName for member picker
  const [form, setForm] = useState({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] as string[], expectedHours: '' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role

  const fetchAll = useCallback(async () => {
    try {
      const [projRes, teamRes, wlRes, estRes] = await Promise.all([
        fetch('/api/dd-projecten'),
        fetch('/api/claude/users'),
        fetch('/api/workload/details?weeks=4'),
        fetch('/api/dd-projecten/estimates'),
      ])
      if (projRes.ok) setProjects(await projRes.json())
      if (teamRes.ok) {
        const users = await teamRes.json()
        setTeamMembers(users.filter((u: TeamMember) => u.role !== 'EXTERNAL'))
      }
      if (wlRes.ok) setWorkloadData(await wlRes.json())
      if (estRes.ok) setEstimates(await estRes.json())
    } catch {
      toast.error('Kon gegevens niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Process workload data into DD structures ───
  const { clientGroups, stats, unmatchedManualProjects } = useMemo(() => {
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Group workload entries by projectName, filter for DD clients
    const projectMap = new Map<string, {
      client: string
      members: Set<string>
      totalHours: number
      hours7d: number
    }>()

    for (const entry of workloadData) {
      const client = matchDDClient(entry.projectName)
      if (!client) continue
      const hours = entry.workedHours || entry.billableHours || 0
      if (hours <= 0) continue

      if (!projectMap.has(entry.projectName)) {
        projectMap.set(entry.projectName, { client, members: new Set(), totalHours: 0, hours7d: 0 })
      }
      const proj = projectMap.get(entry.projectName)!
      proj.totalHours += hours
      if (entry.date >= d7) proj.hours7d += hours
      proj.members.add(entry.personName)
    }

    // Build estimate lookup (expectedHours + extraMembers)
    const estimateMap = new Map<string, { expectedHours: number; extraMembers: string[] }>()
    for (const est of estimates) {
      let extra: string[] = []
      if (est.extraMembers) {
        try { extra = JSON.parse(est.extraMembers) } catch { /* ignore */ }
      }
      estimateMap.set(est.projectName, { expectedHours: est.expectedHours, extraMembers: extra })
    }

    // Build cases per client + link manual DDProjects
    const groups = new Map<string, DDCase[]>()
    const matchedProjectIds = new Set<string>()

    for (const [fullName, data] of Array.from(projectMap.entries())) {
      const cleanName = fullName.includes('/') ? fullName.split('/').slice(1).join('/').trim() : fullName
      const workloadMembers = Array.from(data.members)
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

      const est = estimateMap.get(fullName)
      const expectedHours = linkedProject?.expectedHours ?? est?.expectedHours ?? undefined
      // Merge workload members + manually added extra members (deduplicated)
      const extraMembers = est?.extraMembers || []
      const memberNames = [...workloadMembers, ...extraMembers.filter(n => !workloadMembers.includes(n))]

      if (!groups.has(data.client)) groups.set(data.client, [])
      groups.get(data.client)!.push({ projectName: cleanName, fullProjectName: fullName, totalHours, hours7d, memberNames, linkedProject, expectedHours })
    }

    // Sort cases: most recently active first
    for (const cases of Array.from(groups.values())) {
      cases.sort((a, b) => b.hours7d - a.hours7d || b.totalHours - a.totalHours)
    }

    // Stats
    let totalHours = 0
    let totalHours7d = 0
    let totalCases = 0
    const allMembers = new Set<string>()
    for (const cases of Array.from(groups.values())) {
      totalCases += cases.length
      for (const c of cases) {
        totalHours += c.totalHours
        totalHours7d += c.hours7d
        c.memberNames.forEach(n => allMembers.add(n))
      }
    }

    const unmatched = projects.filter(p => !matchedProjectIds.has(p.id) && p.status !== 'afgerond')

    return {
      clientGroups: groups,
      stats: { totalHours: Math.round(totalHours * 10) / 10, totalHours7d: Math.round(totalHours7d * 10) / 10, totalCases, teamCount: allMembers.size },
      unmatchedManualProjects: unmatched,
    }
  }, [workloadData, projects, estimates])

  // ─── CRUD handlers ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.client.trim()) return
    try {
      const payload = { ...form, expectedHours: form.expectedHours ? parseFloat(form.expectedHours) : null }
      if (editingProject) {
        const res = await fetch('/api/dd-projecten', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProject.id, ...payload }),
        })
        if (!res.ok) throw new Error()
        toast.success('Project bijgewerkt')
      } else {
        const res = await fetch('/api/dd-projecten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
      expectedHours: project.expectedHours?.toString() || '',
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [], expectedHours: '' })
    setShowForm(false)
    setEditingProject(null)
  }

  const saveEstimate = async (projectName: string, hours: number) => {
    try {
      await fetch('/api/dd-projecten/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, expectedHours: hours }),
      })
      setEstimates(prev => {
        const existing = prev.find(e => e.projectName === projectName)
        if (existing) return prev.map(e => e.projectName === projectName ? { ...e, expectedHours: hours } : e)
        return [...prev, { id: '', projectName, expectedHours: hours, extraMembers: null }]
      })
      setEditingEstimate(null)
      toast.success('Verwachte uren opgeslagen')
    } catch {
      toast.error('Kon verwachte uren niet opslaan')
    }
  }

  const toggleExtraMember = async (projectName: string, memberName: string, currentMembers: string[]) => {
    const est = estimates.find(e => e.projectName === projectName)
    let extraMembers: string[] = []
    if (est?.extraMembers) {
      try { extraMembers = JSON.parse(est.extraMembers) } catch { /* ignore */ }
    }

    if (extraMembers.includes(memberName)) {
      extraMembers = extraMembers.filter(n => n !== memberName)
    } else {
      // Only add if not already in workload members
      if (!currentMembers.includes(memberName)) {
        extraMembers.push(memberName)
      }
    }

    try {
      const res = await fetch('/api/dd-projecten/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, extraMembers }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEstimates(prev => {
          const exists = prev.find(e => e.projectName === projectName)
          if (exists) return prev.map(e => e.projectName === projectName ? updated : e)
          return [...prev, updated]
        })
      }
    } catch {
      toast.error('Kon teamlid niet bijwerken')
    }
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

      {/* ─── Per-client sections ─── */}
      {DD_CLIENTS.filter(c => clientGroups.has(c)).map(client => {
        const cases = clientGroups.get(client)!
        const clientTotalHours = Math.round(cases.reduce((s, c) => s + c.totalHours, 0) * 10) / 10
        const cc = CLIENT_COLORS[client] || CLIENT_COLORS['De Breij']

        // Find max 7d hours across ALL clients for relative bar sizing
        const allCases = DD_CLIENTS.filter(c => clientGroups.has(c)).flatMap(c => clientGroups.get(c)!)
        const max7dHours = Math.max(...allCases.map(c => c.hours7d), 1)

        // Split cases by recency
        const recent7d = cases.filter(c => c.hours7d > 0)
        const older = cases.filter(c => c.hours7d === 0)

        const renderCase = (c: DDCase, i: number, dimmed?: boolean) => {
          const activityBar = max7dHours > 0 ? (c.hours7d / max7dHours) * 100 : 0
          const progressPct = c.expectedHours && c.expectedHours > 0 ? Math.min(100, (c.totalHours / c.expectedHours) * 100) : null
          const isEditingEst = editingEstimate === c.fullProjectName

          return (
            <div key={c.fullProjectName} className={`rounded-2xl border overflow-hidden transition-all ${dimmed ? 'opacity-60 hover:opacity-80' : 'hover:shadow-md'}`} style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <div className="px-4 py-3.5 space-y-2.5">
                {/* Top row: rank + name + hours */}
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cc.bg}`}>
                    <span className={`text-[11px] font-bold ${cc.text}`}>{i + 1}</span>
                  </div>
                  <span className="text-[13px] font-semibold tracking-tight truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>{c.projectName}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.hours7d > 0 && (
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold tabular-nums ${cc.bg} ${cc.text}`}>{c.hours7d}u 7d</span>
                    )}
                    <span className="text-xs font-mono tabular-nums font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.totalHours}u</span>
                  </div>
                </div>

                {/* Progress bar (if expected hours set) */}
                {progressPct !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <div className={`h-full rounded-full transition-all duration-700 ${progressPct >= 90 ? 'bg-gradient-to-r from-red-500 to-orange-500' : progressPct >= 70 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-gradient-to-r from-workx-lime to-emerald-400'}`} style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                      {Math.round(progressPct)}% van {c.expectedHours}u
                    </span>
                  </div>
                )}

                {/* Activity bar (7d intensity, only if no progress bar and has 7d hours) */}
                {progressPct === null && c.hours7d > 0 && !dimmed && (
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className="h-full rounded-full bg-gradient-to-r from-workx-lime to-workx-lime/60 transition-all duration-700" style={{ width: `${activityBar}%` }} />
                  </div>
                )}

                {/* Team photos + add member + set expected hours */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 relative">
                    {c.memberNames.map((name, mi) => {
                      const photo = getPhotoUrl(name)
                      const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                      return (
                        <div key={name} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                          {photo ? (
                            <Image src={photo} alt={name} width={22} height={22} className="w-[22px] h-[22px] rounded-md object-cover" />
                          ) : (
                            <div className={`w-[22px] h-[22px] rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}>
                              <span className="text-[9px] font-medium text-white">{name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{name.split(' ')[0]}</span>
                        </div>
                      )
                    })}
                    {/* Add member button */}
                    <button
                      onClick={() => setAddingMemberTo(addingMemberTo === c.fullProjectName ? null : c.fullProjectName)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors border border-dashed"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
                      title="Teamlid toevoegen"
                    >
                      <Icons.plus size={12} />
                    </button>
                    {/* Member picker dropdown */}
                    {addingMemberTo === c.fullProjectName && (
                      <div className="absolute top-8 left-0 z-20 rounded-xl border shadow-xl p-2 min-w-[200px] max-h-60 overflow-y-auto" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        {teamMembers.map(u => {
                          const alreadyIn = c.memberNames.includes(u.name)
                          const photo = getPhotoUrl(u.name)
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleExtraMember(c.fullProjectName, u.name, c.memberNames)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${alreadyIn ? 'opacity-50' : 'hover:opacity-80'}`}
                              style={{ background: alreadyIn ? 'var(--color-bg-tertiary)' : 'transparent', color: 'var(--color-text-primary)' }}
                              disabled={alreadyIn}
                            >
                              {photo ? (
                                <Image src={photo} alt={u.name} width={20} height={20} className="w-5 h-5 rounded-lg object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-[9px] font-medium text-white">{u.name.charAt(0)}</span>
                                </div>
                              )}
                              <span>{u.name}</span>
                              {alreadyIn && <Icons.check size={12} className="ml-auto text-workx-lime" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {/* Expected hours inline edit */}
                  {isEditingEst ? (
                    <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); const h = parseFloat(estimateInput); if (h > 0) saveEstimate(c.fullProjectName, h) }}>
                      <input
                        type="number"
                        value={estimateInput}
                        onChange={e => setEstimateInput(e.target.value)}
                        className="w-16 text-xs px-2 py-1 rounded-lg border text-right"
                        style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                        placeholder="uren"
                        autoFocus
                        min="0"
                        step="1"
                      />
                      <button type="submit" className="text-workx-lime"><Icons.check size={14} /></button>
                      <button type="button" onClick={() => setEditingEstimate(null)} style={{ color: 'var(--color-text-tertiary)' }}><Icons.x size={14} /></button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setEditingEstimate(c.fullProjectName); setEstimateInput(c.expectedHours?.toString() || '') }}
                      className="text-[10px] px-2 py-0.5 rounded-lg transition-colors hover:opacity-80"
                      style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
                      title="Verwachte uren instellen"
                    >
                      {c.expectedHours ? `${c.expectedHours}u verwacht` : 'Uren instellen'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        }

        return (
          <div key={client} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>{client}</h2>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {cases.length} {cases.length === 1 ? 'zaak' : 'zaken'} · {clientTotalHours}u totaal
              </span>
            </div>

            <div className="space-y-2">
              {recent7d.map((c, i) => renderCase(c, i))}
              {older.length > 0 && recent7d.length > 0 && (
                <p className="text-[10px] uppercase tracking-wider font-medium mt-2" style={{ color: 'var(--color-text-tertiary)' }}>Eerder (geen uren afgelopen 7 dagen)</p>
              )}
              {older.map((c, i) => renderCase(c, recent7d.length + i, true))}
            </div>
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
            onClick={() => { setShowForm(true); setEditingProject(null); setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [], expectedHours: '' }) }}
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
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
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
                    </div>
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

                  {project.members.length > 0 && (
                    <div className="px-4 pb-3 pt-1">
                      <div className="ml-[46px] flex flex-wrap gap-2">
                        {project.members.map((m, mi) => {
                          const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                          const photo = getPhotoUrl(m.user.name)
                          return (
                            <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                              {photo ? (
                                <Image src={photo} alt={m.user.name} width={24} height={24} className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                              ) : (
                                <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-[9px] font-medium text-white">{m.user.name.charAt(0)}</span>
                                </div>
                              )}
                              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{m.user.name}</span>
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
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Verwachte uren</label>
                <input
                  type="number"
                  value={form.expectedHours}
                  onChange={e => setForm({ ...form, expectedHours: e.target.value })}
                  className="input-field"
                  placeholder="Bijv. 100"
                  min="0"
                  step="1"
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
