'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import TextReveal from '@/components/ui/TextReveal'

interface Item {
  id: string
  category: string
  title: string
  description: string | null
  status: 'todo' | 'doing' | 'done'
  progress: number
  targetDate: string | null
  completedAt: string | null
  createdAt: string
}

interface Evaluation {
  id: string
  evaluatorName: string
  notes: string
  evaluatedAt: string
}

interface PlanWithUser {
  id: string
  year: number
  userId: string
  user: { id: string; name: string; email: string; avatarUrl: string | null; role: string } | null
  items: Item[]
  evaluations: Evaluation[]
}

const CAT_LABEL: Record<string, string> = {
  theorie: 'Theorie',
  praktijk: 'Praktijk',
  acquisitie: 'Acquisitie',
  intern: 'Intern',
}
const CAT_COLOR: Record<string, string> = {
  theorie: 'text-purple-300',
  praktijk: 'text-indigo-300',
  acquisitie: 'text-emerald-300',
  intern: 'text-amber-300',
}

export default function PartnerJaarplannenPage() {
  const { data: session } = useSession()
  const [plans, setPlans] = useState<PlanWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [year] = useState(new Date().getFullYear())
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [evalDraft, setEvalDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/year-plan/overview?year=${year}`)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Kon overzicht niet laden — alleen partners, admins en Hanna hebben toegang'))
      .finally(() => setIsLoading(false))
  }, [year])

  const addEvaluation = async (planId: string) => {
    const notes = evalDraft[planId]?.trim()
    if (!notes) return
    try {
      const res = await fetch('/api/year-plan/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, notes }),
      })
      if (!res.ok) throw new Error()
      const ev = await res.json()
      setPlans(ps => ps.map(p => p.id === planId ? { ...p, evaluations: [ev, ...p.evaluations] } : p))
      setEvalDraft(s => ({ ...s, [planId]: '' }))
      toast.success('Evaluatie toegevoegd')
    } catch {
      toast.error('Toevoegen mislukt')
    }
  }

  const stats = useMemo(() => {
    const totalItems = plans.reduce((s, p) => s + p.items.length, 0)
    const totalDone = plans.reduce((s, p) => s + p.items.filter(i => i.status === 'done').length, 0)
    const activePlans = plans.filter(p => p.items.length > 0).length
    return { totalItems, totalDone, activePlans }
  }, [plans])

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6 fade-in">
        <div className="card p-8 text-center text-white/50">Overzicht laden…</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6 fade-in relative">
      {/* Hero */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center">
              <Icons.target className="text-purple-300" size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                <TextReveal>{`Jaarplannen ${year}`}</TextReveal>
              </h1>
              <p className="text-sm text-white/60 mt-0.5">Overzicht ontwikkelplannen team · klik op kaart om uit te klappen</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">{stats.activePlans}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">actieve plannen</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-300 tabular-nums">{stats.totalDone}<span className="text-sm text-white/40">/{stats.totalItems}</span></p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">doelen afgerond</p>
            </div>
          </div>
        </div>
      </div>

      {plans.length === 0 && (
        <div className="card p-8 text-center text-white/50 italic">Nog geen jaarplannen voor {year}.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map(plan => {
          const u = plan.user!
          const photo = getPhotoUrl(u.name, u.avatarUrl)
          const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          const total = plan.items.length
          const done = plan.items.filter(i => i.status === 'done').length
          const doing = plan.items.filter(i => i.status === 'doing').length
          const avg = total > 0 ? Math.round(plan.items.reduce((s, i) => s + (i.status === 'done' ? 100 : i.progress), 0) / total) : 0
          const expanded = expandedUserId === u.id

          // Items per categorie
          const itemsByCat: Record<string, Item[]> = { theorie: [], praktijk: [], acquisitie: [], intern: [] }
          for (const it of plan.items) (itemsByCat[it.category] ||= []).push(it)

          return (
            <div
              key={plan.id}
              className={`card p-4 transition-all ${expanded ? 'ring-1 ring-purple-500/30' : 'hover:bg-white/5'} cursor-pointer`}
              onClick={() => setExpandedUserId(expanded ? null : u.id)}
            >
              {/* Header met foto + naam + progress */}
              <div className="flex items-center gap-3">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={u.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-semibold text-purple-200 flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-white truncate">{u.name}</p>
                  <p className="text-xs text-white/50">{total === 0 ? 'Nog geen doelen' : `${done}/${total} afgerond · ${doing} mee bezig`}</p>
                </div>
                <Icons.chevronDown size={16} className={`text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all"
                      style={{ width: `${avg}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-white/40">
                    <span>{avg}% gem.</span>
                    <span>{plan.evaluations.length} evaluatie{plan.evaluations.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              )}

              {/* Uitgeklapte details */}
              {expanded && (
                <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                  {/* Items per categorie */}
                  {Object.entries(itemsByCat).map(([cat, items]) => items.length > 0 && (
                    <div key={cat}>
                      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${CAT_COLOR[cat]}`}>
                        {CAT_LABEL[cat]} · {items.length}
                      </p>
                      <ul className="space-y-1 ml-1">
                        {items.map(it => (
                          <li key={it.id} className="flex items-start gap-2 text-xs">
                            <span className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                              it.status === 'done' ? 'bg-emerald-500'
                                : it.status === 'doing' ? 'bg-purple-500/60'
                                : 'bg-white/20'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className={`${it.status === 'done' ? 'text-white/50 line-through' : 'text-white/80'}`}>
                                {it.title}
                              </p>
                              {it.status === 'doing' && (
                                <p className="text-[10px] text-purple-300/70">{it.progress}% voortgang</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Bestaande evaluaties */}
                  {plan.evaluations.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-white/40 mb-2">Evaluaties</p>
                      <div className="space-y-2">
                        {plan.evaluations.map(ev => (
                          <div key={ev.id} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-xs font-medium text-white/80">{ev.evaluatorName}</span>
                              <span className="text-[10px] text-white/40">{new Date(ev.evaluatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <p className="text-xs text-white/70 whitespace-pre-wrap">{ev.notes}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nieuwe evaluatie toevoegen */}
                  <div className="pt-2 border-t border-white/5">
                    <textarea
                      value={evalDraft[plan.id] || ''}
                      onChange={e => setEvalDraft(s => ({ ...s, [plan.id]: e.target.value }))}
                      rows={2}
                      placeholder="Evaluatie toevoegen…"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30 resize-none"
                    />
                    <button
                      onClick={() => addEvaluation(plan.id)}
                      disabled={!evalDraft[plan.id]?.trim()}
                      className="mt-2 btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icons.chat size={12} />
                      Evaluatie toevoegen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
