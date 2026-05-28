'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

interface Step {
  id: number
  naam: string
  omzetWorkx: string
  omzetEigen: string
  inhoud: string
  softskills: string
  bijdrage: string
}

interface StappenplanContent {
  title: string
  subtitle: string
  steps: Step[]
  opmerkingen: string[]
}

const ACCENTS = [
  // Counsel — lime (primair Workx-geel)
  { bgGradient: 'from-workx-lime/25 to-workx-lime/[0.04]', ring: 'border-workx-lime/50', dot: 'bg-workx-lime', text: 'text-workx-lime', tint: 'text-yellow-900 dark:text-workx-lime' },
  // Director — amber
  { bgGradient: 'from-amber-400/25 to-amber-400/[0.04]', ring: 'border-amber-400/50', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', tint: 'text-amber-900 dark:text-amber-200' },
  // Partner — gold/oranje (zwaarder)
  { bgGradient: 'from-orange-400/25 to-orange-400/[0.04]', ring: 'border-orange-400/50', dot: 'bg-orange-400', text: 'text-orange-700 dark:text-orange-300', tint: 'text-orange-900 dark:text-orange-200' },
]

const EMPTY: StappenplanContent = {
  title: 'Stappenplan van Counsel naar Partner',
  subtitle: 'Drie stappen, telkens met duidelijke verwachtingen op inhoud, softskills en bijdrage aan kantoor',
  steps: [],
  opmerkingen: [],
}

export default function StappenplanView() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const canEdit = role === 'PARTNER' || role === 'ADMIN'

  const [content, setContent] = useState<StappenplanContent>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ stepId?: number; field: string; value: string } | null>(null)

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch('/api/policy/stappenplan-partner')
      if (res.ok) {
        const data = await res.json()
        if (data?.content && typeof data.content === 'object') {
          setContent({ ...EMPTY, ...(data.content as StappenplanContent) })
        }
      }
    } catch {
      // silent
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { fetchContent() }, [fetchContent])

  const saveContent = async (next: StappenplanContent) => {
    setSaving(true)
    setContent(next)
    try {
      const res = await fetch('/api/policy/stappenplan-partner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Kon niet opslaan')
      }
    } catch {
      toast.error('Kon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (stepId: number | undefined, field: string, current: string) => {
    if (!canEdit) return
    setEditing({ stepId, field, value: current })
  }

  const commitEdit = () => {
    if (!editing) return
    const trimmed = editing.value.trim()
    const next: StappenplanContent = JSON.parse(JSON.stringify(content))
    if (editing.stepId !== undefined) {
      const step = next.steps.find(s => s.id === editing.stepId)
      if (step) (step as unknown as Record<string, string>)[editing.field] = trimmed
    } else if (editing.field === 'title' || editing.field === 'subtitle') {
      next[editing.field] = trimmed
    } else if (editing.field.startsWith('opmerking-')) {
      const idx = parseInt(editing.field.replace('opmerking-', ''), 10)
      if (!isNaN(idx)) {
        if (trimmed) next.opmerkingen[idx] = trimmed
        else next.opmerkingen.splice(idx, 1)
      }
    }
    setEditing(null)
    saveContent(next)
  }

  const addOpmerking = () => {
    if (!canEdit) return
    const next = { ...content, opmerkingen: [...content.opmerkingen, 'Nieuwe opmerking…'] }
    setContent(next)
    setEditing({ field: `opmerking-${next.opmerkingen.length - 1}`, value: '' })
  }

  // ── Inline-editable field
  const Field = ({ stepId, field, value, multiline, className, placeholder }: {
    stepId?: number
    field: string
    value: string
    multiline?: boolean
    className?: string
    placeholder?: string
  }) => {
    const isEditing = editing?.stepId === stepId && editing?.field === field
    if (isEditing) {
      if (multiline) {
        return (
          <textarea
            autoFocus
            value={editing.value}
            onChange={e => setEditing({ ...editing, value: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Escape') setEditing(null)
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit()
            }}
            className={`w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none ${className || ''}`}
            style={{
              background: 'var(--color-bg-glass)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            rows={3}
          />
        )
      }
      return (
        <input
          autoFocus
          value={editing.value}
          onChange={e => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Escape') setEditing(null)
            if (e.key === 'Enter') commitEdit()
          }}
          className={`w-full rounded-lg px-2 py-1 text-sm focus:outline-none ${className || ''}`}
          style={{
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
      )
    }
    const empty = !value
    return (
      <span
        onClick={() => startEdit(stepId, field, value)}
        className={`${className || ''} ${canEdit ? 'cursor-pointer hover:bg-workx-lime/10 rounded-md transition-colors' : ''} ${empty && canEdit ? 'italic opacity-50' : ''}`}
        title={canEdit ? 'Klik om te bewerken' : undefined}
      >
        {empty ? (placeholder || (canEdit ? 'Klik om te bewerken' : '—')) : value}
      </span>
    )
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(180, 185, 50, 0.3)', borderTopColor: 'rgb(180, 185, 50)' }} />
      </div>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      {/* Decoratieve gele glows — werken in beide thema's */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.20)' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.12)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap mb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(249, 255, 133, 0.35)', border: '1px solid rgba(180, 185, 50, 0.4)' }}>
            🚀
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Stappenplan
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              <Field field="title" value={content.title} />
            </h2>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              <Field field="subtitle" value={content.subtitle} multiline />
            </p>
          </div>
          {saving && (
            <span className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(249, 255, 133, 0.2)', color: 'rgb(140, 150, 30)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgb(140, 150, 30)' }} />
              Opslaan…
            </span>
          )}
        </div>

        {/* Trapsgewijze visuele groei-indicator */}
        <div className="mt-8 mb-2 flex items-end gap-2 h-10">
          {content.steps.map((s, i) => {
            const a = ACCENTS[i] || ACCENTS[0]
            const h = 30 + i * 25
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t-lg ${a.dot}`} style={{ height: `${h}%`, opacity: 0.7 }} />
                <span className={`text-[10px] uppercase tracking-wider font-bold ${a.text}`}>{s.naam.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>

        {/* 3 stap-cards — verticaal gestapeld */}
        <div className="mt-8 space-y-5">
          {content.steps.map((step, i) => {
            const accent = ACCENTS[i] || ACCENTS[0]
            return (
              <div
                key={step.id}
                className={`relative rounded-2xl border ${accent.ring} bg-gradient-to-br ${accent.bgGradient} p-5 sm:p-6`}
                style={{ borderWidth: 1 }}
              >
                {/* Stap-nummer + naam */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${accent.dot}`}
                    style={{ color: '#1e1e1e', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {step.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${accent.text} mb-0.5`}>
                      Stap {step.id}
                    </p>
                    <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      <Field stepId={step.id} field="naam" value={step.naam} />
                    </h3>
                  </div>
                </div>

                {/* Omzet-blokken */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-3 border" style={{ background: 'var(--color-bg-glass)', borderColor: 'var(--color-border-subtle)' }}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      Workx omzet
                    </p>
                    <p className="text-base font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      <Field stepId={step.id} field="omzetWorkx" value={step.omzetWorkx} placeholder="€ ..." />
                    </p>
                  </div>
                  <div className="rounded-xl p-3 border-2" style={{ background: 'rgba(249, 255, 133, 0.12)', borderColor: 'rgba(180, 185, 50, 0.5)' }}>
                    <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${accent.text}`}>
                      Eigen omzet
                    </p>
                    <p className="text-base font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      <Field stepId={step.id} field="omzetEigen" value={step.omzetEigen} placeholder="€ ..." />
                    </p>
                  </div>
                </div>

                {/* Inhoud / softskills / bijdrage */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <Pillar
                    accent={accent}
                    icon="🎯"
                    label="Inhoud"
                  >
                    <Field stepId={step.id} field="inhoud" value={step.inhoud} multiline className="text-sm leading-relaxed" />
                  </Pillar>
                  <Pillar
                    accent={accent}
                    icon="🌱"
                    label="Softskills"
                  >
                    <Field stepId={step.id} field="softskills" value={step.softskills} multiline className="text-sm leading-relaxed" />
                  </Pillar>
                  <Pillar
                    accent={accent}
                    icon="🤝"
                    label="Bijdrage aan kantoor"
                  >
                    <Field stepId={step.id} field="bijdrage" value={step.bijdrage} multiline className="text-sm leading-relaxed" />
                  </Pillar>
                </div>
              </div>
            )
          })}
        </div>

        {/* Opmerkingen */}
        {content.opmerkingen.length > 0 && (
          <div className="mt-8 rounded-2xl border p-5 sm:p-6"
            style={{
              background: 'rgba(249, 255, 133, 0.10)',
              borderColor: 'rgba(180, 185, 50, 0.4)',
            }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgb(140, 150, 30)' }}>
                💡 Opmerkingen en uitgangspunten
              </h3>
              {canEdit && (
                <button
                  onClick={addOpmerking}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={{ background: 'rgba(249, 255, 133, 0.25)', color: 'rgb(140, 150, 30)' }}
                >
                  + Toevoegen
                </button>
              )}
            </div>
            <ol className="space-y-2 list-none">
              {content.opmerkingen.map((opm, i) => (
                <li key={i} className="flex gap-3 items-start group">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                    style={{ background: 'rgba(249, 255, 133, 0.35)', color: 'rgb(110, 120, 20)' }}>
                    {String.fromCharCode(97 + i)}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                    <Field field={`opmerking-${i}`} value={opm} multiline />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Edit hint */}
        {canEdit && (
          <p className="text-[11px] mt-6 italic flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
            <Icons.edit size={11} />
            <span>Klik op een tekst om te bewerken. Wijzigingen worden direct opgeslagen.</span>
          </p>
        )}
      </div>
    </section>
  )
}

function Pillar({
  accent, icon, label, children,
}: {
  accent: typeof ACCENTS[number]
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: 'var(--color-bg-glass)', borderColor: 'var(--color-border-subtle)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base leading-none">{icon}</span>
        <p className={`text-[10px] uppercase tracking-wider font-bold ${accent.text}`}>{label}</p>
      </div>
      <div style={{ color: 'var(--color-text-primary)' }}>
        {children}
      </div>
    </div>
  )
}
