'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
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
  // From workload auto-detection
  autoHours?: Record<string, number> // personName -> hours
  autoMembers?: string[]
}

interface TeamMember {
  id: string
  name: string
  role: string
}

interface WorkloadEntry {
  personName: string
  projectName: string
  billableHours: number
  workedHours: number
}

const DD_CLIENTS = ['De Breij', 'Stek', 'JB Law', 'Strasuwolfs']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  actief: { label: 'Actief', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  on_hold: { label: 'On Hold', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  afgerond: { label: 'Afgerond', color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' },
}

const CLIENT_COLORS: Record<string, { from: string; to: string; text: string; icon: string }> = {
  'De Breij': { from: 'from-blue-500/15', to: 'to-cyan-500/10', text: 'text-blue-400', icon: 'bg-blue-500/15' },
  'Stek': { from: 'from-purple-500/15', to: 'to-indigo-500/10', text: 'text-purple-400', icon: 'bg-purple-500/15' },
  'JB Law': { from: 'from-amber-500/15', to: 'to-orange-500/10', text: 'text-amber-400', icon: 'bg-amber-500/15' },
  'Strasuwolfs': { from: 'from-emerald-500/15', to: 'to-teal-500/10', text: 'text-emerald-400', icon: 'bg-emerald-500/15' },
}

export default function DDProjectenPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [workloadData, setWorkloadData] = useState<WorkloadEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
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

  // Auto-detect DD projects from workload data
  const autoDetectedProjects = useMemo(() => {
    const projectMap = new Map<string, { personName: string; hours: number }[]>()
    for (const entry of workloadData) {
      const pn = entry.projectName.toLowerCase()
      const isDD = DD_CLIENTS.some(c => pn.includes(c.toLowerCase()))
      if (!isDD) continue

      if (!projectMap.has(entry.projectName)) {
        projectMap.set(entry.projectName, [])
      }
      const existing = projectMap.get(entry.projectName)!.find(e => e.personName === entry.personName)
      if (existing) {
        existing.hours += entry.workedHours || entry.billableHours || 0
      } else {
        projectMap.get(entry.projectName)!.push({
          personName: entry.personName,
          hours: entry.workedHours || entry.billableHours || 0,
        })
      }
    }
    return projectMap
  }, [workloadData])

  // Merge auto-detected hours into projects + create virtual projects for unmatched workload entries
  const { enrichedProjects, autoOnlyProjects } = useMemo(() => {
    const matchedAutoKeys = new Set<string>()

    const enriched = projects.map(p => {
      const autoHours: Record<string, number> = {}
      const autoMembers: string[] = []
      for (const [projName, entries] of Array.from(autoDetectedProjects.entries())) {
        const matchesProject = projName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(projName.split('/')[0].trim().toLowerCase())
        const matchesClient = projName.toLowerCase().includes(p.client.toLowerCase())
        if (matchesProject || matchesClient) {
          matchedAutoKeys.add(projName)
          for (const e of entries) {
            autoHours[e.personName] = (autoHours[e.personName] || 0) + e.hours
            if (!autoMembers.includes(e.personName)) autoMembers.push(e.personName)
          }
        }
      }
      return { ...p, autoHours, autoMembers }
    })

    // Group unmatched workload entries by client, then sub-project
    const clientProjects = new Map<string, Map<string, { personName: string; hours: number }[]>>()
    for (const [projName, entries] of Array.from(autoDetectedProjects.entries())) {
      if (matchedAutoKeys.has(projName)) continue
      const client = DD_CLIENTS.find(c => projName.toLowerCase().includes(c.toLowerCase())) || 'Onbekend'
      // Clean the project name: "Stek Advocaten B.V. / Castellum" → "Castellum"
      const cleanName = projName.includes('/') ? projName.split('/').slice(1).join('/').trim() : projName
      if (!clientProjects.has(client)) clientProjects.set(client, new Map())
      const clientMap = clientProjects.get(client)!
      if (!clientMap.has(cleanName)) clientMap.set(cleanName, [])
      for (const e of entries) {
        const existing = clientMap.get(cleanName)!.find(x => x.personName === e.personName)
        if (existing) existing.hours += e.hours
        else clientMap.get(cleanName)!.push({ ...e })
      }
    }

    // Create virtual Project objects per client (group sub-projects under one card per client)
    const autoOnly: Project[] = []
    for (const [client, subProjects] of Array.from(clientProjects.entries())) {
      const autoHours: Record<string, number> = {}
      const autoMembers: string[] = []
      const subNames: string[] = []
      for (const [subName, entries] of Array.from(subProjects.entries())) {
        subNames.push(subName)
        for (const e of entries) {
          autoHours[e.personName] = (autoHours[e.personName] || 0) + e.hours
          if (!autoMembers.includes(e.personName)) autoMembers.push(e.personName)
        }
      }
      autoOnly.push({
        id: `auto-${client}`,
        name: subNames.length === 1 ? subNames[0] : `${subNames.length} projecten`,
        client,
        description: subNames.length > 1 ? subNames.join(' • ') : null,
        status: 'actief',
        completedAt: null,
        createdAt: new Date().toISOString(),
        members: [],
        autoHours,
        autoMembers,
      })
    }

    return { enrichedProjects: enriched, autoOnlyProjects: autoOnly }
  }, [projects, autoDetectedProjects])

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

  const activeProjects = enrichedProjects.filter(p => p.status !== 'afgerond')
  const completedProjects = enrichedProjects.filter(p => p.status === 'afgerond')

  // Combine manual active projects with auto-detected ones
  const allActiveProjects = [...activeProjects, ...autoOnlyProjects]

  // Split active into "lopend" (has hours from workload) and "toekomstig" (no hours yet)
  const lopendProjects = allActiveProjects.filter(p => {
    const hrs = Object.values(p.autoHours || {}).reduce((s, h) => s + h, 0)
    return hrs > 0
  })
  const toekomstigProjects = allActiveProjects.filter(p => {
    const hrs = Object.values(p.autoHours || {}).reduce((s, h) => s + h, 0)
    return hrs === 0
  })

  const allProjects = [...enrichedProjects, ...autoOnlyProjects]
  const totalHours = allProjects.reduce((sum, p) => {
    const projectHours = Object.values(p.autoHours || {}).reduce((s, h) => s + h, 0)
    return sum + projectHours
  }, 0)

  // Role check
  if (!loading && userRole && userRole !== 'PARTNER' && userRole !== 'ADMIN') {
    return (
      <div className="max-w-5xl mx-auto fade-in">
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Geen toegang
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            DD Projecten is alleen beschikbaar voor partners en kantoormanagement.
          </p>
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
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            DD Projecten
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Due Diligence projecten — automatisch bijgewerkt op basis van werkdruk
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingProject(null); setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] }) }}
          className="btn-primary flex items-center gap-2"
        >
          <Icons.plus size={16} />
          Nieuw project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-400">{lopendProjects.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Lopend</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">{toekomstigProjects.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Toekomstig</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">{totalHours.toFixed(1)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Uren (4 weken)</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-400">{completedProjects.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Afgerond</div>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
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
                <div className="flex gap-2">
                  {DD_CLIENTS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, client: c })}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                        form.client === c
                          ? `${CLIENT_COLORS[c]?.icon || 'bg-blue-500/15'} ${CLIENT_COLORS[c]?.text || 'text-blue-400'} border-current/30`
                          : 'border-transparent'
                      }`}
                      style={{
                        background: form.client === c ? undefined : 'var(--color-bg-tertiary)',
                        color: form.client === c ? undefined : 'var(--color-text-tertiary)',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={DD_CLIENTS.includes(form.client) ? '' : form.client}
                    onChange={e => setForm({ ...form, client: e.target.value })}
                    className="input-field flex-1"
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
                  {teamMembers.map(m => (
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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        form.memberIds.includes(m.id)
                          ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30'
                          : 'border-transparent'
                      }`}
                      style={{
                        background: form.memberIds.includes(m.id) ? undefined : 'var(--color-bg-tertiary)',
                        color: form.memberIds.includes(m.id) ? undefined : 'var(--color-text-tertiary)',
                      }}
                    >
                      {m.name.split(' ')[0]}
                    </button>
                  ))}
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

      {/* Projects */}
      {allActiveProjects.length === 0 && completedProjects.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.briefcase className="text-blue-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Nog geen DD projecten
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Maak een nieuw project aan of wacht tot er werkdruk data beschikbaar is.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lopende projecten */}
          {lopendProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                Lopende projecten
              </h2>
              <div className="space-y-3">
                {lopendProjects.map(project => <ProjectCard key={project.id} project={project} expandedProject={expandedProject} setExpandedProject={setExpandedProject} toggleProjectStatus={toggleProjectStatus} startEdit={startEdit} deleteProject={deleteProject} />)}
              </div>
            </div>
          )}

          {/* Toekomstige projecten */}
          {toekomstigProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Toekomstige projecten
                <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                  (verschuift naar lopend zodra er uren worden geschreven)
                </span>
              </h2>
              <div className="space-y-3">
                {toekomstigProjects.map(project => <ProjectCard key={project.id} project={project} expandedProject={expandedProject} setExpandedProject={setExpandedProject} toggleProjectStatus={toggleProjectStatus} startEdit={startEdit} deleteProject={deleteProject} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm font-medium mb-3 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Icons.chevronRight
              size={14}
              className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}
            />
            Afgerond ({completedProjects.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-60">
              {completedProjects.map(project => {
                const clientStyle = CLIENT_COLORS[project.client] || CLIENT_COLORS['De Breij']
                return (
                  <div key={project.id} className="card group">
                    <div className="flex items-center gap-4 p-4">
                      <div className={`w-8 h-8 rounded-lg ${clientStyle.icon} flex items-center justify-center`}>
                        <Icons.check size={14} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-through" style={{ color: 'var(--color-text-tertiary)' }}>
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          <span className={clientStyle.text}>{project.client}</span>
                          {project.completedAt && (
                            <span>Afgerond {new Date(project.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
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
    </div>
  )
}

// Reusable project card component
function ProjectCard({ project, expandedProject, setExpandedProject, toggleProjectStatus, startEdit, deleteProject }: {
  project: Project
  expandedProject: string | null
  setExpandedProject: (id: string | null) => void
  toggleProjectStatus: (p: Project) => void
  startEdit: (p: Project) => void
  deleteProject: (id: string) => void
}) {
  const isAutoOnly = project.id.startsWith('auto-')
  const clientStyle = CLIENT_COLORS[project.client] || CLIENT_COLORS['De Breij']
  const stat = STATUS_CONFIG[project.status] || STATUS_CONFIG.actief
  const isExpanded = expandedProject === project.id
  const projectAutoHours = Object.entries(project.autoHours || {})
  const totalProjectHours = projectAutoHours.reduce((s, [, h]) => s + h, 0)

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 sm:p-5 cursor-pointer"
        onClick={() => setExpandedProject(isExpanded ? null : project.id)}
      >
        <Icons.chevronRight
          size={16}
          className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          style={{ color: 'var(--color-text-tertiary)' }}
        />
        <div className={`w-10 h-10 rounded-xl ${clientStyle.icon} flex items-center justify-center flex-shrink-0`}>
          <Icons.briefcase size={18} className={clientStyle.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{project.name}</h3>
            {isAutoOnly ? (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-workx-lime/10 text-workx-lime border-workx-lime/30">Werkdruk</span>
            ) : (
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${stat.bg} ${stat.color} ${stat.border}`}>{stat.label}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            <span className={`font-medium ${clientStyle.text}`}>{project.client}</span>
            <span>{project.members.length + (project.autoMembers?.filter(am => !project.members.some(m => m.user.name === am)).length || 0)} leden</span>
            {totalProjectHours > 0 && <span className="font-medium">{totalProjectHours.toFixed(1)} uur</span>}
          </div>
        </div>
        {!isAutoOnly && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => toggleProjectStatus(project)} className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10" title="Markeer als afgerond">
              <Icons.check size={16} className="text-emerald-400" />
            </button>
            <button onClick={() => startEdit(project)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} title="Bewerken">
              <Icons.edit size={15} />
            </button>
            <button onClick={() => deleteProject(project.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors" title="Verwijderen">
              <Icons.trash size={15} />
            </button>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {project.description && <p className="text-sm mt-4 mb-4" style={{ color: 'var(--color-text-secondary)' }}>{project.description}</p>}
          <div className="mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Team & Uren (afgelopen 4 weken)</h4>
            <div className="space-y-2">
              {project.members.map(member => {
                const autoHrs = project.autoHours?.[member.user.name] || 0
                return (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                      {member.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{member.user.name}</span>
                    <span className="text-sm font-mono tabular-nums" style={{ color: autoHrs > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                      {autoHrs > 0 ? `${autoHrs.toFixed(1)} uur` : '—'}
                    </span>
                  </div>
                )
              })}
              {project.autoMembers?.filter(am => !project.members.some(m => m.user.name === am)).map(personName => {
                const hrs = project.autoHours?.[personName] || 0
                return (
                  <div key={personName} className="flex items-center gap-3 p-3 rounded-xl border border-dashed" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>
                      {personName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {personName}
                      <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>auto</span>
                    </span>
                    <span className="text-sm font-mono tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{hrs.toFixed(1)} uur</span>
                  </div>
                )
              })}
              {project.members.length === 0 && (!project.autoMembers || project.autoMembers.length === 0) && (
                <p className="text-sm py-3 text-center" style={{ color: 'var(--color-text-tertiary)' }}>Nog geen teamleden. Klik op bewerken om leden toe te voegen.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
