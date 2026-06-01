'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'

type ClientType = 'WERKNEMER' | 'WERKGEVER'

interface ClassifiedClient {
  displayName: string
  clientKey: string
  type: ClientType
  isManual: boolean
  totalExcl: number
  invoiceCount: number
}

interface ApiResponse {
  year: number
  totals: {
    werknemer: number
    werkgever: number
    werknemerCount: number
    werkgeverCount: number
    total: number
    invoices: number
    uniqueClients: number
  }
  clients: ClassifiedClient[]
}

const fmtEur = (n: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n)

export default function OmzetClassificatiePage() {
  const [year, setYear] = useState(2025)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [filter, setFilter] = useState('')
  const [showOnly, setShowOnly] = useState<'all' | 'werknemer' | 'werkgever'>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const u = await res.json()
          if (['PARTNER', 'ADMIN'].includes(u.role)) setHasAccess(true)
        }
      } catch { /* ignore */ }
    }
    check()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/financien/omzet-classificatie?year=${year}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Kon data niet laden')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  const setType = async (c: ClassifiedClient, newType: ClientType) => {
    setBusyKey(c.clientKey)
    try {
      const res = await fetch('/api/financien/omzet-classificatie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: c.clientKey, displayName: c.displayName, type: newType }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      toast.error('Kon classificatie niet opslaan')
    } finally {
      setBusyKey(null)
    }
  }

  const resetHeuristiek = async (c: ClassifiedClient) => {
    setBusyKey(c.clientKey)
    try {
      const res = await fetch('/api/financien/omzet-classificatie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: c.clientKey, displayName: c.displayName, type: null }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      toast.error('Kon override niet verwijderen')
    } finally {
      setBusyKey(null)
    }
  }

  const filteredClients = useMemo<ClassifiedClient[]>(() => {
    if (!data) return []
    const q = filter.trim().toLowerCase()
    return data.clients.filter(c => {
      if (showOnly === 'werknemer' && c.type !== 'WERKNEMER') return false
      if (showOnly === 'werkgever' && c.type !== 'WERKGEVER') return false
      if (q && !c.displayName.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, filter, showOnly])

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <Icons.lock className="text-red-400 mx-auto mb-3" size={28} />
          <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
          <p className="text-sm text-gray-400">Alleen voor partners en admin.</p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  const pctWerknemer = data.totals.total > 0 ? (data.totals.werknemer / data.totals.total) * 100 : 0

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/10 flex items-center justify-center">
            <Icons.pieChart className="text-blue-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white"><TextReveal>Omzet — werknemer vs werkgever</TextReveal></h1>
            <p className="text-sm text-gray-400">
              Op basis van het deel vóór de '/' in de dossiernaam. Klopt iets niet? Wijzig per klant.
            </p>
          </div>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
        >
          {[2023, 2024, 2025, 2026].map(y => (
            <option key={y} value={y} className="bg-workx-dark">{y}</option>
          ))}
        </select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4 col-span-2 sm:col-span-2 border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <p className="text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">Werknemerszaken</p>
          <p className="text-2xl font-bold text-white">{fmtEur(data.totals.werknemer)}</p>
          <p className="text-xs text-gray-500 mt-1">{data.totals.werknemerCount} facturen · {pctWerknemer.toFixed(1)}%</p>
        </div>
        <div className="card p-4 col-span-2 sm:col-span-2 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-300 mb-1">Werkgeverszaken</p>
          <p className="text-2xl font-bold text-white">{fmtEur(data.totals.werkgever)}</p>
          <p className="text-xs text-gray-500 mt-1">{data.totals.werkgeverCount} facturen · {(100 - pctWerknemer).toFixed(1)}%</p>
        </div>
      </div>
      <div className="card p-3 flex items-center gap-4 text-xs">
        <span className="text-gray-400">Totaal {year}:</span>
        <strong className="text-white text-base">{fmtEur(data.totals.total)}</strong>
        <span className="text-gray-500">over {data.totals.invoices} facturen / {data.totals.uniqueClients} klanten</span>
        {data.totals.total > 0 && (
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden ml-2 flex max-w-md">
            <div className="h-full bg-blue-400/70" style={{ width: `${pctWerknemer}%` }} />
            <div className="h-full bg-emerald-400/70 flex-1" />
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter op klant…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {([
            { id: 'all' as const, label: 'Alles' },
            { id: 'werknemer' as const, label: 'Werknemer' },
            { id: 'werkgever' as const, label: 'Werkgever' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setShowOnly(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showOnly === t.id ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                <th className="text-left py-3 px-4 font-semibold">Klant</th>
                <th className="text-right py-3 px-4 font-semibold">Omzet ({year})</th>
                <th className="text-right py-3 px-4 font-semibold">Facturen</th>
                <th className="text-center py-3 px-4 font-semibold w-72">Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c, idx) => {
                const isWerknemer = c.type === 'WERKNEMER'
                const busy = busyKey === c.clientKey
                return (
                  <tr
                    key={c.clientKey}
                    className={idx % 2 === 0 ? 'bg-white/[0.02]' : ''}
                  >
                    <td className="py-2.5 px-4 text-white">
                      {c.displayName}
                      {c.isManual && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider text-amber-300/80">handmatig</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-white tabular-nums font-medium">
                      {fmtEur(c.totalExcl)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">
                      {c.invoiceCount}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setType(c, 'WERKNEMER')}
                          disabled={busy}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                            isWerknemer
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'
                          } disabled:opacity-40`}
                        >
                          Werknemer
                        </button>
                        <button
                          onClick={() => setType(c, 'WERKGEVER')}
                          disabled={busy}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                            !isWerknemer
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'
                          } disabled:opacity-40`}
                        >
                          Werkgever
                        </button>
                        {c.isManual && (
                          <button
                            onClick={() => resetHeuristiek(c)}
                            disabled={busy}
                            className="px-2 py-1 rounded-md text-[10px] text-gray-500 hover:text-white transition-colors"
                            title="Override verwijderen, terug naar heuristiek"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                    Geen klanten gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 text-xs text-gray-400">
        <p className="text-white font-medium mb-1">Hoe werkt het?</p>
        <p>
          Het systeem kijkt naar het deel vóór de '/' in de dossiernaam (uit BaseNet-import).
          Bevat dat een bedrijfsindicator (<em>B.V., N.V., Holding, Group, Stichting,</em> etc.) →
          werkgeverszaak. Anders → werknemerszaak. Klopt iets niet? Klik op het juiste type bij
          die klant. Met ↺ keer je terug naar de automatische classificatie.
        </p>
      </div>
    </div>
  )
}
