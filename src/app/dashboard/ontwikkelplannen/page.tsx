'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import { getPhotoUrl } from '@/lib/team-photos'
import TextReveal from '@/components/ui/TextReveal'

// ── Types ─────────────────────────────────────────────────────────────────

interface DevelopmentPlanItem {
  id: string
  planId: string
  category: string
  title: string
  goals: string | null
  evaluation: string | null
  status: 'todo' | 'doing' | 'done'
  progress: number
  targetDate: string | null
  completedAt: string | null
  position: number
  createdAt: string
  updatedAt: string
}

interface DevelopmentPlanEvaluation {
  id: string
  planId: string
  evaluatorId: string
  evaluatorName: string
  notes: string
  evaluatedAt: string
}

interface DevelopmentPlan {
  id: string
  userId: string | null
  employeeName: string
  period: string
  year: number
  status: string
  generalNotes: string | null
  evaluationDate: string | null
  documentUrl: string | null
  documentName: string | null
  submittedForReviewAt: string | null
  reviewedAt: string | null
  reviewedById: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; role: string } | null
  items: DevelopmentPlanItem[]
  evaluations: DevelopmentPlanEvaluation[]
}

// ── Categorieën ────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'inhoud-theorie',
    label: 'Inhoud — theorie',
    icon: 'books' as const,
    color: 'purple',
    description: 'Verdieping vakliteratuur, jurisprudentie, congressen, opleidingen.',
  },
  {
    key: 'inhoud-praktijk',
    label: 'Inhoud — praktijk',
    icon: 'briefcase' as const,
    color: 'indigo',
    description: 'Kennis in praktijk brengen op arbeidsrechtelijke gebieden.',
  },
  {
    key: 'eigen-praktijk',
    label: 'Eigen praktijk en zaken',
    icon: 'trendingUp' as const,
    color: 'emerald',
    description: 'Eigen klanten, zaken, acquisitie, content, zichtbaarheid.',
  },
  {
    key: 'intern',
    label: 'Intern',
    icon: 'users' as const,
    color: 'amber',
    description: 'Opleiden junioren, seminars organiseren, bijdrage aan team.',
  },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

const COLOR_CLASSES: Record<string, { border: string; gradient: string; accent: string; accentBg: string; ring: string }> = {
  purple: { border: 'border-purple-500/30', gradient: 'from-purple-500/8', accent: 'text-purple-300', accentBg: 'bg-purple-500/10', ring: 'accent-purple-400' },
  indigo: { border: 'border-indigo-500/30', gradient: 'from-indigo-500/8', accent: 'text-indigo-300', accentBg: 'bg-indigo-500/10', ring: 'accent-indigo-400' },
  emerald: { border: 'border-emerald-500/30', gradient: 'from-emerald-500/8', accent: 'text-emerald-300', accentBg: 'bg-emerald-500/10', ring: 'accent-emerald-400' },
  amber: { border: 'border-amber-500/30', gradient: 'from-amber-500/8', accent: 'text-amber-300', accentBg: 'bg-amber-500/10', ring: 'accent-amber-400' },
}

// ── Auto-textarea ──────────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  minRows = 1,
}: {
  value: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      rows={minRows}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  )
}

// ── Hoofdpagina ────────────────────────────────────────────────────────────

export default function OntwikkelplannenPage() {
  const { data: session } = useSession()
  const meId = session?.user?.id
  const meName = session?.user?.name || ''
  const isAdmin = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN' || session?.user?.role === 'OFFICE_MANAGER'

  const [allPlans, setAllPlans] = useState<DevelopmentPlan[] | null>(null)
  const [myPlan, setMyPlan] = useState<DevelopmentPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [showImport, setShowImport] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isAdmin) {
        const res = await fetch('/api/development-plans')
        if (!res.ok) throw new Error()
        const data: DevelopmentPlan[] = await res.json()
        setAllPlans(data)
      } else {
        const res = await fetch(`/api/development-plans/me?year=${selectedYear}`)
        if (!res.ok) throw new Error()
        const data: DevelopmentPlan = await res.json()
        setMyPlan(data)
      }
    } catch {
      toast.error('Kon ontwikkelplan niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin, selectedYear])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-selecteer eigen naam voor admin als initial state — zodat een partner
  // ook gewoon z'n eigen plan ziet, en kan switchen.
  useEffect(() => {
    if (isAdmin && allPlans && !selectedEmployee && meName) {
      // Probeer eerst exacte match op userId
      const own = allPlans.find(p => p.userId === meId)
      if (own) {
        setSelectedEmployee(own.employeeName)
        setSelectedYear(own.year)
        return
      }
      // Anders: eerste medewerker
      const names = Array.from(new Set(allPlans.map(p => p.employeeName))).sort()
      if (names.length > 0) setSelectedEmployee(names[0])
    }
  }, [isAdmin, allPlans, selectedEmployee, meName, meId])

  // ── Active plan (de huidig getoonde) ──────────────────────────────────
  const activePlan: DevelopmentPlan | null = useMemo(() => {
    if (!isAdmin) return myPlan
    if (!allPlans || !selectedEmployee) return null
    return allPlans.find(p => p.employeeName === selectedEmployee && p.year === selectedYear) || null
  }, [isAdmin, myPlan, allPlans, selectedEmployee, selectedYear])

  // Wie is owner: huidige user, of (voor admins die andermans plan bekijken) andere user
  const isViewingOwnPlan = activePlan?.userId === meId

  // ── Groeperen / lijsten voor admin-views ──────────────────────────────
  const employeeNames = useMemo(() => {
    if (!allPlans) return []
    return Array.from(new Set(allPlans.map(p => p.employeeName))).sort()
  }, [allPlans])

  const yearsForEmployee = useMemo(() => {
    if (!allPlans || !selectedEmployee) return []
    return Array.from(new Set(allPlans.filter(p => p.employeeName === selectedEmployee).map(p => p.year))).sort((a, b) => b - a)
  }, [allPlans, selectedEmployee])

  // ── Items per categorie ───────────────────────────────────────────────
  const itemsByCategory = useMemo(() => {
    const map: Record<string, DevelopmentPlanItem[]> = {
      'inhoud-theorie': [],
      'inhoud-praktijk': [],
      'eigen-praktijk': [],
      'intern': [],
    }
    if (activePlan) {
      for (const it of activePlan.items) {
        if (map[it.category]) map[it.category].push(it)
        else map['inhoud-theorie'].push(it)
      }
    }
    return map
  }, [activePlan])

  // ── Mutations ─────────────────────────────────────────────────────────
  const replaceItem = useCallback((item: DevelopmentPlanItem) => {
    if (isAdmin) {
      setAllPlans(prev => prev?.map(p => p.id !== item.planId ? p : { ...p, items: p.items.map(i => i.id === item.id ? item : i) }) || null)
    } else {
      setMyPlan(p => p && p.id === item.planId ? { ...p, items: p.items.map(i => i.id === item.id ? item : i) } : p)
    }
  }, [isAdmin])

  const removeItemLocal = useCallback((planId: string, itemId: string) => {
    if (isAdmin) {
      setAllPlans(prev => prev?.map(p => p.id !== planId ? p : { ...p, items: p.items.filter(i => i.id !== itemId) }) || null)
    } else {
      setMyPlan(p => p && p.id === planId ? { ...p, items: p.items.filter(i => i.id !== itemId) } : p)
    }
  }, [isAdmin])

  const appendItem = useCallback((planId: string, item: DevelopmentPlanItem) => {
    if (isAdmin) {
      setAllPlans(prev => prev?.map(p => p.id !== planId ? p : { ...p, items: [...p.items, item] }) || null)
    } else {
      setMyPlan(p => p && p.id === planId ? { ...p, items: [...p.items, item] } : p)
    }
  }, [isAdmin])

  const addItem = async (category: CategoryKey, title: string, goals: string, targetDate: string | null) => {
    if (!activePlan) return
    if (!title.trim()) return
    try {
      const res = await fetch('/api/development-plans/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: activePlan.id,
          category,
          title,
          goals,
          targetDate,
        }),
      })
      if (!res.ok) throw new Error()
      const item: DevelopmentPlanItem = await res.json()
      appendItem(activePlan.id, item)
      toast.success('Toegevoegd')
    } catch {
      toast.error('Toevoegen mislukt')
    }
  }

  const updateItem = async (id: string, patch: Partial<DevelopmentPlanItem>) => {
    try {
      const res = await fetch('/api/development-plans/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error()
      const updated: DevelopmentPlanItem = await res.json()
      replaceItem(updated)
      return updated
    } catch {
      toast.error('Opslaan mislukt')
    }
  }

  const deleteItem = async (id: string, planId: string) => {
    if (!confirm('Dit item verwijderen?')) return
    try {
      const res = await fetch(`/api/development-plans/items?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      removeItemLocal(planId, id)
      toast.success('Verwijderd')
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }

  // ── Evaluations (admin) ───────────────────────────────────────────────
  const addEvaluation = async (planId: string, notes: string) => {
    if (!notes.trim()) return
    try {
      const res = await fetch('/api/development-plans/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, notes }),
      })
      if (!res.ok) throw new Error()
      const ev: DevelopmentPlanEvaluation = await res.json()
      if (isAdmin) {
        setAllPlans(prev => prev?.map(p => p.id !== planId ? p : { ...p, evaluations: [ev, ...p.evaluations] }) || null)
      } else {
        setMyPlan(p => p && p.id === planId ? { ...p, evaluations: [ev, ...p.evaluations] } : p)
      }
      toast.success('Evaluatie toegevoegd')
    } catch {
      toast.error('Toevoegen mislukt')
    }
  }

  const deleteEvaluation = async (planId: string, id: string) => {
    if (!confirm('Deze evaluatie verwijderen?')) return
    try {
      const res = await fetch(`/api/development-plans/evaluations?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (isAdmin) {
        setAllPlans(prev => prev?.map(p => p.id !== planId ? p : { ...p, evaluations: p.evaluations.filter(e => e.id !== id) }) || null)
      } else {
        setMyPlan(p => p && p.id === planId ? { ...p, evaluations: p.evaluations.filter(e => e.id !== id) } : p)
      }
      toast.success('Verwijderd')
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }

  // ── Submit "inleveren" / mark-reviewed ───────────────────────────────
  const updatePlanLocal = useCallback((planId: string, patch: Partial<DevelopmentPlan>) => {
    if (isAdmin) {
      setAllPlans(prev => prev?.map(p => p.id !== planId ? p : { ...p, ...patch }) || null)
    } else {
      setMyPlan(p => p && p.id === planId ? { ...p, ...patch } : p)
    }
  }, [isAdmin])

  const submitForReview = async (planId: string) => {
    if (!confirm('Plan inleveren ter bespreking met partners?\n\nEr wordt een melding naar #MT-Groot gestuurd en het verschijnt als bespreek-widget op het partner-dashboard.')) return
    try {
      const res = await fetch(`/api/development-plans/${planId}/submit`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Inleveren mislukt')
      }
      updatePlanLocal(planId, { submittedForReviewAt: new Date().toISOString(), reviewedAt: null })
      toast.success('Ingeleverd — partners zijn ingelicht')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Inleveren mislukt')
    }
  }

  const markReviewed = async (planId: string) => {
    try {
      const res = await fetch(`/api/development-plans/${planId}/mark-reviewed`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Markeren mislukt')
      }
      updatePlanLocal(planId, { reviewedAt: new Date().toISOString(), reviewedById: meId || null })
      toast.success('Gemarkeerd als besproken')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Markeren mislukt')
    }
  }

  // ── DOCX upload (admin) ──────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/development-plans/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      toast.success('Plan geüpload')
      fetchData()
    } catch {
      toast.error('Upload mislukt')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [fetchData])

  // ── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = activePlan?.items.length || 0
    const done = activePlan?.items.filter(i => i.status === 'done').length || 0
    const avg = total > 0
      ? Math.round((activePlan!.items.reduce((s, i) => s + (i.status === 'done' ? 100 : i.progress), 0)) / total)
      : 0
    return { total, done, avg }
  }, [activePlan])

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6 fade-in">
        <div className="card p-8 text-center text-white/50">Ontwikkelplan laden…</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6 fade-in relative">
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center">
              <Icons.target className="text-purple-300" size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                <TextReveal>{isAdmin && selectedEmployee && !isViewingOwnPlan ? `Ontwikkelplan ${selectedEmployee.split(' ')[0]} ${selectedYear}` : `Mijn ontwikkelplan ${selectedYear}`}</TextReveal>
              </h1>
              <p className="text-sm text-white/60 mt-0.5">Inhoud (theorie + praktijk) · eigen praktijk en zaken · intern</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{stats.done}<span className="text-sm text-white/40">/{stats.total}</span></p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">afgerond</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-300 tabular-nums">{stats.avg}<span className="text-sm text-white/40">%</span></p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">gem. voortgang</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin: medewerker-selector */}
      {isAdmin && allPlans && employeeNames.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Team</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icons.upload size={12} />
                {isUploading ? 'Uploaden…' : 'DOCX uploaden'}
              </button>
              <input ref={fileInputRef} type="file" accept=".docx" onChange={handleUpload} className="hidden" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {employeeNames.map(name => {
              const planCount = allPlans.filter(p => p.employeeName === name).length
              const selected = selectedEmployee === name
              const photo = getPhotoUrl(name)
              return (
                <button
                  key={name}
                  onClick={() => setSelectedEmployee(name)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                    selected
                      ? 'bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {photo ? (
                    <Image src={photo} alt={name} width={32} height={32} className={`w-8 h-8 rounded-lg object-cover ring-2 ${selected ? 'ring-purple-500/40' : 'ring-white/10'}`} />
                  ) : (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${selected ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/60'}`}>
                      {name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${selected ? 'text-purple-200' : 'text-white'}`}>{name.split(' ')[0]}</p>
                    <p className="text-[10px] text-white/40">{planCount} {planCount === 1 ? 'plan' : 'plannen'}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {/* Jaar-tabs */}
          {selectedEmployee && yearsForEmployee.length > 1 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {yearsForEmployee.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-lg text-xs transition-all ${selectedYear === y ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activePlan ? (
        <>
          {/* Status-banner: ingeleverd / besproken / inleveren-knop */}
          <PlanStatusBanner
            plan={activePlan}
            isOwner={isViewingOwnPlan}
            isManager={isAdmin}
            onSubmit={() => submitForReview(activePlan.id)}
            onMarkReviewed={() => markReviewed(activePlan.id)}
          />

          {/* Categorieën */}
          {CATEGORIES.map(cat => (
            <CategorySection
              key={cat.key}
              cat={cat}
              items={itemsByCategory[cat.key] || []}
              canEdit={isViewingOwnPlan || isAdmin}
              isManager={isAdmin}
              isOwner={isViewingOwnPlan}
              onAdd={(title, goals, targetDate) => addItem(cat.key, title, goals, targetDate)}
              onUpdate={updateItem}
              onDelete={(id) => deleteItem(id, activePlan.id)}
            />
          ))}

          {/* Evaluaties */}
          <EvaluationsSection
            plan={activePlan}
            canAdd={isAdmin}
            currentUserId={meId}
            onAdd={(notes) => addEvaluation(activePlan.id, notes)}
            onDelete={(id) => deleteEvaluation(activePlan.id, id)}
          />

          {/* Document-link (legacy DOCX) */}
          {activePlan.documentUrl && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-2 text-xs text-white/50">
              <Icons.download size={14} />
              <span>Oorspronkelijk document:</span>
              <a href={activePlan.documentUrl} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">
                {activePlan.documentName || 'Download DOCX'}
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="card p-10 text-center text-white/40">
          <Icons.target size={32} className="mx-auto mb-3 text-white/20" />
          <p>Selecteer een medewerker om hun ontwikkelplan te bekijken.</p>
        </div>
      )}

      {showImport && <div className="hidden" />}
    </div>
  )
}

// ── Categorie-sectie met items + nieuw item-form ──────────────────────────

function CategorySection({
  cat,
  items,
  canEdit,
  isManager,
  isOwner,
  onAdd,
  onUpdate,
  onDelete,
}: {
  cat: typeof CATEGORIES[number]
  items: DevelopmentPlanItem[]
  canEdit: boolean
  isManager: boolean
  isOwner: boolean
  onAdd: (title: string, goals: string, targetDate: string | null) => void
  onUpdate: (id: string, patch: Partial<DevelopmentPlanItem>) => Promise<DevelopmentPlanItem | undefined>
  onDelete: (id: string) => void
}) {
  const colors = COLOR_CLASSES[cat.color] || COLOR_CLASSES.purple
  const Icon = (Icons as any)[cat.icon]
  const [newTitle, setNewTitle] = useState('')
  const [newGoals, setNewGoals] = useState('')
  const [newDate, setNewDate] = useState<string>('')

  const submit = () => {
    if (!newTitle.trim()) return
    onAdd(newTitle, newGoals, newDate || null)
    setNewTitle('')
    setNewGoals('')
    setNewDate('')
  }

  return (
    <section className={`relative rounded-2xl border bg-gradient-to-br to-transparent p-5 ${colors.border} ${colors.gradient}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon className={colors.accent} size={18} />}
          <div>
            <h2 className="text-lg font-semibold text-white">{cat.label}</h2>
            <p className="text-xs text-white/50">{cat.description}</p>
          </div>
        </div>
        <span className="text-xs text-white/40">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>

      {/* Items */}
      <div className="space-y-3 mb-4">
        {items.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            color={cat.color}
            canEdit={canEdit}
            isManager={isManager}
            isOwner={isOwner}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Nieuw item — alleen als bekijker mag editen */}
      {canEdit && (
        <div className="rounded-xl border border-dashed border-white/15 p-3 space-y-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim() && !newGoals && !newDate) submit() }}
            placeholder={`Nieuw onderdeel voor "${cat.label}"…`}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
          />
          {newTitle.trim() && (
            <>
              <AutoTextarea
                value={newGoals}
                onChange={setNewGoals}
                placeholder="Doelen / wat wil je bereiken? (optioneel)"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
                minRows={2}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <DatePicker
                  selected={newDate ? new Date(newDate) : null}
                  onChange={d => setNewDate(d ? formatDateForAPI(d) : '')}
                  placeholder="Streefdatum (optioneel)"
                />
                <button onClick={submit} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                  <Icons.plus size={12} /> Toevoegen
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ── Item card — title + goals + status + progress + targetDate + evaluation

function ItemCard({
  item,
  color,
  canEdit,
  isManager,
  isOwner,
  onUpdate,
  onDelete,
}: {
  item: DevelopmentPlanItem
  color: string
  canEdit: boolean
  isManager: boolean
  isOwner: boolean
  onUpdate: (id: string, patch: Partial<DevelopmentPlanItem>) => Promise<DevelopmentPlanItem | undefined>
  onDelete: (id: string) => void
}) {
  const colors = COLOR_CLASSES[color] || COLOR_CLASSES.purple
  const [title, setTitle] = useState(item.title)
  const [goals, setGoals] = useState(item.goals || '')
  const [evaluation, setEvaluation] = useState(item.evaluation || '')

  useEffect(() => { setTitle(item.title); setGoals(item.goals || ''); setEvaluation(item.evaluation || '') }, [item.id])

  const debouncedSave = useRef<NodeJS.Timeout | null>(null)
  const scheduleSave = (patch: Partial<DevelopmentPlanItem>) => {
    if (debouncedSave.current) clearTimeout(debouncedSave.current)
    debouncedSave.current = setTimeout(() => onUpdate(item.id, patch), 700)
  }

  const cycleStatus = () => {
    const next = item.status === 'todo' ? 'doing' : item.status === 'doing' ? 'done' : 'doing'
    onUpdate(item.id, { status: next })
  }

  // Lange tekst → browser-tooltip met volledige inhoud bij hover.
  const goalsTitleAttr = (item.goals || '').length > 280 ? item.goals || undefined : undefined
  const evalTitleAttr = (item.evaluation || '').length > 280 ? item.evaluation || undefined : undefined

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start gap-3">
        {/* Status circle */}
        <button
          onClick={cycleStatus}
          disabled={!canEdit}
          className={`flex-shrink-0 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            item.status === 'done'
              ? 'bg-emerald-500 border-emerald-500'
              : item.status === 'doing'
                ? `${colors.accentBg} border-current ${colors.accent}`
                : 'border-white/30 hover:border-white/60'
          } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
          title="Klik om status te wisselen"
        >
          {item.status === 'done' && <Icons.check size={12} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          {canEdit ? (
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
              onBlur={() => { if (title !== item.title) onUpdate(item.id, { title }) }}
              className={`w-full bg-transparent text-sm font-medium focus:outline-none ${item.status === 'done' ? 'text-white/50 line-through' : 'text-white'}`}
            />
          ) : (
            <p className={`text-sm font-medium ${item.status === 'done' ? 'text-white/50 line-through' : 'text-white'}`}>{item.title}</p>
          )}

          {/* Doelen — altijd 1x zichtbaar; inline editable of plain text */}
          {canEdit ? (
            <AutoTextarea
              value={goals}
              onChange={(v) => { setGoals(v); scheduleSave({ goals: v }) }}
              placeholder="Doelen…"
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white/80 focus:border-purple-500/50 focus:bg-white/5 focus:outline-none placeholder:text-white/30 max-h-40 overflow-y-auto"
              minRows={2}
            />
          ) : goals ? (
            <p className="text-xs text-white/70 whitespace-pre-wrap" title={goalsTitleAttr}>{goals}</p>
          ) : null}

          {/* Meta row — status + streefdatum (inline picker bij edit) */}
          <div className="flex items-center gap-3 text-[11px] text-white/40 flex-wrap">
            <span>Status: {item.status === 'todo' ? 'Nog te doen' : item.status === 'doing' ? 'Mee bezig' : 'Afgerond'}</span>
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                <Icons.calendar size={11} />
                <DatePicker
                  selected={item.targetDate ? new Date(item.targetDate) : null}
                  onChange={d => onUpdate(item.id, { targetDate: d ? formatDateForAPI(d) : null })}
                  placeholder="Streefdatum"
                />
              </div>
            ) : item.targetDate ? (
              <span className="flex items-center gap-1">
                <Icons.calendar size={11} />
                {new Date(item.targetDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </span>
            ) : null}
            {item.status === 'done' && item.completedAt && (
              <span className="text-emerald-400">✓ {new Date(item.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
            )}
          </div>

          {/* Progress slider voor 'doing' */}
          {item.status === 'doing' && canEdit && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={item.progress}
                onChange={e => onUpdate(item.id, { progress: parseInt(e.target.value, 10) })}
                className={`flex-1 ${colors.ring}`}
              />
              <span className={`text-xs font-medium tabular-nums w-10 text-right ${colors.accent}`}>{item.progress}%</span>
            </div>
          )}

          {/* Evaluatie — altijd 1x zichtbaar */}
          {canEdit ? (
            <div className="pt-2 border-t border-white/5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
                Evaluatie
                {!isOwner && isManager && <span className="text-[9px] text-amber-300/70 normal-case tracking-normal">door partner</span>}
              </label>
              <AutoTextarea
                value={evaluation}
                onChange={v => { setEvaluation(v); scheduleSave({ evaluation: v }) }}
                placeholder={isOwner ? 'Hoe ging dit onderdeel? Wat heb je geleerd?' : 'Feedback voor medewerker…'}
                className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white/80 focus:border-purple-500/50 focus:bg-white/5 focus:outline-none placeholder:text-white/30 italic max-h-40 overflow-y-auto"
                minRows={2}
              />
            </div>
          ) : evaluation ? (
            <p className="text-[11px] text-white/50 italic whitespace-pre-wrap pt-1 border-t border-white/5" title={evalTitleAttr}>
              <span className="text-amber-300/70 not-italic">Evaluatie:</span> {evaluation}
            </p>
          ) : null}
        </div>

        {canEdit && (
          <button
            onClick={() => onDelete(item.id)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
            title="Verwijderen"
          >
            <Icons.trash size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Status-banner (ingeleverd / besproken / inleveren-knop) ──────────────

function PlanStatusBanner({
  plan,
  isOwner,
  isManager,
  onSubmit,
  onMarkReviewed,
}: {
  plan: DevelopmentPlan
  isOwner: boolean
  isManager: boolean
  onSubmit: () => void
  onMarkReviewed: () => void
}) {
  const hasItems = plan.items.length > 0
  const submitted = !!plan.submittedForReviewAt
  const reviewed = !!plan.reviewedAt

  // Niets te tonen
  if (!isOwner && !isManager) return null
  if (!submitted && !isOwner) return null

  if (reviewed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Icons.check size={18} className="text-emerald-300" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-100">Plan is besproken</p>
          <p className="text-xs text-emerald-200/60">
            Gemarkeerd op {new Date(plan.reviewedAt!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {isOwner && (
          <button onClick={onSubmit} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">
            Opnieuw inleveren
          </button>
        )}
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Icons.chat size={18} className="text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100">
            {isOwner ? 'Ingeleverd ter bespreking' : `${plan.employeeName.split(' ')[0]} heeft ingeleverd`}
          </p>
          <p className="text-xs text-amber-200/60">
            Op {new Date(plan.submittedForReviewAt!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
            {isOwner ? ' — partners krijgen een bespreek-melding op hun dashboard.' : ' — markeer als besproken zodra het gesprek is geweest.'}
          </p>
        </div>
        {isManager && (
          <button
            onClick={onMarkReviewed}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/25 flex items-center gap-1.5"
          >
            <Icons.check size={12} /> Markeer als besproken
          </button>
        )}
      </div>
    )
  }

  // Niet ingeleverd, alleen owner ziet de inlever-knop
  if (isOwner) {
    return (
      <div className="rounded-2xl border border-purple-500/20 bg-white/[0.02] p-4 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Icons.target size={18} className="text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Klaar met invullen?</p>
          <p className="text-xs text-white/50">
            Lever in zodat de partners het kunnen bespreken. Je kunt daarna gewoon verder bijwerken — alleen de voortgang verandert.
          </p>
        </div>
        <button
          onClick={onSubmit}
          disabled={!hasItems}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-100 hover:bg-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          title={hasItems ? '' : 'Voeg eerst items toe'}
        >
          <Icons.send size={12} /> Inleveren bij partners
        </button>
      </div>
    )
  }

  return null
}

// ── Evaluaties-sectie ─────────────────────────────────────────────────────

function EvaluationsSection({
  plan,
  canAdd,
  currentUserId,
  onAdd,
  onDelete,
}: {
  plan: DevelopmentPlan
  canAdd: boolean
  currentUserId?: string
  onAdd: (notes: string) => void
  onDelete: (id: string) => void
}) {
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)

  if (plan.evaluations.length === 0 && !canAdd) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Icons.chat size={16} className="text-white/40" />
          Algemene evaluaties
        </h2>
        {canAdd && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 hover:bg-purple-500/20">
            + Evaluatie toevoegen
          </button>
        )}
      </div>

      {adding && canAdd && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 mb-3 space-y-2">
          <AutoTextarea
            value={newNotes}
            onChange={setNewNotes}
            placeholder="Algemene observaties, voortgang, aandachtspunten…"
            className="w-full text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
            minRows={3}
          />
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewNotes('') }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10">
              Annuleren
            </button>
            <button
              onClick={() => { onAdd(newNotes); setNewNotes(''); setAdding(false) }}
              disabled={!newNotes.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-100 hover:bg-purple-500/30 disabled:opacity-40"
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plan.evaluations.map(ev => (
          <div key={ev.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 group">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-sm font-medium text-white">{ev.evaluatorName}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/40">{new Date(ev.evaluatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {ev.evaluatorId === currentUserId && (
                  <button onClick={() => onDelete(ev.id)} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity" title="Verwijderen">
                    <Icons.trash size={12} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{ev.notes}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
