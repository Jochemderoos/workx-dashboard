'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'

interface Item {
  id: string
  amount: number
  description: string
  category: string | null
  externalRef: string | null
  createdAt: string
}

interface DuplicateGroup {
  key: string
  year: number
  month: number
  amount: number
  description: string
  count: number
  items: Item[]
}

const MONTHS_NL = ['', 'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

const fmtEur = (n: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}).format(n)

export default function KostenDuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  // ids van rijen die de user wil VERWIJDEREN (default: alles behalve oudste per groep)
  const [toDelete, setToDelete] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

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
      const res = await fetch('/api/monthly-costs/duplicates')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGroups(data.groups)
      setTotal(data.totalDuplicateRows)
      // Default: per groep behoud de OUDSTE (= eerste, want sortOrder asc), verwijder de rest
      const initialDeletes = new Set<string>()
      for (const g of data.groups as DuplicateGroup[]) {
        const sorted = [...g.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        sorted.slice(1).forEach(i => initialDeletes.add(i.id))
      }
      setToDelete(initialDeletes)
    } catch {
      toast.error('Kon duplicaten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  const toggleId = (id: string) => {
    setToDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async () => {
    if (toDelete.size === 0) {
      toast.error('Geen rijen geselecteerd')
      return
    }
    if (!confirm(`${toDelete.size} kostenpost${toDelete.size === 1 ? '' : 'en'} verwijderen?`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/monthly-costs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(toDelete) }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`${data.deleted} verwijderd`)
      await load()
    } catch {
      toast.error('Verwijderen mislukt')
    } finally {
      setBusy(false)
    }
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <Icons.lock className="text-red-400 mx-auto mb-3" size={28} />
          <h2 className="text-xl font-semibold text-white">Geen toegang</h2>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <Link href="/dashboard/kosten" className="text-xs text-gray-500 hover:text-workx-lime inline-flex items-center gap-1 mb-2">
            <Icons.chevronLeft size={12} /> Terug naar Kosten
          </Link>
          <h1 className="text-2xl font-semibold text-white"><TextReveal>Dubbele kostenposten</TextReveal></h1>
          <p className="text-sm text-gray-400 mt-1">
            {groups.length === 0
              ? 'Geen duplicaten gevonden. Alles ziet er schoon uit.'
              : `${groups.length} groep${groups.length === 1 ? '' : 'en'} met identieke posten — ${total} rij${total === 1 ? '' : 'en'} kunnen weg.`}
          </p>
        </div>
        {groups.length > 0 && (
          <button
            onClick={handleDelete}
            disabled={busy || toDelete.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'rgb(249, 100, 100)', color: 'white' }}
          >
            {busy ? 'Bezig…' : `Verwijder ${toDelete.size} rij${toDelete.size === 1 ? '' : 'en'}`}
          </button>
        )}
      </div>

      {/* Groepen */}
      <div className="space-y-4">
        {groups.map(g => (
          <div key={g.key} className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-500/15 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {g.description}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {MONTHS_NL[g.month]} {g.year} · {fmtEur(g.amount)} · <strong className="text-amber-300">{g.count} rijen</strong>
                </p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                  <th className="text-left py-2 px-5 font-semibold w-16">Verwijder</th>
                  <th className="text-left py-2 px-3 font-semibold">Omschrijving</th>
                  <th className="text-right py-2 px-3 font-semibold">Bedrag</th>
                  <th className="text-left py-2 px-3 font-semibold">Categorie</th>
                  <th className="text-left py-2 px-3 font-semibold">Aangemaakt</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(item => {
                  const checked = toDelete.has(item.id)
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-white/5 last:border-b-0 transition-colors ${
                        checked ? 'bg-red-500/[0.06]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2 px-5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(item.id)}
                          className="w-4 h-4 accent-red-400 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 text-white">{item.description}</td>
                      <td className="py-2 px-3 text-right text-white tabular-nums">{fmtEur(item.amount)}</td>
                      <td className="py-2 px-3 text-gray-400 text-xs">{item.category || '—'}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.check className="text-emerald-400" size={28} />
          </div>
          <p className="text-gray-400">Geen dubbele kostenposten gevonden.</p>
        </div>
      )}

      <div className="card p-4 text-xs text-gray-400 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
        <p className="text-white font-medium mb-1">Hoe werkt het?</p>
        <p>
          Een dubbele post = dezelfde maand, hetzelfde bedrag en dezelfde omschrijving (genormaliseerd).
          Standaard worden alle dubbele rijen behalve de oudste aangevinkt om te verwijderen. Je kunt per
          groep zelf bepalen welke je behoudt door de vinkjes aan/uit te zetten.
        </p>
      </div>
    </div>
  )
}
