'use client'

// Gepinde office-kernvakjes bovenaan het dashboard voor het office-team
// (Hanna/Lotte/Bente = ADMIN): snelle herinnering + toegang tot de dingen die
// verspreid staan (aanwezigheid, open declaraties, debiteuren, mailchimp).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

export default function OfficePinnedWidgets() {
  const [openDecl, setOpenDecl] = useState<number | null>(null)
  const [newMc, setNewMc] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/expenses?status=SUBMITTED')
      .then(r => (r.ok ? r.json() : []))
      .then((d: unknown) => setOpenDecl(Array.isArray(d) ? d.length : 0))
      .catch(() => setOpenDecl(0))
    fetch('/api/mailchimp-contacts')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { contacts?: { addedToMailchimp: boolean; unsubscribed: boolean }[] } | null) => {
        const list = d?.contacts || []
        setNewMc(list.filter(c => !c.addedToMailchimp && !c.unsubscribed).length)
      })
      .catch(() => setNewMc(0))
  }, [])

  const tiles = [
    { href: '/dashboard/office', icon: Icons.building, label: 'Office', sub: 'Aanwezigheid', badge: null as number | null, color: 'text-blue-400 bg-blue-500/10' },
    { href: '/dashboard/declaraties', icon: Icons.euro, label: 'Declaraties', sub: openDecl === null ? 'laden…' : openDecl > 0 ? `${openDecl} open` : 'niets open', badge: openDecl || null, color: 'text-workx-lime bg-workx-lime/10' },
    { href: '/dashboard/debiteuren', icon: Icons.fileText, label: 'Debiteuren', sub: 'bijwerken', badge: null as number | null, color: 'text-orange-400 bg-orange-500/10' },
    { href: '/dashboard/mailchimp', icon: Icons.mail, label: 'Mailchimp', sub: newMc === null ? 'laden…' : newMc > 0 ? `${newMc} nieuw` : 'niets nieuw', badge: newMc || null, color: 'text-purple-400 bg-purple-500/10' },
  ]

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">Office — snel overzicht</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => {
          const Icon = t.icon
          return (
            <Link key={t.href} href={t.href} className="card p-4 flex items-center gap-3 hover:border-white/20 transition-colors group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-workx-lime transition-colors truncate">{t.label}</p>
                <p className="text-xs text-white/50 truncate">{t.sub}</p>
              </div>
              {t.badge ? <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white flex-shrink-0">{t.badge}</span> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
