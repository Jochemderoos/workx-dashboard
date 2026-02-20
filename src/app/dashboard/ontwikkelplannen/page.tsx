'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Section {
  number: number
  title: string
  goals: string
  evaluation: string
}

interface DevelopmentPlan {
  id: string
  userId: string | null
  employeeName: string
  period: string
  year: number
  sections: string // JSON string
  status: string
  generalNotes: string | null
  evaluationDate: string | null
  documentUrl: string | null
  documentName: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; role: string } | null
}

// Group plans by employee name
function groupByEmployee(plans: DevelopmentPlan[]): Record<string, DevelopmentPlan[]> {
  const groups: Record<string, DevelopmentPlan[]> = {}
  for (const plan of plans) {
    const key = plan.employeeName
    if (!groups[key]) groups[key] = []
    groups[key].push(plan)
  }
  // Sort each group by year descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.year - a.year || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  return groups
}

function parseSections(plan: DevelopmentPlan): Section[] {
  try {
    return JSON.parse(plan.sections)
  } catch {
    return []
  }
}

// Auto-growing textarea component
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
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
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={1}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  )
}

export default function OntwikkelplannenPage() {
  const { data: session } = useSession()
  const [plans, setPlans] = useState<DevelopmentPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showNewPlanForm, setShowNewPlanForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isAdmin = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

  // Fetch all plans
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/development-plans')
      if (!res.ok) throw new Error('Fout bij ophalen')
      const data = await res.json()
      setPlans(data)
    } catch {
      toast.error('Kon ontwikkelplannen niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // Auto-select employee for non-admin users
  useEffect(() => {
    if (!isAdmin && plans.length > 0 && !selectedEmployee) {
      // Find the employee name that matches the current user
      const myPlan = plans.find(p => p.userId === session?.user?.id)
      if (myPlan) {
        setSelectedEmployee(myPlan.employeeName)
      }
    }
  }, [plans, isAdmin, session?.user?.id, selectedEmployee])

  const grouped = groupByEmployee(plans)
  const employeeNames = Object.keys(grouped).sort()

  // Get plans for selected employee
  const employeePlans = selectedEmployee ? (grouped[selectedEmployee] || []) : []
  const years = Array.from(new Set(employeePlans.map(p => p.year))).sort((a, b) => b - a)

  // Auto-select latest year when employee changes
  useEffect(() => {
    if (years.length > 0 && (selectedYear === null || !years.includes(selectedYear))) {
      setSelectedYear(years[0])
    }
  }, [selectedEmployee, years, selectedYear])

  const currentPlan = employeePlans.find(p => p.year === selectedYear) || null

  // Save plan (debounced)
  const savePlan = useCallback(async (planId: string, data: Record<string, unknown>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/development-plans/${planId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error()
      } catch {
        toast.error('Opslaan mislukt')
      }
    }, 800)
  }, [])

  // Update section in current plan
  const updateSection = useCallback((planId: string, sectionIndex: number, field: keyof Section, value: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const sections = parseSections(p)
      sections[sectionIndex] = { ...sections[sectionIndex], [field]: value }
      const updated = { ...p, sections: JSON.stringify(sections) }
      savePlan(planId, { sections })
      return updated
    }))
  }, [savePlan])

  // Add new section row
  const addSection = useCallback((planId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const sections = parseSections(p)
      const nextNum = sections.length > 0 ? Math.max(...sections.map(s => s.number)) + 1 : 1
      sections.push({ number: nextNum, title: '', goals: '', evaluation: '' })
      const updated = { ...p, sections: JSON.stringify(sections) }
      savePlan(planId, { sections })
      return updated
    }))
  }, [savePlan])

  // Remove section row
  const removeSection = useCallback((planId: string, sectionIndex: number) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const sections = parseSections(p)
      sections.splice(sectionIndex, 1)
      const updated = { ...p, sections: JSON.stringify(sections) }
      savePlan(planId, { sections })
      return updated
    }))
  }, [savePlan])

  // Update plan meta fields
  const updatePlanField = useCallback((planId: string, field: string, value: unknown) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const updated = { ...p, [field]: value }
      savePlan(planId, { [field]: value })
      return updated
    }))
  }, [savePlan])

  // Upload DOCX
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/development-plans/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload mislukt')
      }

      toast.success('Plan geüpload en verwerkt')
      fetchPlans()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [fetchPlans])

  // Import from local directory
  const handleImport = useCallback(async () => {
    setIsImporting(true)
    try {
      const res = await fetch('/api/development-plans/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) throw new Error('Import mislukt')

      const data = await res.json()
      toast.success(data.message)
      fetchPlans()
    } catch {
      toast.error('Import mislukt')
    } finally {
      setIsImporting(false)
    }
  }, [fetchPlans])

  // Delete plan
  const handleDelete = useCallback(async (planId: string) => {
    if (!confirm('Weet je zeker dat je dit plan wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/development-plans/${planId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Plan verwijderd')
      setPlans(prev => prev.filter(p => p.id !== planId))
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }, [])

  // Create new empty plan
  const handleCreatePlan = useCallback(async (employeeName: string, period: string, year: number) => {
    try {
      const users = plans.filter(p => p.employeeName === employeeName)
      const userId = users[0]?.userId || null

      const res = await fetch('/api/development-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          employeeName,
          period,
          year,
          sections: [
            { number: 1, title: 'Inhoud – theorie', goals: '', evaluation: '' },
            { number: 2, title: 'Inhoud – praktijk', goals: '', evaluation: '' },
            { number: 3, title: 'Eigen praktijk en zaken', goals: '', evaluation: '' },
            { number: 4, title: 'Intern', goals: '', evaluation: '' },
          ],
          status: 'actief',
        }),
      })

      if (!res.ok) throw new Error()
      toast.success('Nieuw plan aangemaakt')
      setShowNewPlanForm(false)
      fetchPlans()
    } catch {
      toast.error('Aanmaken mislukt')
    }
  }, [plans, fetchPlans])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Ontwikkelplannen laden...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-workx-lime/10 border border-workx-lime/20">
            <Icons.target size={22} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ontwikkelplannen</h1>
            <p className="text-sm text-white/40">
              {isAdmin
                ? `${employeeNames.length} medewerkers · ${plans.length} plannen`
                : 'Jouw ontwikkelplannen'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {plans.length === 0 && (
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importeren...
                  </>
                ) : (
                  <>
                    <Icons.download size={16} />
                    Importeer DOCX bestanden
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl bg-workx-lime/10 border border-workx-lime/20 text-workx-lime hover:bg-workx-lime/20 transition-all text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploaden...
                </>
              ) : (
                <>
                  <Icons.upload size={16} />
                  Upload DOCX
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => setShowNewPlanForm(true)}
              className="px-4 py-2 rounded-xl bg-workx-lime/10 border border-workx-lime/20 text-workx-lime hover:bg-workx-lime/20 transition-all text-sm flex items-center gap-2"
            >
              <Icons.plus size={16} />
              Nieuw plan
            </button>
          </div>
        )}
      </div>

      {/* Employee selector (admin only) */}
      {isAdmin && employeeNames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {employeeNames.map((name) => {
            const isSelected = selectedEmployee === name
            const photoUrl = getPhotoUrl(name)
            const planCount = grouped[name].length
            const latestYear = grouped[name][0]?.year

            return (
              <button
                key={name}
                onClick={() => {
                  setSelectedEmployee(name)
                  setSelectedYear(null)
                }}
                className={`relative group p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-workx-lime/10 border-workx-lime/30 shadow-lg shadow-workx-lime/5'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {isSelected && (
                  <div className="absolute inset-0 bg-workx-lime/5 rounded-xl blur-xl" />
                )}
                <div className="relative flex items-center gap-3">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt={name}
                      width={36}
                      height={36}
                      className={`w-9 h-9 rounded-lg object-cover ring-2 ${
                        isSelected ? 'ring-workx-lime/40' : 'ring-white/10'
                      }`}
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold ${
                      isSelected
                        ? 'bg-workx-lime/20 text-workx-lime'
                        : 'bg-white/10 text-white/60'
                    }`}>
                      {name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-workx-lime' : 'text-white'}`}>
                      {name.split(' ')[0]}
                    </p>
                    <p className="text-xs text-white/30">
                      {planCount} {planCount === 1 ? 'plan' : 'plannen'} · {latestYear}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Year tabs */}
      {selectedEmployee && years.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {years.map((year) => {
            const isActive = selectedYear === year
            const plan = employeePlans.find(p => p.year === year)
            return (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? 'bg-workx-lime/10 border border-workx-lime/30 text-workx-lime'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {year}
                {plan?.status === 'actief' && (
                  <span className="w-2 h-2 rounded-full bg-workx-lime animate-pulse" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Current plan display */}
      {currentPlan ? (
        <PlanEditor
          plan={currentPlan}
          isAdmin={isAdmin}
          onUpdateSection={updateSection}
          onAddSection={addSection}
          onRemoveSection={removeSection}
          onUpdateField={updatePlanField}
          onDelete={handleDelete}
        />
      ) : selectedEmployee ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <Icons.target size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40">Geen plan gevonden voor deze periode</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <Icons.target size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40">
            {plans.length === 0
              ? 'Nog geen ontwikkelplannen. Importeer DOCX bestanden om te beginnen.'
              : 'Selecteer een medewerker om hun ontwikkelplannen te bekijken'}
          </p>
        </div>
      )}

      {/* New plan modal */}
      {showNewPlanForm && (
        <NewPlanModal
          employees={employeeNames}
          onSubmit={handleCreatePlan}
          onClose={() => setShowNewPlanForm(false)}
        />
      )}
    </div>
  )
}

// Plan editor component
function PlanEditor({
  plan,
  isAdmin,
  onUpdateSection,
  onAddSection,
  onRemoveSection,
  onUpdateField,
  onDelete,
}: {
  plan: DevelopmentPlan
  isAdmin: boolean
  onUpdateSection: (planId: string, idx: number, field: keyof Section, value: string) => void
  onAddSection: (planId: string) => void
  onRemoveSection: (planId: string, idx: number) => void
  onUpdateField: (planId: string, field: string, value: unknown) => void
  onDelete: (planId: string) => void
}) {
  const sections = parseSections(plan)

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {plan.employeeName}
              {plan.status === 'actief' && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-workx-lime/10 text-workx-lime border border-workx-lime/20">
                  Actief
                </span>
              )}
              {plan.status === 'afgerond' && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/50 border border-white/10">
                  Afgerond
                </span>
              )}
            </h2>
            <p className="text-sm text-white/40 mt-0.5">
              Periode: {plan.period} · {plan.year}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => onUpdateField(plan.id, 'status', plan.status === 'actief' ? 'afgerond' : 'actief')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    plan.status === 'actief'
                      ? 'bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {plan.status === 'actief' ? 'Markeer afgerond' : 'Markeer actief'}
                </button>
                <button
                  onClick={() => onDelete(plan.id)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Verwijderen"
                >
                  <Icons.trash size={16} />
                </button>
              </>
            )}
            {plan.documentUrl && (
              <a
                href={plan.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 text-xs transition-all flex items-center gap-1.5"
              >
                <Icons.download size={14} />
                DOCX
              </a>
            )}
          </div>
        </div>

        {/* Sections table */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_2fr_1.5fr] bg-workx-lime/5 border-b border-white/10">
            <div className="p-3 text-xs font-semibold text-workx-lime/70">#</div>
            <div className="p-3 text-xs font-semibold text-workx-lime/70">Onderdeel</div>
            <div className="p-3 text-xs font-semibold text-workx-lime/70">Doelen</div>
            <div className="p-3 text-xs font-semibold text-workx-lime/70">Evaluatie</div>
          </div>

          {/* Rows */}
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[40px_1fr_2fr_1.5fr] border-b border-white/5 last:border-b-0 group hover:bg-white/[0.02] transition-colors"
            >
              <div className="p-3 text-sm text-white/40 flex items-start justify-between">
                <span>{section.number}.</span>
                {isAdmin && (
                  <button
                    onClick={() => onRemoveSection(plan.id, idx)}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                    title="Verwijder rij"
                  >
                    <Icons.x size={12} />
                  </button>
                )}
              </div>
              <div className="p-2">
                <AutoTextarea
                  value={section.title}
                  onChange={(val) => onUpdateSection(plan.id, idx, 'title', val)}
                  placeholder="Onderdeel..."
                  className="w-full bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none focus:bg-white/5 rounded-lg p-1 transition-colors"
                />
              </div>
              <div className="p-2">
                <AutoTextarea
                  value={section.goals}
                  onChange={(val) => onUpdateSection(plan.id, idx, 'goals', val)}
                  placeholder="Doelen..."
                  className="w-full bg-transparent text-sm text-white/70 placeholder-white/20 focus:outline-none focus:bg-white/5 rounded-lg p-1 transition-colors"
                />
              </div>
              <div className="p-2">
                <AutoTextarea
                  value={section.evaluation}
                  onChange={(val) => onUpdateSection(plan.id, idx, 'evaluation', val)}
                  placeholder="Evaluatie..."
                  className="w-full bg-transparent text-sm text-white/60 placeholder-white/20 focus:outline-none focus:bg-white/5 rounded-lg p-1 transition-colors italic"
                />
              </div>
            </div>
          ))}

          {/* Add row button */}
          {isAdmin && (
            <button
              onClick={() => onAddSection(plan.id)}
              className="w-full p-2.5 text-xs text-white/30 hover:text-workx-lime hover:bg-workx-lime/5 transition-all flex items-center justify-center gap-1.5"
            >
              <Icons.plus size={14} />
              Rij toevoegen
            </button>
          )}
        </div>
      </div>

      {/* Evaluation section */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
          <Icons.fileText size={16} />
          Evaluatie
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/30 mb-1">Algemene opmerkingen</label>
            <AutoTextarea
              value={plan.generalNotes || ''}
              onChange={(val) => onUpdateField(plan.id, 'generalNotes', val)}
              placeholder="Opmerkingen bij dit ontwikkelplan..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-workx-lime/30 transition-colors"
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-white/30 mb-1">Datum evaluatie</label>
              <input
                type="date"
                value={plan.evaluationDate ? plan.evaluationDate.split('T')[0] : ''}
                onChange={(e) => onUpdateField(plan.id, 'evaluationDate', e.target.value || null)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-workx-lime/30 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-white/30 mb-1">Status</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateField(plan.id, 'status', 'actief')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    plan.status === 'actief'
                      ? 'bg-workx-lime/10 text-workx-lime border border-workx-lime/20'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  In behandeling
                </button>
                <button
                  onClick={() => onUpdateField(plan.id, 'status', 'afgerond')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    plan.status === 'afgerond'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  Geëvalueerd
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// New plan modal
function NewPlanModal({
  employees,
  onSubmit,
  onClose,
}: {
  employees: string[]
  onSubmit: (name: string, period: string, year: number) => void
  onClose: () => void
}) {
  const [name, setName] = useState(employees[0] || '')
  const [customName, setCustomName] = useState('')
  const [period, setPeriod] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalName = name === '__custom__' ? customName : name
    if (!finalName || !period) {
      toast.error('Vul alle velden in')
      return
    }
    onSubmit(finalName, period, year)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Nieuw ontwikkelplan</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Medewerker</label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
            >
              {employees.map(n => (
                <option key={n} value={n} className="bg-[#1a1a2e]">{n}</option>
              ))}
              <option value="__custom__" className="bg-[#1a1a2e]">Andere medewerker...</option>
            </select>
            {name === '__custom__' && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Naam medewerker"
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30"
              />
            )}
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-1">Periode</label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="bijv. september 2025 – maart 2026"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-1">Jaar</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 text-sm transition-all"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-xl bg-workx-lime/10 border border-workx-lime/20 text-workx-lime hover:bg-workx-lime/20 text-sm font-medium transition-all"
            >
              Aanmaken
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
