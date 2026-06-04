'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import { OLD_CANDIDATES, CATEGORY_META, type OldCandidateCategory } from '@/lib/old-candidates-data'

const linkedInSearchUrl = (name: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + ' advocaat')}`

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  gray:   { bg: 'bg-white/5',           text: 'text-white/60',    ring: 'ring-white/10' },
  blue:   { bg: 'bg-blue-500/10',        text: 'text-blue-300',    ring: 'ring-blue-500/30' },
  green:  { bg: 'bg-green-500/10',       text: 'text-green-300',   ring: 'ring-green-500/30' },
  lime:   { bg: 'bg-workx-lime/10',      text: 'text-workx-lime',  ring: 'ring-workx-lime/30' },
  red:    { bg: 'bg-red-500/10',         text: 'text-red-300',     ring: 'ring-red-500/30' },
}

export default function OudeLijstPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const checkRole = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setRole(data.role)
        }
      } catch { /* ignore */ }
    }
    checkRole()
  }, [])

  const isManager = role === 'PARTNER' || role === 'ADMIN'

  // Sorteer per categorie volgens een logische volgorde
  const grouped = useMemo(() => {
    const order: OldCandidateCategory[] = ['aangenomen', 'komt-langs', 'eerder-gesproken', 'onbekend', 'staat-niet-open']
    const m = new Map<OldCandidateCategory, typeof OLD_CANDIDATES>()
    for (const cat of order) m.set(cat, [])
    for (const c of OLD_CANDIDATES) {
      const arr = m.get(c.category) || []
      arr.push(c)
      m.set(c.category, arr)
    }
    return order.map(cat => ({ cat, items: m.get(cat) || [] })).filter(g => g.items.length > 0)
  }, [])

  if (status === 'loading' || role === null) {
    return <div className="py-12 text-center text-gray-400">Laden...</div>
  }

  if (!isManager) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 max-w-md mx-auto mt-12 text-center">
        <Icons.shield className="text-red-400 mx-auto mb-3" size={32} />
        <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
        <p className="text-sm text-white/60">Deze lijst is alleen voor partners en Hanna.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 fade-in">
      {/* Header — zelfde tab-bar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎯</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Recruitment</h1>
          </div>
          <p className="text-sm text-gray-400">Archief van de eerder besproken kandidaten — referentie, niet bewerkbaar.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-end p-1 rounded-xl bg-white/5 border border-white/10 flex-wrap">
          <button
            onClick={() => router.push('/dashboard/recruitment')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Recruitment
          </button>
          <button
            onClick={() => router.push('/dashboard/partners/sollicitaties')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Sollicitaties
          </button>
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium bg-workx-lime/20 text-workx-lime">
            (oude) lijst kandidaten
          </button>
        </div>
      </div>

      {/* Intro card */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h2 className="text-white font-semibold mb-1">Eerder samengestelde lijst</h2>
            <p className="text-sm text-white/70 max-w-2xl leading-relaxed">
              Lijst kandidaten zoals besproken in onze vorige recruitment-ronde. Geen plek meer voor opvolging hier — als je iemand actief wil benaderen, voeg 'm toe op het hoofd-tabblad. Deze lijst dient als referentie zodat we niet opnieuw beginnen met dezelfde namen.
            </p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {grouped.map(({ cat, items }) => {
          const meta = CATEGORY_META[cat]
          const c = COLOR_MAP[meta.color] || COLOR_MAP.gray
          return (
            <div key={cat} className={`rounded-xl p-3 border border-white/5 ${c.bg}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-base">{meta.emoji}</span>
                <span className={`text-xs ${c.text} font-medium`}>{meta.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{items.length}</div>
            </div>
          )
        })}
      </div>

      {/* Groepen met kandidaten */}
      {grouped.map(({ cat, items }) => {
        const meta = CATEGORY_META[cat]
        const c = COLOR_MAP[meta.color] || COLOR_MAP.gray
        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                <span className="text-sm font-normal text-white/40">({items.length})</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(person => (
                <div
                  key={person.name}
                  className={`rounded-xl border border-white/10 ${c.bg} p-4 hover:border-white/20 transition-colors group`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-white leading-tight">{person.name}</h4>
                      <p className="text-sm text-white/60 mt-0.5">{person.office}</p>
                    </div>
                    <a
                      href={linkedInSearchUrl(person.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-medium hover:bg-blue-500/30 flex-shrink-0"
                      title="Zoek op LinkedIn"
                    >
                      🔍 LinkedIn
                    </a>
                  </div>
                  <div className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text} ${c.ring} ring-1 mb-2`}>
                    {person.years}
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{person.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
