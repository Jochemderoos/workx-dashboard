'use client'

// Partner-widget: ontwikkelplannen die ingeleverd zijn en nog besproken
// moeten worden. Blijft staan tot iemand op "Markeer als besproken" klikt.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface PendingPlan {
  id: string
  employeeName: string
  year: number
  submittedForReviewAt: string
  user: { id: string; name: string; avatarUrl: string | null } | null
  _count: { items: number }
}

function daysSince(iso: string): number {
  const d = new Date(iso)
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export default function DevelopmentPlanReviewWidget() {
  const [plans, setPlans] = useState<PendingPlan[]>([])
  const [loaded, setLoaded] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/development-plans/pending-review')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setPlans(data)
      }
    } catch {
      /* silent */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const markReviewed = async (planId: string, employeeName: string) => {
    if (markingId) return
    setMarkingId(planId)
    try {
      const res = await fetch(`/api/development-plans/${planId}/mark-reviewed`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setPlans(prev => prev.filter(p => p.id !== planId))
      toast.success(`Ontwikkelplan ${employeeName.split(' ')[0]} als besproken gemarkeerd`)
    } catch {
      toast.error('Markeren mislukt')
    } finally {
      setMarkingId(null)
    }
  }

  // Render niets als geladen en leeg — geen lege widget op het dashboard
  if (!loaded) return null
  if (plans.length === 0) return null

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Icons.target size={14} className="text-purple-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Ontwikkelplannen bespreken</h3>
            <p className="text-[10px] text-purple-300/70">
              {plans.length} {plans.length === 1 ? 'medewerker heeft' : 'medewerkers hebben'} hun plan ingeleverd
            </p>
          </div>
        </div>
        <Link href="/dashboard/ontwikkelplannen" className="text-[11px] text-purple-300 hover:text-purple-200 hover:underline">
          Alles bekijken
        </Link>
      </div>

      <div className="space-y-2">
        {plans.map(plan => {
          const name = plan.user?.name || plan.employeeName
          const photo = getPhotoUrl(name)
          const days = daysSince(plan.submittedForReviewAt)
          const ageLabel = days === 0 ? 'vandaag' : days === 1 ? 'gisteren' : `${days} dagen geleden`
          const urgent = days >= 7
          return (
            <div
              key={plan.id}
              className={`flex items-center gap-3 p-2.5 rounded-xl border bg-white/[0.03] transition-colors ${
                urgent ? 'border-amber-500/30' : 'border-white/10'
              }`}
            >
              {photo ? (
                <Image src={photo} alt={name} width={36} height={36} className="w-9 h-9 rounded-lg object-cover ring-2 ring-white/10" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center text-sm font-semibold text-purple-200">
                  {name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{name}</p>
                <p className="text-[11px] text-white/50">
                  {plan._count.items} {plan._count.items === 1 ? 'doel' : 'doelen'} · ingeleverd {ageLabel}
                  {urgent && <span className="ml-1.5 text-amber-300">— wacht al een week</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Link
                  href="/dashboard/ontwikkelplannen"
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Bekijken
                </Link>
                <button
                  onClick={() => markReviewed(plan.id, name)}
                  disabled={markingId === plan.id}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1"
                  title="Plan is besproken — verwijder van dashboard"
                >
                  {markingId === plan.id ? (
                    <span className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                  ) : (
                    <Icons.check size={11} />
                  )}
                  Besproken
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
