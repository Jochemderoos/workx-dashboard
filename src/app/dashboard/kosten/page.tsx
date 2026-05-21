'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { groupKey } from '@/lib/cost-vendor'
import { amountExVat, vatRateFor } from '@/lib/cost-vat'

interface Cost {
  id: string
  year: number
  month: number
  amount: number
  description: string
  sortOrder: number
  createdAt: string
  category?: string | null
}

const MONTHS = [
  '', 'Januari', 'Februari', 'Maart', 'April', 'Mei',
  'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
]

function formatEUR(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function KostenPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const hasAccess = role === 'PARTNER' || role === 'ADMIN'

  const [costs, setCosts] = useState<Cost[]>([])
  const [costsOther, setCostsOther] = useState<Cost[]>([]) // ander jaar t.b.v. vergelijking
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<number>(2026)
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth() + 1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDesc, setNewDesc] = useState('')
  // MT940 import state
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importItems, setImportItems] = useState<Array<{
    date: string; year: number; month: number; amount: number;
    description: string; rawKey: string; externalRef: string;
    category?: string | null;
    isDuplicate: boolean; isLearned: boolean; selected: boolean
  }>>([])
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const otherYear = year === 2026 ? 2025 : 2026
      const [r1, r2] = await Promise.all([
        fetch(`/api/monthly-costs?year=${year}`),
        fetch(`/api/monthly-costs?year=${otherYear}`),
      ])
      // UWV/ASR zijn werkgeversvergoedingen (negatieve bedragen die bij
      // werkgeverslasten worden afgetrokken in Financien). Niet tonen als
      // kost om dubbeltelling te voorkomen.
      const filterRows = (rows: Cost[]) => rows.filter(c => c.category !== 'UWV' && c.category !== 'ASR')
      if (r1.ok) setCosts(filterRows(await r1.json()))
      if (r2.ok) setCostsOther(filterRows(await r2.json()))
    } catch {
      toast.error('Kon kosten niet laden')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    if (hasAccess) fetchData()
    else setLoading(false)
  }, [hasAccess, fetchData])

  const addCost = async () => {
    const amount = parseFloat(newAmount.replace(',', '.'))
    if (!amount || !newDesc.trim()) {
      toast.error('Bedrag en omschrijving zijn verplicht')
      return
    }
    try {
      const res = await fetch('/api/monthly-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month: activeMonth, amount, description: newDesc.trim() }),
      })
      if (!res.ok) throw new Error()
      setNewAmount('')
      setNewDesc('')
      await fetchData()
    } catch {
      toast.error('Kon niet toevoegen')
    }
  }

  const saveEdit = async (id: string) => {
    const amount = parseFloat(editAmount.replace(',', '.'))
    if (!amount || !editDesc.trim()) {
      setEditingId(null)
      return
    }
    try {
      await fetch(`/api/monthly-costs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: editDesc.trim() }),
      })
      setEditingId(null)
      await fetchData()
    } catch {
      toast.error('Kon niet opslaan')
    }
  }

  const deleteCost = async (id: string) => {
    if (!confirm('Verwijder deze kostenpost?')) return
    try {
      await fetch(`/api/monthly-costs/${id}`, { method: 'DELETE' })
      await fetchData()
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const [normalizing, setNormalizing] = useState(false)
  const normalizeImported = async () => {
    if (!confirm('Alle geïmporteerde omschrijvingen herschrijven naar korte vendor-namen?')) return
    setNormalizing(true)
    try {
      const res = await fetch('/api/monthly-costs/normalize', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error()
      toast.success(`${data.updated} van ${data.scanned} omschrijvingen opgeschoond`)
      await fetchData()
    } catch {
      toast.error('Normaliseren mislukt')
    } finally {
      setNormalizing(false)
    }
  }

  const handleMT940File = async (file: File) => {
    setImporting(true)
    setImportError(null)
    setImportItems([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/monthly-costs/parse-mt940', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Kon bestand niet verwerken')
        return
      }
      if (data.transactions.length === 0) {
        setImportError('Geen kosten-transacties gevonden in dit bestand (alleen inkomsten?).')
        return
      }
      setImportItems(data.transactions.map((t: { date: string; year: number; month: number; amount: number; description: string; rawKey: string; externalRef: string; isDuplicate: boolean; isLearned: boolean }) => ({
        ...t,
        selected: !t.isDuplicate,
      })))
    } catch {
      setImportError('Kon bestand niet verwerken')
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    const selected = importItems.filter(i => i.selected && !i.isDuplicate)
    if (selected.length === 0) {
      toast.error('Geen regels geselecteerd')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/monthly-costs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(s => ({
            year: s.year,
            month: s.month,
            amount: s.amount,
            description: s.description,
            category: s.category || null,
            externalRef: s.externalRef,
            rawKey: s.rawKey,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      toast.success(`${data.added} toegevoegd${data.skipped > 0 ? `, ${data.skipped} overgeslagen` : ''}`)
      setShowImport(false)
      setImportItems([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchData()
    } catch {
      toast.error('Importeren mislukt')
    } finally {
      setImporting(false)
    }
  }

  const byMonth = useMemo(() => {
    const map: Record<number, Cost[]> = {}
    for (let m = 1; m <= 12; m++) map[m] = []
    for (const c of costs) map[c.month].push(c)
    return map
  }, [costs])

  const monthTotal = (m: number) => byMonth[m].reduce((s, c) => s + c.amount, 0)
  const monthTotalExBtw = (m: number) => byMonth[m].reduce((s, c) => s + amountExVat(c), 0)
  const monthMgmtTotal = (m: number) => byMonth[m].filter(c => c.category === 'MGMT').reduce((s, c) => s + amountExVat(c), 0)

  // Top vendors voor grafiek (op basis van groupKey, ex BTW)
  const vendorStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number }> = {}
    for (const c of costs) {
      const key = groupKey(c.description)
      if (!stats[key]) stats[key] = { total: 0, count: 0 }
      stats[key].total += amountExVat(c)
      stats[key].count++
    }
    return Object.entries(stats)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [costs])

  const recurringVendors = useMemo(
    () => vendorStats.filter(v => v.count >= 2).slice(0, 15),
    [vendorStats]
  )

  const totalYear = costs.reduce((s, c) => s + c.amount, 0)
  const totalYearExBtw = costs.reduce((s, c) => s + amountExVat(c), 0)
  const mgmtYearExBtw = costs.filter(c => c.category === 'MGMT').reduce((s, c) => s + amountExVat(c), 0)
  const maxMonthTotal = Math.max(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(monthTotalExBtw), 1)
  const maxVendor = recurringVendors[0]?.total || 1

  // Appels-appels vergelijking — tot de laatste maand waarvoor 2026 data heeft.
  const yearCompare = useMemo(() => {
    const cur2026 = year === 2026 ? costs : costsOther
    const cur2025 = year === 2025 ? costs : costsOther
    // Bepaal lastMonth in 2026
    const months2026 = new Set(cur2026.map(c => c.month))
    let lastMonth = 0
    for (let m = 1; m <= 12; m++) if (months2026.has(m)) lastMonth = m
    if (lastMonth === 0) return null

    const sumExBtw = (rows: Cost[], cat?: string | null) =>
      rows
        .filter(c => c.month <= lastMonth && (cat === undefined || (c.category ?? null) === cat))
        .reduce((s, c) => s + amountExVat(c), 0)

    const total2026 = sumExBtw(cur2026)
    const total2025 = sumExBtw(cur2025)
    const mgmt2026 = sumExBtw(cur2026, 'MGMT')
    const mgmt2025 = sumExBtw(cur2025, 'MGMT')

    // Per maand t/m lastMonth
    const monthly = (rows: Cost[]) => {
      const arr = Array(lastMonth).fill(0)
      for (const c of rows) {
        if (c.month >= 1 && c.month <= lastMonth) arr[c.month - 1] += amountExVat(c)
      }
      return arr
    }
    const mgmtMonthly = (rows: Cost[]) => {
      const arr = Array(lastMonth).fill(0)
      for (const c of rows) {
        if (c.category === 'MGMT' && c.month >= 1 && c.month <= lastMonth) arr[c.month - 1] += amountExVat(c)
      }
      return arr
    }
    const m2026 = monthly(cur2026)
    const m2025 = monthly(cur2025)
    const mgmtM2026 = mgmtMonthly(cur2026)
    const mgmtM2025 = mgmtMonthly(cur2025)

    return {
      lastMonth,
      periodLabel: lastMonth === 12 ? 'heel jaar' : `t/m ${MONTHS[lastMonth]}`,
      total2026, total2025,
      mgmt2026, mgmt2025,
      m2026, m2025,
      mgmtM2026, mgmtM2025,
    }
  }, [year, costs, costsOther])

  // Top terugkerende vendors — ontwikkeling 2025 → 2026 (ex BTW, tot lastMonth)
  const vendorTrend = useMemo(() => {
    if (!yearCompare) return null
    const cur2026 = year === 2026 ? costs : costsOther
    const cur2025 = year === 2025 ? costs : costsOther
    const lastMonth = yearCompare.lastMonth
    const accum = (rows: Cost[]) => {
      const map = new Map<string, number>()
      for (const c of rows) {
        if (c.month > lastMonth) continue
        if (c.category === 'MGMT') continue // mgmt apart benoemd, niet bij vendors
        const k = groupKey(c.description)
        map.set(k, (map.get(k) || 0) + amountExVat(c))
      }
      return map
    }
    const m2026 = accum(cur2026)
    const m2025 = accum(cur2025)
    const keys = new Set<string>([...Array.from(m2026.keys()), ...Array.from(m2025.keys())])
    const rows = Array.from(keys).map(k => ({
      key: k,
      v2025: m2025.get(k) || 0,
      v2026: m2026.get(k) || 0,
    }))
    rows.sort((a, b) => Math.max(b.v2025, b.v2026) - Math.max(a.v2025, a.v2026))
    return rows.slice(0, 15)
  }, [year, costs, costsOther, yearCompare])

  if (!session) return null
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Icons.lock size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400">Alleen toegankelijk voor partners, Hanna en Lotte</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Ambient glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-[5%] w-48 h-48 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-8 relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.euro size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kosten {year}</h1>
            <p className="text-sm text-white/40">Per maand bijhouden, onderaan inzicht in terugkerende kosten</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Jaar-switch */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {[2025, 2026].map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  year === y
                    ? 'bg-workx-lime text-workx-dark'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={normalizeImported}
            disabled={normalizing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-gray-300 text-sm font-medium border border-white/10 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
            title="Geïmporteerde bank-omschrijvingen omzetten naar korte vendor-namen"
          >
            <Icons.sparkles size={14} />
            {normalizing ? 'Bezig…' : 'Maak omschrijvingen netter'}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime text-sm font-medium border border-workx-lime/30 hover:bg-workx-lime/20 transition-colors"
            title="Bankafschrift in MT940-formaat uploaden (ABN AMRO → Mutaties → Downloaden)"
          >
            <Icons.upload size={14} />
            Importeer MT940
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Year-stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Totaal jaar (ex BTW)</p>
              <p className="text-2xl font-bold text-workx-lime">{formatEUR(totalYearExBtw)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">bruto {formatEUR(totalYear)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">waarvan Management fee</p>
              <p className="text-2xl font-bold text-cyan-400">{formatEUR(mgmtYearExBtw)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {totalYearExBtw > 0 ? `${((mgmtYearExBtw / totalYearExBtw) * 100).toFixed(0)}% van totaal` : '—'}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Maandgemiddelde (ex BTW)</p>
              <p className="text-2xl font-bold text-white">
                {(() => {
                  const monthsWithData = [1,2,3,4,5,6,7,8,9,10,11,12].filter(m => monthTotal(m) > 0)
                  if (monthsWithData.length === 0) return '—'
                  const avg = monthsWithData.reduce((s, m) => s + monthTotalExBtw(m), 0) / monthsWithData.length
                  return formatEUR(avg)
                })()}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Aantal posten</p>
              <p className="text-2xl font-bold text-white">{costs.length}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{vendorStats.length} vendors</p>
            </div>
          </div>

          {/* Month tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <button
                key={m}
                onClick={() => setActiveMonth(m)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeMonth === m
                    ? 'bg-workx-lime text-workx-dark'
                    : byMonth[m].length > 0
                      ? 'bg-white/5 text-white hover:bg-white/10'
                      : 'bg-white/[0.02] text-gray-600 hover:bg-white/5'
                }`}
              >
                {MONTHS[m]}
                {byMonth[m].length > 0 && (
                  <span className="ml-2 text-xs opacity-70">{byMonth[m].length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active month panel */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl mb-8">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between rounded-t-2xl bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-semibold text-white">{MONTHS[activeMonth]} {year}</h2>
                <p className="text-xs text-gray-500">{byMonth[activeMonth].length} posten</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Subtotaal ex BTW</p>
                <p className="text-xl font-bold text-workx-lime">{formatEUR(monthTotalExBtw(activeMonth))}</p>
                {monthMgmtTotal(activeMonth) > 0 && (
                  <p className="text-[10px] text-cyan-400/80 mt-0.5">
                    waarvan {formatEUR(monthMgmtTotal(activeMonth))} management fee
                  </p>
                )}
                <p className="text-[10px] text-gray-500">bruto {formatEUR(monthTotal(activeMonth))}</p>
              </div>
            </div>

            {/* Add row */}
            <div className="px-5 py-3 border-b border-white/5 flex flex-col sm:flex-row gap-2 bg-white/[0.01]">
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCost() }}
                placeholder="Omschrijving"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-workx-lime/50"
              />
              <input
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCost() }}
                placeholder="Bedrag €"
                inputMode="decimal"
                className="sm:w-40 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-workx-lime/50"
              />
              <button
                onClick={addCost}
                disabled={!newAmount || !newDesc.trim()}
                className="px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 disabled:opacity-40 transition-colors"
              >
                <Icons.plus size={14} className="inline mr-1" /> Toevoegen
              </button>
            </div>

            {/* Rows */}
            {byMonth[activeMonth].length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-500 text-sm">
                Nog geen kosten voor {MONTHS[activeMonth]}. Voeg de eerste post hierboven toe.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {byMonth[activeMonth].map(c => {
                  const startEdit = () => { setEditingId(c.id); setEditAmount(String(c.amount)); setEditDesc(c.description) }
                  return (
                    <div key={c.id} className="group px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02]">
                      {editingId === c.id ? (
                        <>
                          <input
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
                            autoFocus
                            className="flex-1 bg-white/5 border border-workx-lime/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                          />
                          <input
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
                            inputMode="decimal"
                            className="w-28 bg-white/5 border border-workx-lime/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none"
                          />
                          <button onClick={() => saveEdit(c.id)} className="p-1.5 rounded-lg text-workx-lime hover:bg-workx-lime/10" title="Opslaan (Enter)">
                            <Icons.check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white/5" title="Annuleer (Esc)">
                            <Icons.x size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={startEdit}
                            className="flex-1 text-left text-sm text-white hover:text-workx-lime transition-colors min-w-0 truncate"
                            title="Klik om te bewerken"
                          >
                            {c.description}
                          </button>
                          <span className="text-sm font-medium text-workx-lime/90 tabular-nums">{formatEUR(c.amount)}</span>
                          <button
                            onClick={startEdit}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-workx-lime/10 transition-colors"
                            title="Bewerk naam & bedrag"
                          >
                            <Icons.edit size={14} />
                          </button>
                          <button
                            onClick={() => deleteCost(c.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Verwijderen"
                          >
                            <Icons.trash size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Maand-bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-1">Totaal per maand (ex BTW)</h3>
              <p className="text-xs text-gray-500 mb-4">Cyaan = management fee, lime = overige kosten</p>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const total = monthTotalExBtw(m)
                  const mgmt = monthMgmtTotal(m)
                  const rest = Math.max(0, total - mgmt)
                  const mgmtPct = (mgmt / maxMonthTotal) * 100
                  const restPct = (rest / maxMonthTotal) * 100
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{MONTHS[m]}</span>
                      <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400"
                          style={{ width: `${mgmtPct}%` }}
                          title={mgmt > 0 ? `Management fee: ${formatEUR(mgmt)}` : undefined}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-workx-lime/60 to-workx-lime"
                          style={{ width: `${restPct}%` }}
                          title={rest > 0 ? `Overige kosten: ${formatEUR(rest)}` : undefined}
                        />
                      </div>
                      <span className="text-xs font-medium text-white tabular-nums w-24 text-right">
                        {total > 0 ? formatEUR(total) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top vendors */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-1">Top terugkerende kosten</h3>
              <p className="text-xs text-gray-500 mb-4">Vendors die in meerdere maanden voorkomen, op totaalbedrag</p>
              {recurringVendors.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Nog geen terugkerend patroon — meer maanden invullen.</p>
              ) : (
                <div className="space-y-2">
                  {recurringVendors.map(v => {
                    const pct = (v.total / maxVendor) * 100
                    return (
                      <div key={v.key} className="flex items-center gap-3">
                        <span className="text-xs text-white w-40 shrink-0 truncate" title={v.key}>{v.key}</span>
                        <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500/40 to-cyan-400/80 rounded-md"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-8 text-right">×{v.count}</span>
                        <span className="text-xs font-medium text-white tabular-nums w-24 text-right">{formatEUR(v.total)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Appels-appels vergelijking 2025 vs 2026 */}
          {yearCompare && (yearCompare.total2025 > 0 || yearCompare.total2026 > 0) && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
              <h3 className="text-white font-semibold mb-1">Vergelijking 2025 vs 2026 ({yearCompare.periodLabel})</h3>
              <p className="text-xs text-gray-500 mb-4">
                Bedragen ex BTW. Tot de laatste maand met data in 2026 — appels-appels.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {(() => {
                  const diffTotal = yearCompare.total2026 - yearCompare.total2025
                  const diffMgmt = yearCompare.mgmt2026 - yearCompare.mgmt2025
                  const overig2026 = yearCompare.total2026 - yearCompare.mgmt2026
                  const overig2025 = yearCompare.total2025 - yearCompare.mgmt2025
                  const diffOverig = overig2026 - overig2025
                  return (
                    <>
                      <div className="bg-workx-dark/40 rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Totaal kosten</p>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-400">2025</span>
                          <span className="text-sm text-gray-200 tabular-nums">{formatEUR(yearCompare.total2025)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-workx-lime">2026</span>
                          <span className="text-base font-bold text-workx-lime tabular-nums">{formatEUR(yearCompare.total2026)}</span>
                        </div>
                        <p className={`text-xs font-medium tabular-nums mt-1 ${diffTotal > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diffTotal > 0 ? '+' : ''}{formatEUR(diffTotal)} ({yearCompare.total2025 > 0 ? `${((diffTotal / yearCompare.total2025) * 100).toFixed(1)}%` : '—'})
                        </p>
                      </div>
                      <div className="bg-workx-dark/40 rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Management fee</p>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-400">2025</span>
                          <span className="text-sm text-gray-200 tabular-nums">{formatEUR(yearCompare.mgmt2025)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-cyan-400">2026</span>
                          <span className="text-base font-bold text-cyan-400 tabular-nums">{formatEUR(yearCompare.mgmt2026)}</span>
                        </div>
                        <p className={`text-xs font-medium tabular-nums mt-1 ${diffMgmt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diffMgmt > 0 ? '+' : ''}{formatEUR(diffMgmt)}
                        </p>
                      </div>
                      <div className="bg-workx-dark/40 rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Overige kosten</p>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-400">2025</span>
                          <span className="text-sm text-gray-200 tabular-nums">{formatEUR(overig2025)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-workx-lime">2026</span>
                          <span className="text-base font-bold text-workx-lime tabular-nums">{formatEUR(overig2026)}</span>
                        </div>
                        <p className={`text-xs font-medium tabular-nums mt-1 ${diffOverig > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diffOverig > 0 ? '+' : ''}{formatEUR(diffOverig)} ({overig2025 > 0 ? `${((diffOverig / overig2025) * 100).toFixed(1)}%` : '—'})
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Maand-grafiek 2025 vs 2026 */}
              <h4 className="text-sm text-white/80 font-medium mb-2">Per maand</h4>
              <div className="space-y-1.5">
                {(() => {
                  const maxV = Math.max(...yearCompare.m2025, ...yearCompare.m2026, 1)
                  return Array.from({ length: yearCompare.lastMonth }, (_, i) => {
                    const v25 = yearCompare.m2025[i] || 0
                    const v26 = yearCompare.m2026[i] || 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 w-16 shrink-0">{MONTHS[i + 1]}</span>
                        <div className="flex-1 grid grid-rows-2 gap-0.5">
                          <div className="h-3 bg-white/5 rounded overflow-hidden flex items-center" title={`2025: ${formatEUR(v25)}`}>
                            <div className="h-full bg-gray-500/60" style={{ width: `${(v25 / maxV) * 100}%` }} />
                          </div>
                          <div className="h-3 bg-white/5 rounded overflow-hidden flex items-center" title={`2026: ${formatEUR(v26)}`}>
                            <div className="h-full bg-workx-lime" style={{ width: `${(v26 / maxV) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500 tabular-nums w-20 text-right">{formatEUR(v25)}</span>
                        <span className="text-[10px] text-workx-lime tabular-nums w-20 text-right">{formatEUR(v26)}</span>
                      </div>
                    )
                  })
                })()}
                <div className="flex items-center gap-3 pt-2 mt-1 border-t border-white/5 text-[10px]">
                  <span className="w-16 shrink-0" />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-gray-500/60" /> 2025</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-workx-lime" /> 2026</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top terugkerende kosten — ontwikkeling */}
          {vendorTrend && vendorTrend.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
              <h3 className="text-white font-semibold mb-1">Ontwikkeling top terugkerende kosten</h3>
              <p className="text-xs text-gray-500 mb-4">
                Top 15 vendors (excl. management fee), ex BTW, {yearCompare ? yearCompare.periodLabel : 'jaar'}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                      <th className="py-2 px-2 font-medium">Vendor</th>
                      <th className="py-2 px-2 font-medium text-right">2025</th>
                      <th className="py-2 px-2 font-medium text-right">2026</th>
                      <th className="py-2 px-2 font-medium text-right">Δ</th>
                      <th className="py-2 px-2 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorTrend.map(v => {
                      const diff = v.v2026 - v.v2025
                      const pct = v.v2025 > 0 ? (diff / v.v2025) * 100 : null
                      return (
                        <tr key={v.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 px-2 text-white truncate max-w-xs" title={v.key}>{v.key}</td>
                          <td className="py-2 px-2 text-right text-gray-300 tabular-nums">{v.v2025 > 0 ? formatEUR(v.v2025) : '—'}</td>
                          <td className="py-2 px-2 text-right text-workx-lime tabular-nums font-medium">{v.v2026 > 0 ? formatEUR(v.v2026) : '—'}</td>
                          <td className={`py-2 px-2 text-right tabular-nums ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                            {diff !== 0 ? (diff > 0 ? '+' : '') + formatEUR(diff) : '—'}
                          </td>
                          <td className={`py-2 px-2 text-right tabular-nums text-xs ${pct === null ? 'text-gray-500' : pct > 0 ? 'text-red-400' : pct < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                            {pct === null ? 'nieuw' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full vendor table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-8">
            <h3 className="text-white font-semibold mb-1">Alle kosten samengevat</h3>
            <p className="text-xs text-gray-500 mb-4">Gegroepeerd op vendor, gesorteerd op totaalbedrag</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                    <th className="py-2 px-2 font-medium">Vendor / categorie</th>
                    <th className="py-2 px-2 font-medium text-right">Aantal</th>
                    <th className="py-2 px-2 font-medium text-right">Totaal</th>
                    <th className="py-2 px-2 font-medium text-right">Gemiddeld</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorStats.map(v => (
                    <tr key={v.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-white">{v.key}</td>
                      <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{v.count}</td>
                      <td className="py-2 px-2 text-right text-workx-lime tabular-nums font-medium">{formatEUR(v.total)}</td>
                      <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{formatEUR(v.total / v.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MT940 Import Modal — portal naar document.body zodat geen parent
          (relative / backdrop-filter / overflow) de fixed-positionering breekt */}
      {typeof document !== 'undefined' && showImport && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}>
          <div
            className="w-full max-w-4xl bg-workx-gray border border-white/10 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: 'min(700px, calc(100vh - 2rem))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header — vast */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">MT940 importeren</h2>
                <p className="text-xs text-gray-400 mt-0.5">ABN AMRO → Mutaties → Downloaden in MT940-formaat</p>
              </div>
              <button
                onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icons.x size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto p-6 flex-1">
              {importItems.length === 0 ? (
                <div className="space-y-4">
                  {importError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                      {importError}
                    </div>
                  )}
                  <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-2xl p-10 text-center">
                    <Icons.upload size={32} className="mx-auto text-gray-500 mb-3" />
                    <p className="text-sm text-white mb-1">Kies een MT940-bestand (.940 of .txt)</p>
                    <p className="text-xs text-gray-500 mb-4">Alleen kosten (debet) worden geïmporteerd. Inkomsten worden overgeslagen.</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".940,.txt,.sta"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleMT940File(f)
                      }}
                      disabled={importing}
                      className="block mx-auto text-xs text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-workx-lime file:text-workx-dark file:text-xs file:font-medium hover:file:bg-workx-lime/90 file:cursor-pointer"
                    />
                    {importing && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                        Bezig met inlezen…
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm text-white">
                      {importItems.length} transacties gevonden
                      {importItems.filter(i => i.isDuplicate).length > 0 && (
                        <span className="text-orange-400 ml-2">
                          ({importItems.filter(i => i.isDuplicate).length} al bekend)
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: !i.isDuplicate })))}
                        className="text-xs text-gray-400 hover:text-workx-lime transition-colors"
                      >
                        Alleen nieuwe
                      </button>
                      <span className="text-xs text-gray-700">·</span>
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: true })))}
                        className="text-xs text-gray-400 hover:text-workx-lime transition-colors"
                      >
                        Alles aan
                      </button>
                      <span className="text-xs text-gray-700">·</span>
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: false })))}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                      >
                        Alles uit
                      </button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03]">
                        <tr className="text-left text-xs text-gray-400">
                          <th className="px-2 py-2 w-8"></th>
                          <th className="px-2 py-2 font-medium w-24">Datum</th>
                          <th className="px-2 py-2 font-medium">Omschrijving</th>
                          <th className="px-2 py-2 font-medium text-right w-28">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importItems.map((it, idx) => (
                          <tr key={idx} className={`border-t border-white/5 ${it.isDuplicate ? 'opacity-40' : ''}`}>
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={it.selected}
                                disabled={it.isDuplicate}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setImportItems(items => items.map((i, j) => j === idx ? { ...i, selected: checked } : i))
                                }}
                                className="accent-workx-lime"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-gray-400 tabular-nums whitespace-nowrap">
                              {new Date(it.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
                              {it.isDuplicate && (
                                <span className="ml-1 text-[9px] text-orange-400">DUP</span>
                              )}
                              {it.isLearned && !it.isDuplicate && (
                                <span className="ml-1 text-[9px] text-workx-lime" title="Naam onthouden van eerdere correctie">★</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={it.description}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setImportItems(items => items.map((i, j) => j === idx ? { ...i, description: v } : i))
                                }}
                                disabled={it.isDuplicate}
                                className="w-full bg-transparent text-xs text-white focus:outline-none focus:bg-white/5 rounded px-1"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right text-workx-lime/90 tabular-nums">{formatEUR(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer — vast */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-500">
                {importItems.length > 0 && (
                  <>
                    <span className="text-workx-lime font-medium">{importItems.filter(i => i.selected && !i.isDuplicate).length}</span> regels worden geïmporteerd
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}
                  disabled={importing}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  Annuleren
                </button>
                {importItems.length > 0 && (
                  <button
                    onClick={confirmImport}
                    disabled={importing || importItems.filter(i => i.selected && !i.isDuplicate).length === 0}
                    className="px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-40"
                  >
                    {importing ? 'Importeren…' : 'Importeren'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
