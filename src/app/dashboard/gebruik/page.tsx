'use client'

// Gebruik-pagina — alleen voor de eigenaar (Jochem). Anonieme gebruiks-
// analytics: weergaven per pagina, trend per dag, en welke pagina's (bijna)
// niet bezocht worden. Geen namen — alleen totalen.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'

interface UsageData {
  totalUsers: number
  activeLast7: number
  activeLast30: number
  totalViews30: number
  perPage: { path: string; label: string; views: number; users: number }[]
  perDay: { date: string; views: number; users: number }[]
  neverVisited: { path: string; label: string }[]
}

export default function GebruikPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const isOwner = (session?.user?.email || '').toLowerCase() === OWNER_EMAIL

  useEffect(() => {
    if (status !== 'authenticated' || !isOwner) { setLoading(false); return }
    fetch('/api/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [status, isOwner])

  if (status === 'loading' || loading) return <div className="p-8 text-gray-400">Laden…</div>
  if (!isOwner) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-semibold text-white">Geen toegang</h1>
        <p className="text-gray-400 mt-1">Deze pagina is alleen voor de beheerder.</p>
      </div>
    )
  }
  if (!data) return <div className="p-8 text-gray-400">Kon gebruiksdata niet laden.</div>

  const maxDay = Math.max(1, ...data.perDay.map(d => d.views))
  const maxPage = Math.max(1, ...data.perPage.map(p => p.views))

  return (
    <div className="space-y-6 fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Icons.chart className="text-workx-lime" size={22} /> Gebruik
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Anonieme gebruiks-statistieken — totalen per pagina, geen namen. Alleen voor jou zichtbaar.
        </p>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Actief (7 dagen)', value: data.activeLast7, sub: `van ${data.totalUsers}`, color: 'text-emerald-400' },
          { label: 'Actief (30 dagen)', value: data.activeLast30, sub: `van ${data.totalUsers}`, color: 'text-emerald-400' },
          { label: 'Weergaven (30 dagen)', value: data.totalViews30, sub: 'paginabezoeken', color: 'text-workx-lime' },
          { label: 'Niet bezocht', value: data.neverVisited.length, sub: 'pagina\'s', color: data.neverVisited.length > 0 ? 'text-amber-400' : 'text-gray-400' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-gray-400">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-gray-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Weergaven per dag */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-white mb-3">Paginaweergaven per dag (laatste 30 dagen)</h2>
        {data.perDay.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen bezoeken geregistreerd. Zodra teamleden pagina's openen, verschijnt het hier.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.perDay.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-workx-lime/60 hover:bg-workx-lime rounded-t transition-colors"
                  style={{ height: `${Math.max(4, (d.views / maxDay) * 100)}%` }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-workx-dark border border-white/10 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  {new Date(d.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}: {d.views} weergaven · {d.users} pers.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per pagina */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Meest bezochte pagina's (30 dagen)</h2>
          <span className="text-[11px] text-gray-500">weergaven · unieke bezoekers</span>
        </div>
        <div className="divide-y divide-white/5">
          {data.perPage.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">Nog geen data.</p>
          ) : data.perPage.map(p => (
            <div key={p.path} className="px-5 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{p.label}</p>
                <p className="text-[11px] text-gray-500 truncate">{p.path}</p>
              </div>
              <div className="w-32 hidden sm:block">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-workx-lime/70" style={{ width: `${(p.views / maxPage) * 100}%` }} />
                </div>
              </div>
              <div className="text-right w-24 shrink-0">
                <span className="text-sm text-white tabular-nums">{p.views}</span>
                <span className="text-[11px] text-gray-500 tabular-nums"> · {p.users}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Niet bezocht */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium text-white">Niet bezocht <span className="text-gray-500 font-normal">(nog nooit geopend)</span></h2>
        </div>
        {data.neverVisited.length === 0 ? (
          <p className="px-5 py-4 text-sm text-emerald-400">Alle pagina's zijn minstens één keer bezocht.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {data.neverVisited.map(p => (
              <div key={p.path} className="px-5 py-2.5 flex items-center gap-3">
                <Icons.x className="text-amber-400/70 shrink-0" size={14} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 truncate">{p.label}</p>
                  <p className="text-[11px] text-gray-500 truncate">{p.path}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
