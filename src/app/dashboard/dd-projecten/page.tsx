'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import { DD_CLIENTS, DD_EXTERNEN, matchDDClient, hasDDKeyword, ddKeywords, keywordsOverlap } from '@/lib/dd-match'
import toast from 'react-hot-toast'

interface Member {
  id: string
  // Leeg bij een externe (zzp'er) zonder dashboard-account; dan staat de naam
  // in externalName.
  userId: string | null
  externalName: string | null
  role: string
  hours: number
  user: { id: string; name: string; role: string } | null
}

/** Naam van een projectlid, of het nu een collega of een externe is. */
const ledenNaam = (m: Member): string => m.user?.name || m.externalName || 'Onbekend'

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
  extraMembers: string | null
  removedMembers: string | null
  hidden: boolean
  grandfathered: boolean
  completed: boolean
  activated: boolean
}

interface DDCase {
  projectName: string
  fullProjectName: string
  client: string
  totalHours: number
  hours7d: number
  memberNames: string[] // Only names, no hours
  linkedProject?: Project
  expectedHours?: number
  activated: boolean
}

// Bepaalt of een via uren gedetecteerde zaak in het overzicht hoort.
// Prioriteit: definitief verwijderd → nooit; gekoppeld aan een handmatig
// project (bewust aangemaakt) → altijd; grandfathered (bestond al) → altijd;
// anders alleen mét trefwoord in de naam (nieuwe zaken).
function isCaseVisible(
  fullName: string,
  est: { hidden: boolean; grandfathered: boolean } | undefined,
  hasLink: boolean,
): boolean {
  if (est?.hidden) return false
  if (hasLink) return true
  if (est?.grandfathered) return true
  return hasDDKeyword(fullName)
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

interface FeeQuote {
  id: string
  projectName: string
  client: string
  sector: string | null
  targetName: string | null
  employees: number | null
  feeMin: number
  feeMax: number
  actualFee: number | null
  actualHours: number | null
  partnerRate: number | null
  seniorRate: number | null
  scope: string | null
  notes: string | null
  hasWorksCouncil: boolean
  hasCao: boolean
  hasPension: boolean
  status: string
  quotedAt: string
}

export default function DDProjectenPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'projecten' | 'feequotes'>('projecten')
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [workloadData, setWorkloadData] = useState<WorkloadEntry[]>([])
  const [estimates, setEstimates] = useState<DDEstimate[]>([])
  const [feeQuotes, setFeeQuotes] = useState<FeeQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingEstimate, setEditingEstimate] = useState<string | null>(null) // fullProjectName being edited
  const [estimateInput, setEstimateInput] = useState('')
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null) // fullProjectName for member picker
  const [form, setForm] = useState({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [] as string[], externalNames: [] as string[], expectedHours: '' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role

  const fetchAll = useCallback(async () => {
    try {
      const [projRes, teamRes, wlRes, estRes, fqRes] = await Promise.all([
        fetch('/api/dd-projecten'),
        fetch('/api/claude/users'),
        fetch('/api/workload/details?weeks=4'),
        fetch('/api/dd-projecten/estimates'),
        fetch('/api/dd-projecten/fee-quotes'),
      ])
      if (projRes.ok) setProjects(await projRes.json())
      if (teamRes.ok) {
        const users = await teamRes.json()
        setTeamMembers(users)
      }
      if (wlRes.ok) setWorkloadData(await wlRes.json())
      if (estRes.ok) setEstimates(await estRes.json())
      if (fqRes.ok) setFeeQuotes(await fqRes.json())
    } catch {
      toast.error('Kon gegevens niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Process workload data into DD structures ───
  const { clientGroups, completedCases, stats, unmatchedManualProjects, teamProjects } = useMemo(() => {
    const now = new Date()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Kernwoorden per actief handmatig project, voor koppeling op naam.
    const activeProjectKw = projects
      .filter(p => p.status !== 'afgerond')
      .map(p => ({ p, kw: ddKeywords(p.name) }))

    // Group workload entries by projectName. Een urenregel telt mee als DD-zaak
    // wanneer (a) de naam een clientnaam bevat, óf (b) de naam matcht op
    // kernwoord met een handmatig aangemaakt project (bijv. "Iron", "Crest").
    const projectMap = new Map<string, {
      client: string
      members: Set<string>
      totalHours: number
      hours7d: number
      linkProjectId?: string
    }>()

    for (const entry of workloadData) {
      const hours = entry.workedHours || entry.billableHours || 0
      if (hours <= 0) continue

      let client = matchDDClient(entry.projectName)
      const nameKw = ddKeywords(entry.projectName)
      const link = activeProjectKw.find(x => keywordsOverlap(x.kw, nameKw))
      if (!client && link) client = link.p.client // detectie via handmatig project
      if (!client) continue

      if (!projectMap.has(entry.projectName)) {
        projectMap.set(entry.projectName, { client, members: new Set(), totalHours: 0, hours7d: 0, linkProjectId: link?.p.id })
      }
      const proj = projectMap.get(entry.projectName)!
      if (!proj.linkProjectId && link) proj.linkProjectId = link.p.id
      proj.totalHours += hours
      if (entry.date >= d7) proj.hours7d += hours
      proj.members.add(entry.personName)
    }

    // Build estimate lookup (expectedHours + extraMembers + removedMembers + lifecycle)
    const estimateMap = new Map<string, { expectedHours: number; extraMembers: string[]; removedMembers: string[]; hidden: boolean; grandfathered: boolean; completed: boolean; activated: boolean }>()
    for (const est of estimates) {
      let extra: string[] = []
      let removed: string[] = []
      if (est.extraMembers) {
        try { extra = JSON.parse(est.extraMembers) } catch { /* ignore */ }
      }
      if (est.removedMembers) {
        try { removed = JSON.parse(est.removedMembers) } catch { /* ignore */ }
      }
      estimateMap.set(est.projectName, { expectedHours: est.expectedHours, extraMembers: extra, removedMembers: removed, hidden: est.hidden || false, grandfathered: est.grandfathered || false, completed: est.completed || false, activated: est.activated || false })
    }

    // Build cases per client. Gekoppelde handmatige projecten → matched
    // (dus weg uit "op te starten"). Afgeronde zaken → aparte lijst.
    const groups = new Map<string, DDCase[]>()
    const completedCases: DDCase[] = []
    const matchedProjectIds = new Set<string>()
    const hiddenProjects = new Set<string>()
    const activeCaseNames = new Map<string, string>() // fullName → client (zichtbare, actieve zaken)

    for (const [fullName, data] of Array.from(projectMap.entries())) {
      // Koppeling op naam (kernwoord) — bepaald in de detectie-loop.
      const linkedProject = data.linkProjectId ? projects.find(p => p.id === data.linkProjectId) : undefined
      if (linkedProject) matchedProjectIds.add(linkedProject.id)

      const est = estimateMap.get(fullName)
      // Definitief verwijderd, óf nieuwe zaak zonder DD/VDD/Due Diligence in de
      // naam en zonder koppeling → niet tonen (bestaande/handmatige blijven staan).
      if (!isCaseVisible(fullName, est, !!linkedProject)) { hiddenProjects.add(fullName); continue }

      const cleanName = fullName.includes('/') ? fullName.split('/').slice(1).join('/').trim() : fullName
      const workloadMembers = Array.from(data.members)
      const totalHours = Math.round(data.totalHours * 10) / 10
      const hours7d = Math.round(data.hours7d * 10) / 10

      const expectedHours = linkedProject?.expectedHours ?? est?.expectedHours ?? undefined
      // Merge workload members + manually added, minus manually removed
      const extraMembers = est?.extraMembers || []
      const removedMembers = est?.removedMembers || []
      const memberNames = [...workloadMembers, ...extraMembers.filter(n => !workloadMembers.includes(n))]
        .filter(n => !removedMembers.includes(n))

      const ddCase: DDCase = { projectName: cleanName, fullProjectName: fullName, client: data.client, totalHours, hours7d, memberNames, linkedProject, expectedHours, activated: est?.activated || false }

      if (est?.completed) { completedCases.push(ddCase); hiddenProjects.add(fullName); continue }
      if (!groups.has(data.client)) groups.set(data.client, [])
      groups.get(data.client)!.push(ddCase)
      activeCaseNames.set(fullName, data.client)
    }

    // Sort: geactiveerd/actief eerst, dan op recente uren
    for (const cases of Array.from(groups.values())) {
      cases.sort((a, b) => b.hours7d - a.hours7d || b.totalHours - a.totalHours)
    }
    completedCases.sort((a, b) => b.totalHours - a.totalHours)

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

    // Build team member → projects map (last 10 days + manual projects)
    const d10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const teamProjectsMap = new Map<string, { projectName: string; client: string; hours: number }[]>()
    for (const entry of workloadData) {
      // Alleen zichtbare, actieve zaken (zelfde detectie/zichtbaarheid als hierboven).
      const client = activeCaseNames.get(entry.projectName)
      if (!client) continue
      const hours = entry.workedHours || entry.billableHours || 0
      if (hours <= 0 || entry.date < d10) continue
      const cleanName = entry.projectName.includes('/') ? entry.projectName.split('/').slice(1).join('/').trim() : entry.projectName
      if (!teamProjectsMap.has(entry.personName)) teamProjectsMap.set(entry.personName, [])
      const existing = teamProjectsMap.get(entry.personName)!.find(p => p.projectName === cleanName)
      if (existing) existing.hours += hours
      else teamProjectsMap.get(entry.personName)!.push({ projectName: cleanName, client, hours })
    }
    // Add manual project members
    for (const p of unmatched) {
      for (const m of p.members) {
        if (!teamProjectsMap.has(ledenNaam(m))) teamProjectsMap.set(ledenNaam(m), [])
        const existing = teamProjectsMap.get(ledenNaam(m))!.find(tp => tp.projectName === p.name)
        if (!existing) teamProjectsMap.get(ledenNaam(m))!.push({ projectName: p.name, client: p.client, hours: 0 })
      }
    }

    return {
      clientGroups: groups,
      completedCases,
      stats: { totalHours: Math.round(totalHours * 10) / 10, totalHours7d: Math.round(totalHours7d * 10) / 10, totalCases, teamCount: allMembers.size },
      unmatchedManualProjects: unmatched,
      teamProjects: teamProjectsMap,
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
      memberIds: project.members.filter(m => m.userId).map(m => m.userId as string),
      externalNames: project.members.filter(m => m.externalName).map(m => m.externalName as string),
      expectedHours: project.expectedHours?.toString() || '',
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [], externalNames: [], expectedHours: '' })
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
        return [...prev, { id: '', projectName, expectedHours: hours, extraMembers: null, removedMembers: null, hidden: false, grandfathered: false, completed: false, activated: false }]
      })
      setEditingEstimate(null)
      toast.success('Verwachte uren opgeslagen')
    } catch {
      toast.error('Kon verwachte uren niet opslaan')
    }
  }

  // Generieke estimate-patch (afronden/activeren/heropenen). Werkt lokale state bij.
  const patchEstimate = async (projectName: string, patch: Record<string, unknown>, successMsg?: string) => {
    try {
      const res = await fetch('/api/dd-projecten/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, ...patch }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setEstimates(prev => {
        const exists = prev.find(e => e.projectName === projectName)
        if (exists) return prev.map(e => e.projectName === projectName ? updated : e)
        return [...prev, updated]
      })
      if (successMsg) toast.success(successMsg)
    } catch {
      toast.error('Kon zaak niet bijwerken')
    }
  }

  const completeCase = (c: DDCase) => {
    if (!confirm(`"${c.projectName}" afronden? De zaak gaat naar Afgerond (je kunt 'm later heropenen).`)) return
    patchEstimate(c.fullProjectName, { completed: true, activated: false }, 'Zaak afgerond')
  }

  const reopenCase = (fullProjectName: string) => {
    patchEstimate(fullProjectName, { completed: false }, 'Zaak heropend')
  }

  const activateCase = (c: DDCase) => {
    patchEstimate(c.fullProjectName, { activated: true }, 'Zaak geactiveerd')
  }

  // Bewerken van een lopende zaak: gekoppeld project → bewerken; anders een
  // handmatig project aanmaken (voorgevuld), dat vervolgens automatisch koppelt.
  const editCase = (c: DDCase) => {
    if (c.linkedProject) { startEdit(c.linkedProject); return }
    setEditingProject(null)
    setForm({
      name: c.projectName,
      client: DD_CLIENTS.includes(c.client) ? c.client : DD_CLIENTS[0],
      description: '',
      memberIds: teamMembers.filter(u => c.memberNames.includes(u.name)).map(u => u.id),
      externalNames: DD_EXTERNEN.filter(n => c.memberNames.includes(n)),
      expectedHours: c.expectedHours ? String(c.expectedHours) : '',
    })
    setShowForm(true)
  }

  const toggleExtraMember = async (projectName: string, memberName: string, currentMembers: string[]) => {
    const est = estimates.find(e => e.projectName === projectName)
    let extraMembers: string[] = []
    let removedMembers: string[] = []
    if (est?.extraMembers) {
      try { extraMembers = JSON.parse(est.extraMembers) } catch { /* ignore */ }
    }
    if (est?.removedMembers) {
      try { removedMembers = JSON.parse(est.removedMembers) } catch { /* ignore */ }
    }

    const isCurrentlyShown = currentMembers.includes(memberName)
    const isManuallyAdded = extraMembers.includes(memberName)
    const isManuallyRemoved = removedMembers.includes(memberName)

    if (isCurrentlyShown) {
      // Remove: either remove from extraMembers or add to removedMembers
      if (isManuallyAdded) {
        extraMembers = extraMembers.filter(n => n !== memberName)
      } else {
        // Workload member — add to removed list
        if (!isManuallyRemoved) removedMembers.push(memberName)
      }
    } else {
      // Add: either add to extraMembers or remove from removedMembers
      if (isManuallyRemoved) {
        removedMembers = removedMembers.filter(n => n !== memberName)
      } else {
        extraMembers.push(memberName)
      }
    }

    try {
      const res = await fetch('/api/dd-projecten/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, extraMembers, removedMembers }),
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

  const deleteFromOverview = async (fullProjectName: string) => {
    if (!confirm('Deze zaak definitief uit het overzicht verwijderen?\n\nOok als er later nog uren op worden geschreven, komt-ie niet meer terug. Gebruik dit voor zaken die hier niet thuishoren (geen DD/VDD/Due Diligence).')) return
    try {
      const res = await fetch('/api/dd-projecten/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: fullProjectName, hidden: true }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEstimates(prev => {
          const exists = prev.find(e => e.projectName === fullProjectName)
          if (exists) return prev.map(e => e.projectName === fullProjectName ? updated : e)
          return [...prev, updated]
        })
        toast.success('Zaak definitief verwijderd uit overzicht')
      }
    } catch {
      toast.error('Kon zaak niet verwijderen')
    }
  }

  const completedProjects = projects.filter(p => p.status === 'afgerond')

  // DD Projecten is toegankelijk voor alle medewerkers

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

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('projecten')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'projecten' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          Projecten
        </button>
        <button
          onClick={() => setActiveTab('feequotes')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'feequotes' ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          Fee Quotes ({feeQuotes.length})
        </button>
      </div>

      {activeTab === 'projecten' ? (<>
      {/* Naamgeving-uitleg */}
      <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
        <Icons.info size={15} className="text-workx-lime shrink-0 mt-0.5" />
        <span>
          Nieuwe DD-zaken verschijnen hier alleen als de zaaknaam <strong>DD</strong>, <strong>VDD</strong> of <strong>Due Diligence</strong> bevat. Zaken die er niet thuishoren kun je met <span className="text-red-400 font-medium">Verwijder</span> definitief weghalen — ook als er later uren op komen, blijven ze weg.
        </span>
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

      {/* ─── Team overzicht ─── */}
      {teamProjects.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              Team ({teamProjects.size})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(teamProjects.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, memberProjects]) => {
                const photo = getPhotoUrl(name)
                const isExpanded = expandedKey === `team-${name}`
                return (
                  <div key={name} className="relative">
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : `team-${name}`)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
                        isExpanded ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'border-transparent hover:border-white/10'
                      }`}
                      style={!isExpanded ? { background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' } : undefined}
                    >
                      {photo ? (
                        <Image src={photo} alt={name} width={28} height={28} className="w-7 h-7 rounded-lg object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-white">{name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="font-medium">{name.split(' ')[0]}</span>
                      <span className="text-xs opacity-60">({memberProjects.length})</span>
                      <Icons.chevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-tertiary)' }} />
                    </button>
                    {isExpanded && (
                      <div className="absolute top-full left-0 mt-1 z-20 w-64 rounded-xl border shadow-xl p-2 space-y-1" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        {memberProjects.sort((a, b) => b.hours - a.hours).map((p, i) => {
                          const pcc = CLIENT_COLORS[p.client] || CLIENT_COLORS['De Breij']
                          return (
                            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--color-bg-tertiary)' }}>
                              <div className={`w-2 h-2 rounded-full ${pcc.dot}`} />
                              <span className="flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>{p.projectName}</span>
                              {p.hours > 0 && <span style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(p.hours * 10) / 10}u</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ─── Nieuwe projecten (nog op te starten) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-workx-lime" />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              Nieuwe projecten (nog op te starten)
            </h2>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingProject(null); setForm({ name: '', client: DD_CLIENTS[0], description: '', memberIds: [], externalNames: [], expectedHours: '' }) }}
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
              return (
                <div key={project.id} className="rounded-2xl border overflow-hidden hover:shadow-md" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
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
                  <div className="px-4 pb-3 pt-1">
                    <div className="ml-[46px] flex flex-wrap gap-2 items-center">
                      {project.members.map((m, mi) => {
                        const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                        const photo = getPhotoUrl(ledenNaam(m))
                        return (
                          <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                            {photo ? (
                              <Image src={photo} alt={ledenNaam(m)} width={24} height={24} className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                            ) : (
                              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-[9px] font-medium text-white">{ledenNaam(m).charAt(0)}</span>
                              </div>
                            )}
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ledenNaam(m)}</span>
                          </div>
                        )
                      })}
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddingMemberTo(addingMemberTo === `manual-${project.id}` ? null : `manual-${project.id}`) }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-dashed transition-colors hover:border-workx-lime/30 hover:text-workx-lime"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
                      >
                        <Icons.edit size={10} />
                        Wijzig team
                      </button>
                    </div>
                    {addingMemberTo === `manual-${project.id}` && (
                      <div className="ml-[46px] mt-2 rounded-xl border p-3" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Teamleden toevoegen / verwijderen</span>
                          <button onClick={() => setAddingMemberTo(null)} className="p-1 rounded hover:bg-white/10 transition-colors">
                            <Icons.x size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {teamMembers.map(u => {
                            const isIn = project.members.some(m => ledenNaam(m) === u.name)
                            const photo = getPhotoUrl(u.name)
                            return (
                              <button
                                key={u.id}
                                onClick={async () => {
                                  const currentIds = project.members.map(m => m.userId)
                                  const newIds = isIn ? currentIds.filter(id => id !== u.id) : [...currentIds, u.id]
                                  try {
                                    await fetch('/api/dd-projecten', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: project.id, memberIds: newIds }),
                                    })
                                    fetchAll()
                                  } catch { toast.error('Kon team niet bijwerken') }
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                                  isIn ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30' : 'border-transparent hover:border-white/10'
                                }`}
                                style={!isIn ? { background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' } : undefined}
                              >
                                {photo ? (
                                  <Image src={photo} alt={u.name} width={18} height={18} className="w-[18px] h-[18px] rounded-md object-cover" />
                                ) : (
                                  <div className="w-[18px] h-[18px] rounded-md bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                    <span className="text-[8px] font-medium text-white">{u.name.charAt(0)}</span>
                                  </div>
                                )}
                                {u.name.split(' ')[0]}
                                {isIn && <Icons.check size={10} />}
                              </button>
                            )
                          })}
                          {/* Externen (zzp) — zelfde knoppen, maar zonder account */}
                          {DD_EXTERNEN.map(naam => {
                            const isIn = project.members.some(m => m.externalName === naam)
                            return (
                              <button
                                key={`ext-${naam}`}
                                onClick={async () => {
                                  const huidige = project.members
                                    .filter(m => m.externalName)
                                    .map(m => m.externalName as string)
                                  const nieuwe = isIn ? huidige.filter(n => n !== naam) : [...huidige, naam]
                                  try {
                                    await fetch('/api/dd-projecten', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: project.id, externalNames: nieuwe }),
                                    })
                                    fetchAll()
                                  } catch { toast.error('Kon team niet bijwerken') }
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                                  isIn ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30' : 'border-transparent hover:border-white/10'
                                }`}
                                style={!isIn ? { background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' } : undefined}
                                title={`${naam} — extern, geen uren uit het urensysteem`}
                              >
                                <div className="w-[18px] h-[18px] rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                  <span className="text-[8px] font-medium text-white">{naam.charAt(0)}</span>
                                </div>
                                {naam.split(' ')[0]}
                                {isIn && <Icons.check size={10} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Nog geen nieuwe projecten. Klik op &quot;Nieuw project&quot; om een zaak toe te voegen.
            </p>
          </div>
        )}
      </div>

      {/* ─── Per-client sections ─── (vaste 5 eerst, daarna eventuele overige) */}
      {[...DD_CLIENTS.filter(c => clientGroups.has(c)), ...Array.from(clientGroups.keys()).filter(c => !DD_CLIENTS.includes(c))].map(client => {
        const cases = clientGroups.get(client)!
        const clientTotalHours = Math.round(cases.reduce((s, c) => s + c.totalHours, 0) * 10) / 10
        const cc = CLIENT_COLORS[client] || CLIENT_COLORS['De Breij']

        // Find max 7d hours across ALL clients for relative bar sizing
        const allCases = Array.from(clientGroups.values()).flat()
        const max7dHours = Math.max(...allCases.map(c => c.hours7d), 1)

        // Split cases by recency
        // Geactiveerde zaken tellen als actief, ook zonder uren afgelopen 7 dagen.
        const recent7d = cases.filter(c => c.hours7d > 0 || c.activated)
        const older = cases.filter(c => c.hours7d === 0 && !c.activated)

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
                    <div className="flex items-center gap-0.5">
                      {dimmed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); activateCase(c) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-workx-lime/15 text-workx-lime hover:bg-workx-lime/25 transition-all text-[10px] font-medium mr-1"
                          title="Weer als actieve zaak tonen"
                        >
                          <Icons.play size={10} />
                          Activeren
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); editCase(c) }} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--color-text-tertiary)' }} title="Bewerken">
                        <Icons.edit size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); completeCase(c) }} className="p-1.5 rounded-lg transition-colors hover:bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-400" title="Afronden">
                        <Icons.check size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteFromOverview(c.fullProjectName) }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors" title="Definitief verwijderen (komt niet terug, ook niet na nieuwe uren)">
                        <Icons.trash size={13} />
                      </button>
                    </div>
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
                        <div key={name} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg group/chip" style={{ background: 'var(--color-bg-tertiary)' }}>
                          {photo ? (
                            <Image src={photo} alt={name} width={22} height={22} className="w-[22px] h-[22px] rounded-md object-cover" />
                          ) : (
                            <div className={`w-[22px] h-[22px] rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}>
                              <span className="text-[9px] font-medium text-white">{name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{name.split(' ')[0]}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExtraMember(c.fullProjectName, name, c.memberNames) }}
                            className="p-0.5 rounded hover:bg-red-500/20 text-red-400/0 group-hover/chip:text-red-400/60 hover:!text-red-400 transition-all"
                            title={`${name} verwijderen`}
                          >
                            <Icons.x size={10} />
                          </button>
                        </div>
                      )
                    })}
                    {/* Wijzig team button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingMemberTo(addingMemberTo === c.fullProjectName ? null : c.fullProjectName) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-dashed transition-colors hover:border-workx-lime/30 hover:text-workx-lime"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
                    >
                      <Icons.edit size={10} />
                      Wijzig team
                    </button>
                  </div>
                  {/* Team edit panel */}
                  {addingMemberTo === c.fullProjectName && (
                    <div className="mt-2 rounded-xl border p-3" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Teamleden toevoegen / verwijderen</span>
                        <button onClick={() => setAddingMemberTo(null)} className="p-1 rounded hover:bg-white/10 transition-colors">
                          <Icons.x size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {teamMembers.map(u => {
                          const isIn = c.memberNames.includes(u.name)
                          const photo = getPhotoUrl(u.name)
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleExtraMember(c.fullProjectName, u.name, c.memberNames)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                                isIn
                                  ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30'
                                  : 'border-transparent hover:border-white/10'
                              }`}
                              style={!isIn ? { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' } : undefined}
                            >
                              {photo ? (
                                <Image src={photo} alt={u.name} width={18} height={18} className="w-[18px] h-[18px] rounded-md object-cover" />
                              ) : (
                                <div className="w-[18px] h-[18px] rounded-md bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-[8px] font-medium text-white">{u.name.charAt(0)}</span>
                                </div>
                              )}
                              {u.name.split(' ')[0]}
                              {isIn && <Icons.check size={10} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
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

      {/* ─── Afgeronde projecten ─── */}
      {(completedProjects.length > 0 || completedCases.length > 0) && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedKey(expandedKey === 'completed-section' ? null : 'completed-section')}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Icons.chevronRight size={14} className={`transition-transform ${expandedKey === 'completed-section' ? 'rotate-90' : ''}`} />
            Afgerond ({completedProjects.length + completedCases.length})
          </button>
          {expandedKey === 'completed-section' && (
            <div className="space-y-2 opacity-60">
              {completedCases.map(c => {
                const cc = CLIENT_COLORS[c.client] || CLIENT_COLORS['De Breij']
                return (
                  <div key={c.fullProjectName} className="rounded-xl border group" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className={`w-8 h-8 rounded-lg ${cc.bg} flex items-center justify-center`}>
                        <Icons.check size={14} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-through truncate" style={{ color: 'var(--color-text-tertiary)' }}>{c.projectName}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          <span className={cc.text}>{c.client}</span>
                          <span>{c.totalHours}u totaal</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => reopenCase(c.fullProjectName)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} title="Heropen">
                          <Icons.arrowRight size={14} />
                        </button>
                        <button onClick={() => deleteFromOverview(c.fullProjectName)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors" title="Definitief verwijderen">
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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

      </>) : (
        /* Fee Quotes Tab */
        <div className="space-y-4">
          {/* Group by client */}
          {DD_CLIENTS.map(client => {
            const clientQuotes = feeQuotes.filter(q => q.client === client)
            if (clientQuotes.length === 0) return null
            const cc = CLIENT_COLORS[client] || CLIENT_COLORS['De Breij']
            return (
              <div key={client} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />
                  <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>{client}</h2>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>({clientQuotes.length})</span>
                </div>
                {clientQuotes.map(q => (
                  <div key={q.id} className="rounded-2xl border p-4 hover:shadow-md transition-all" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{q.projectName}</span>
                          {q.sector && <span className="px-2 py-0.5 text-[10px] rounded-full" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>{q.sector}</span>}
                          {q.status === 'completed' && <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/15 text-emerald-400">Afgerond</span>}
                        </div>
                        {q.targetName && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Target: {q.targetName}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          €{q.feeMin.toLocaleString('nl-NL')} – €{q.feeMax.toLocaleString('nl-NL')}
                        </div>
                        {q.actualFee && (
                          <div className="text-xs text-orange-400">Werkelijk: €{q.actualFee.toLocaleString('nl-NL')}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {q.employees && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px]" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                          <Icons.users size={10} /> {q.employees} werknemers
                        </span>
                      )}
                      {q.hasWorksCouncil && <span className="px-2 py-0.5 rounded-lg text-[11px] bg-blue-500/10 text-blue-400">OR</span>}
                      {q.hasCao && <span className="px-2 py-0.5 rounded-lg text-[11px] bg-purple-500/10 text-purple-400">CAO</span>}
                      {q.hasPension && <span className="px-2 py-0.5 rounded-lg text-[11px] bg-amber-500/10 text-amber-400">Pensioen</span>}
                      {q.partnerRate && <span className="px-2 py-0.5 rounded-lg text-[11px]" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>Partner: €{q.partnerRate}/u</span>}
                      {q.seniorRate && <span className="px-2 py-0.5 rounded-lg text-[11px]" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>Senior: €{q.seniorRate}/u</span>}
                      <span className="px-2 py-0.5 rounded-lg text-[11px]" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                        {new Date(q.quotedAt).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {q.scope && (
                      <div className="mt-3 rounded-xl border p-3 space-y-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}>
                        {q.scope.split('\n').map((line, li) => {
                          const trimmed = line.trim()
                          if (!trimmed) return <div key={li} className="h-1" />
                          if (trimmed === 'SCOPE:' || trimmed === 'ASSUMPTIES:' || trimmed === 'BUITEN SCOPE:' || trimmed === 'LEERPUNT:' || trimmed === 'TARIEVEN:') {
                            const colors: Record<string, string> = {
                              'SCOPE:': 'text-workx-lime',
                              'ASSUMPTIES:': 'text-blue-400',
                              'BUITEN SCOPE:': 'text-red-400',
                              'LEERPUNT:': 'text-orange-400',
                              'TARIEVEN:': 'text-purple-400',
                            }
                            return <p key={li} className={`text-[11px] font-bold uppercase tracking-wider mt-1 ${colors[trimmed] || ''}`}>{trimmed}</p>
                          }
                          return <p key={li} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{trimmed}</p>
                        })}
                      </div>
                    )}
                    {q.notes && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Notities & historie</summary>
                        <p className="text-xs mt-1 whitespace-pre-line px-2" style={{ color: 'var(--color-text-secondary)' }}>{q.notes}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
          {/* Quotes without known client */}
          {feeQuotes.filter(q => !DD_CLIENTS.includes(q.client)).length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>Overig</h2>
              {feeQuotes.filter(q => !DD_CLIENTS.includes(q.client)).map(q => (
                <div key={q.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{q.projectName}</span>
                  <span className="ml-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>€{q.feeMin.toLocaleString('nl-NL')} – €{q.feeMax.toLocaleString('nl-NL')}</span>
                </div>
              ))}
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
              {/* Externen: zzp'ers zonder dashboard-account. Wel op het project
                  te zetten voor het overzicht; hun uren komen niet uit het
                  urensysteem. */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Externen
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>zzp — geen uren uit het systeem</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DD_EXTERNEN.map(naam => {
                    const isSelected = form.externalNames.includes(naam)
                    return (
                      <button
                        key={naam}
                        type="button"
                        onClick={() => {
                          setForm(f => ({
                            ...f,
                            externalNames: f.externalNames.includes(naam)
                              ? f.externalNames.filter(n => n !== naam)
                              : [...f.externalNames, naam],
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
                        title={`${naam} — extern, geen uren uit het urensysteem`}
                      >
                        {naam.split(' ')[0]}
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
