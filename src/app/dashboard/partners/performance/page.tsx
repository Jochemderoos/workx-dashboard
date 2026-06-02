'use client'

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'
import { getPhotoUrl } from '@/lib/team-photos'

interface UserRow {
  userId: string
  name: string
  role: string
  total: number
  positive: number
  negative: number
  notDiscussed: number
  lastNoteDate: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'nog geen notities'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days} dagen geleden`
  if (days < 31) return `${Math.floor(days / 7)} weken geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PerformanceOverzichtPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const u = await res.json()
          if (['PARTNER', 'ADMIN'].includes(u.role)) setHasAccess(true)
        }
      } catch {
        // ignore
      }
    }
    check()
  }, [])

  useEffect(() => {
    if (!hasAccess) return
    const load = async () => {
      try {
        const res = await fetch('/api/performance')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setRows(data.users)
      } catch {
        toast.error('Kon overzicht niet laden')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [hasAccess])

  const filtered = useMemo(() => {
    // Partners doen geen performance management over elkaar — eruit filteren.
    const nonPartners = rows.filter(r => r.role !== 'PARTNER')
    const q = filter.trim().toLowerCase()
    if (!q) return nonPartners
    return nonPartners.filter(r => r.name.toLowerCase().includes(q))
  }, [rows, filter])

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      total: acc.total + r.total,
      positive: acc.positive + r.positive,
      negative: acc.negative + r.negative,
      notDiscussed: acc.notDiscussed + r.notDiscussed,
    }), { total: 0, positive: 0, negative: 0, notDiscussed: 0 })
  }, [rows])

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
          <p className="text-sm text-gray-400">Alleen voor partners en office management.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span className="text-gray-400">Laden…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-7xl mx-auto relative">
      {/* Decorative */}
      <div className="absolute top-0 right-[10%] w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-64 h-64 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-rose-500/10 flex items-center justify-center">
            <Icons.target className="text-workx-lime" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white"><TextReveal>Performance Management</TextReveal></h1>
            <p className="text-sm text-gray-400">
              Noteer per medewerker observaties — positief én verbeterpunten. Vormt de basis voor beoordelingen.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Notities totaal</p>
          <p className="text-2xl font-semibold text-white">{totals.total}</p>
        </div>
        <div className="card p-4 border border-emerald-500/15">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Positief
          </p>
          <p className="text-2xl font-semibold text-emerald-400">{totals.positive}</p>
        </div>
        <div className="card p-4 border border-rose-500/15">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Kritisch
          </p>
          <p className="text-2xl font-semibold text-rose-400">{totals.negative}</p>
        </div>
        <div className="card p-4 border border-amber-500/15">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <Icons.alertTriangle size={11} className="text-amber-400" /> Niet besproken
          </p>
          <p className="text-2xl font-semibold text-amber-400">{totals.notDiscussed}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-xs">
        <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter op naam…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
        />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative">
        {filtered.map((row) => {
          const photo = getPhotoUrl(row.name)
          const positiveRatio = row.total > 0 ? (row.positive / row.total) * 100 : 0
          const hasNotes = row.total > 0

          return (
            <Link
              key={row.userId}
              href={`/dashboard/partners/performance/${row.userId}`}
              className="card p-5 hover:border-workx-lime/30 hover:shadow-lg hover:shadow-workx-lime/5 transition-all group relative overflow-hidden"
            >
              {row.notDiscussed > 0 && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                  <Icons.alertTriangle size={10} />
                  {row.notDiscussed}× bespreken
                </span>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 ring-2 ring-white/5 group-hover:ring-workx-lime/30 transition-all">
                  {photo ? (
                    <Image src={photo} alt={row.name} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base font-semibold text-gray-300">
                      {row.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{row.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                    {row.role === 'PARTNER' ? 'Partner' : row.role === 'ADMIN' ? 'Office' : 'Advocaat'}
                  </p>
                </div>
              </div>

              {/* Counts */}
              {hasNotes ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                      <div className="h-full bg-emerald-400/60" style={{ width: `${positiveRatio}%` }} />
                      <div className="h-full bg-rose-400/60 flex-1" />
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums">{row.total}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <strong>{row.positive}</strong> positief
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <strong>{row.negative}</strong> kritisch
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3">
                    Laatste notitie: <span className="text-gray-400">{timeAgo(row.lastNoteDate)}</span>
                  </p>
                </>
              ) : (
                <div className="py-3">
                  <p className="text-sm text-gray-500 mb-2">Nog geen notities</p>
                  <p className="text-xs text-workx-lime/80 group-hover:text-workx-lime transition-colors">
                    Klik om een eerste observatie te noteren →
                  </p>
                </div>
              )}
            </Link>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full card p-8 text-center">
            <p className="text-gray-400">Geen medewerkers gevonden voor "{filter}"</p>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 relative">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icons.info className="text-blue-400" size={16} />
          </div>
          <div className="text-sm text-gray-400">
            <p className="text-white font-medium mb-1">Waarom?</p>
            <p>
              Door observaties — groot of klein, positief of kritisch — direct kort vast te leggen heb je bij
              beoordelingen en werkverdelingsgesprekken een onderbouwde basis. Klik op een medewerker om snel
              iets toe te voegen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
