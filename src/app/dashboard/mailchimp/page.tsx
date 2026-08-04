'use client'

// Mailchimp-contactlijst: iedereen draagt contactpersonen aan; office
// (Hanna/Lotte/Bente) vinkt af zodra iemand echt in Mailchimp staat.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'

interface Contact {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  addedById: string
  addedByName: string
  addedToMailchimp: boolean
  processedByName: string | null
  processedAt: string | null
  createdAt: string
}

const empty = { name: '', email: '', phone: '', company: '' }

export default function MailchimpPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role || ''
  const canManage = role === 'ADMIN' || role === 'PARTNER'

  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showDone, setShowDone] = useState(false)

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
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Kon niet toevoegen'); return }
      setForm(empty)
      toast.success('Contactpersoon toegevoegd')
      load()
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (c: Contact, done: boolean) => {
    const res = await fetch(`/api/mailchimp-contacts?id=${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ addedToMailchimp: done }),
    })
    if (res.ok) load()
    else toast.error('Kon niet bijwerken')
  }

  const remove = async (c: Contact) => {
    if (!confirm(`"${c.name}" definitief verwijderen uit de lijst?`)) return
    const res = await fetch(`/api/mailchimp-contacts?id=${c.id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== c.id))
    else toast.error('Kon niet verwijderen')
  }

  const open = items.filter(c => !c.addedToMailchimp)
  const done = items.filter(c => c.addedToMailchimp)
  const uid = (session?.user as { id?: string })?.id

  const fmt = (d: string) => new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Icons.mail className="text-workx-lime" size={22} /> Mailchimp-lijst
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Draag contactpersonen aan die aan onze Mailchimp-lijst moeten worden toegevoegd. Office (Hanna, Lotte, Bente) vinkt ze af zodra ze in Mailchimp staan — daarna verdwijnen ze hier uit de lijst.
        </p>
      </div>

      {/* Toevoegen */}
      <form onSubmit={submit} className="card p-4 space-y-3">
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
            <label className="block text-xs text-gray-400 mb-1">Telefoonnummer</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field w-full text-sm" placeholder="06 …" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bedrijf</label>
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="input-field w-full text-sm" placeholder="Bedrijfsnaam" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !form.name.trim() || !form.email.trim()} className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
            <Icons.plus size={15} /> {saving ? 'Toevoegen…' : 'Contactpersoon toevoegen'}
          </button>
        </div>
      </form>

      {/* Open lijst */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Nog toe te voegen <span className="text-gray-500 font-normal">({open.length})</span></h2>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-gray-500">Laden…</p>
        ) : open.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Geen openstaande contactpersonen. Voeg er hierboven een toe!</p>
        ) : (
          <div className="divide-y divide-white/5">
            {open.map(c => {
              const photo = getPhotoUrl(c.addedByName)
              const canDelete = c.addedById === uid || canManage
              return (
                <div key={c.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{c.name}</span>
                      {c.company && <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300">{c.company}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <a href={`mailto:${c.email}`} className="hover:text-workx-lime">{c.email}</a>
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                      {photo && <img src={photo} alt={c.addedByName} className="w-4 h-4 rounded-full object-cover" />}
                      Toegevoegd door {c.addedByName.split(' ')[0]} · {fmt(c.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canManage && (
                      <button onClick={() => toggleDone(c, true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-workx-lime/15 text-workx-lime hover:bg-workx-lime/25 transition-colors text-xs font-medium" title="Markeer als toegevoegd aan Mailchimp">
                        <Icons.check size={13} /> In Mailchimp
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Verwijderen">
                        <Icons.trash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toegevoegd (afgevinkt) */}
      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(v => !v)} className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
            <Icons.chevronRight size={14} className={`transition-transform ${showDone ? 'rotate-90' : ''}`} />
            Toegevoegd aan Mailchimp ({done.length})
          </button>
          {showDone && (
            <div className="card overflow-hidden mt-2 opacity-80">
              <div className="divide-y divide-white/5">
                {done.map(c => (
                  <div key={c.id} className="px-5 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-300 line-through">{c.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{c.email}{c.company ? ` · ${c.company}` : ''}</span>
                      {c.processedByName && <div className="text-[11px] text-gray-600">Afgevinkt door {c.processedByName.split(' ')[0]}{c.processedAt ? ` · ${fmt(c.processedAt)}` : ''}</div>}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => toggleDone(c, false)} className="text-[11px] text-gray-400 hover:text-workx-lime px-2 py-1 rounded-lg hover:bg-white/5" title="Terugzetten naar de lijst">
                          Terugzetten
                        </button>
                        <button onClick={() => remove(c)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Definitief verwijderen">
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
