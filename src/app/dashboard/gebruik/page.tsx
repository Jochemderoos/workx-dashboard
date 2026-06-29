'use client'

// Gebruik-pagina — alleen zichtbaar voor de eigenaar (Jochem). Toont
// login-statistieken: actieve gebruikers, logins per dag, en per persoon.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'

interface UsageUser {
  id: string
  name: string
  role: string
  lastLoginAt: string | null
  loginCount: number
}
interface UsageData {
  users: UsageUser[]
  activeLast7: number
  neverLoggedIn: number
  totalLogins: number
  perDay: { date: string; count: number; users: number }[]
}

function relTime(iso: string | null): string {
  if (!iso) return 'Nooit'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Gisteren'
  if (days < 7) return `${days} dagen geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
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

  if (status === 'loading' || loading) {
    return <div className="p-8 text-gray-400">Laden…</div>
  }
  if (!isOwner) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-semibold text-white">Geen toegang</h1>
        <p className="text-gray-400 mt-1">Deze pagina is alleen voor de beheerder.</p>
      </div>
    )
  }
  if (!data) {
    return <div className="p-8 text-gray-400">Kon gebruiksdata niet laden.</div>
  }

  const maxDay = Math.max(1, ...data.perDay.map(d => d.count))

  return (
    <div className="space-y-6 fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Icons.chart className="text-workx-lime" size={22} /> Gebruik
        </h1>
        <p className="text-sm text-gray-400 mt-1">Login-statistieken van het dashboard — alleen voor jou zichtbaar.</p>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Actief (7 dagen)', value: data.activeLast7, sub: `van ${data.users.length}`, color: 'text-emerald-400' },
          { label: 'Totaal logins', value: data.totalLogins, sub: 'sinds start tracking', color: 'text-workx-lime' },
          { label: 'Nooit ingelogd', value: data.neverLoggedIn, sub: 'gebruikers', color: data.neverLoggedIn > 0 ? 'text-amber-400' : 'text-gray-400' },
          { label: 'Teamleden', value: data.users.length, sub: 'actief', color: 'text-white' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-gray-400">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-gray-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Logins per dag */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-white mb-3">Logins per dag (laatste 30 dagen)</h2>
        {data.perDay.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen logins geregistreerd.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.perDay.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-workx-lime/60 hover:bg-workx-lime rounded-t transition-colors"
                  style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-workx-dark border border-white/10 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                  {new Date(d.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}: {d.count} logins · {d.users} pers.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per gebruiker */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium text-white">Per gebruiker</h2>
        </div>
        <div className="divide-y divide-white/5">
          {data.users.map(u => {
            const photo = getPhotoUrl(u.name)
            const never = !u.lastLoginAt
            return (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                  {photo ? <img loading="lazy" src={photo} alt={u.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-workx-lime/20 flex items-center justify-center text-workx-lime text-sm font-bold">{u.name.charAt(0)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{u.name}</p>
                  <p className="text-[11px] text-gray-500">{u.role}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${never ? 'text-amber-400' : 'text-gray-300'}`}>{relTime(u.lastLoginAt)}</p>
                  <p className="text-[11px] text-gray-500 tabular-nums">{u.loginCount} {u.loginCount === 1 ? 'login' : 'logins'}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
