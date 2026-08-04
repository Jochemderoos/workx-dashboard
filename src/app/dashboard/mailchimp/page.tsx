'use client'

// Mailchimp-contactlijst: de huidige Mailchimp-audience staat als baseline in
// het dashboard (geïmporteerd). Iedereen kan zoeken ("staat X er al in?") en
// nieuwe contacten aandragen (status NIEUW). Office (Hanna/Lotte/Bente) zet ze
// in Mailchimp en vinkt ze dan af → status "in Mailchimp".

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import LabelDropdown from '@/components/ui/LabelDropdown'
import toast from 'react-hot-toast'

interface Contact {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  taal: string | null
  seminar: boolean
  unsubscribed: boolean
  source: string
  addedById: string
  addedByName: string
  addedToMailchimp: boolean
  processedByName: string | null
  processedAt: string | null
  createdAt: string
}

const empty = { name: '', email: '', phone: '', company: '', taal: '', seminar: false }
const TAAL_OPTIONS = [{ key: '', label: 'Taal onbekend' }, { key: 'NL', label: 'Nederlands' }, { key: 'EN', label: 'Engels' }]

function StatusBadge({ c }: { c: Contact }) {
  if (c.unsubscribed) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300">Uitgeschreven</span>
  if (c.addedToMailchimp) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-workx-lime/15 text-workx-lime">In Mailchimp</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Nieuw</span>
}

function Tags({ c }: { c: Contact }) {
  return (
    <>
      {c.taal === 'NL' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300">NL</span>}
      {c.taal === 'EN' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">EN</span>}
      {c.seminar && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300">Seminar</span>}
    </>
  )
}

export default function MailchimpPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role || ''
  const uid = (session?.user as { id?: string })?.id
  const canManage = role === 'ADMIN' || role === 'PARTNER'

  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    fetch('/api/mailchimp-contacts')
      .then(r => r.ok ? r.json() : null)
      .then(d => setItems(d?.contacts || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { toast.error('Naam en e-mail zijn verplicht'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/mailchimp-contacts', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || 'Kon niet toevoegen'); return }
      setForm(empty)
      toast.success('Contactpersoon aangedragen — office zet hem in Mailchimp')
      load()
    } finally { setSaving(false) }
  }

  const toggleDone = async (c: Contact, done: boolean) => {
    const res = await fetch(`/api/mailchimp-contacts?id=${c.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ addedToMailchimp: done }),
    })
    if (res.ok) load(); else toast.error('Kon niet bijwerken')
  }

  const remove = async (c: Contact) => {
    if (!confirm(`"${c.name}" definitief verwijderen uit de lijst?`)) return
    const res = await fetch(`/api/mailchimp-contacts?id=${c.id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== c.id)); else toast.error('Kon niet verwijderen')
  }

  const open = useMemo(() => items.filter(c => !c.addedToMailchimp && !c.unsubscribed), [items])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
    ).sort((a, b) => Number(b.unsubscribed) - Number(a.unsubscribed)).slice(0, 80)
  }, [items, query])

  const stats = useMemo(() => ({
    total: items.length,
    inMc: items.filter(c => c.addedToMailchimp && !c.unsubscribed).length,
    nieuw: open.length,
    uit: items.filter(c => c.unsubscribed).length,
  }), [items, open])

  const fmt = (d: string) => new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

  const Row = ({ c, compact }: { c: Contact; compact?: boolean }) => {
    const photo = c.source !== 'mailchimp' ? getPhotoUrl(c.addedByName) : null
    const canDelete = c.addedById === uid || canManage
    return (
      <div className="px-4 py-2.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{c.name}</span>
            <StatusBadge c={c} />
            <Tags c={c} />
            {c.company && <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300">{c.company}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <a href={`mailto:${c.email}`} className="hover:text-workx-lime">{c.email}</a>
            {c.phone && <span>{c.phone}</span>}
          </div>
          {!compact && c.source !== 'mailchimp' && (
            <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
              {photo && <img src={photo} alt={c.addedByName} className="w-4 h-4 rounded-full object-cover" />}
              Aangedragen door {c.addedByName.split(' ')[0]} · {fmt(c.createdAt)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && !c.unsubscribed && (
            c.addedToMailchimp ? (
              <button onClick={() => toggleDone(c, false)} className="text-[11px] text-gray-400 hover:text-amber-300 px-2 py-1 rounded-lg hover:bg-white/5" title="Terugzetten naar Nieuw">Terugzetten</button>
            ) : (
              <button onClick={() => toggleDone(c, true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-workx-lime/15 text-workx-lime hover:bg-workx-lime/25 transition-colors text-xs font-medium" title="Markeer als toegevoegd aan Mailchimp">
                <Icons.check size={13} /> In Mailchimp
              </button>
            )
          )}
          {canDelete && (
            <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Verwijderen">
              <Icons.trash size={14} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Icons.mail className="text-workx-lime" size={22} /> Mailchimp-lijst
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Onze volledige Mailchimp-contactlijst. Zoek of iemand er al in staat, of draag een nieuwe contactpersoon aan (met taal + seminar). Office (Hanna, Lotte, Bente) zet nieuwe contacten in Mailchimp en vinkt ze dan af.
        </p>
      </div>

      {/* Zoeken */}
      <div className="card p-3 flex items-center gap-2">
        <Icons.search size={16} className="text-gray-500 ml-1" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Zoek op naam, e-mail of bedrijf — staat iemand er al in?"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        {query && <button onClick={() => setQuery('')} className="text-gray-500 hover:text-white p-1"><Icons.x size={15} /></button>}
      </div>

      {query.trim() ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium text-white">Zoekresultaten <span className="text-gray-500 font-normal">({results.length}{results.length === 80 ? '+' : ''})</span></h2>
          </div>
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">Niemand gevonden — dan staat deze persoon er nog niet in. Draag 'm hieronder aan.</p>
          ) : (
            <div className="divide-y divide-white/5">{results.map(c => <Row key={c.id} c={c} compact />)}</div>
          )}
        </div>
      ) : null}

      {/* Aandragen */}
      <form onSubmit={submit} className="card p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">Nieuwe contactpersoon aandragen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Naam *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field w-full text-sm" placeholder="Voor- en achternaam" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">E-mail *</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" className="input-field w-full text-sm" placeholder="naam@bedrijf.nl" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bedrijf</label>
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="input-field w-full text-sm" placeholder="Bedrijfsnaam" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Telefoonnummer</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field w-full text-sm" placeholder="06 …" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Taal (voor de tag)</label>
            <LabelDropdown value={form.taal} options={TAAL_OPTIONS} onChange={k => setForm({ ...form, taal: k })} size="md" />
          </div>
          <label className="flex items-center gap-2.5 mt-5 cursor-pointer select-none">
            <input type="checkbox" checked={form.seminar} onChange={e => setForm({ ...form, seminar: e.target.checked })} className="w-4 h-4 rounded accent-purple-400" />
            <span className="text-sm text-gray-300">Seminar-uitnodiging</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !form.name.trim() || !form.email.trim()} className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
            <Icons.plus size={15} /> {saving ? 'Aandragen…' : 'Contactpersoon aandragen'}
          </button>
        </div>
      </form>

      {/* NIEUW — nog in Mailchimp te zetten */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Nieuw — nog in Mailchimp te zetten <span className="text-gray-500 font-normal">({open.length})</span></h2>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Laden…</p>
        ) : open.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Geen nieuwe contactpersonen. Draag er hierboven een aan!</p>
        ) : (
          <div className="divide-y divide-white/5">{open.map(c => <Row key={c.id} c={c} />)}</div>
        )}
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-500 text-center">
        {stats.total} contacten · {stats.inMc} in Mailchimp · {stats.nieuw} nieuw · {stats.uit} uitgeschreven
      </p>
    </div>
  )
}
