'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/ui/Icons'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Credential {
  id: string
  service: string
  category: string
  username: string | null
  password: string
  url: string | null
  notes: string | null
  addedBy: { name: string }
  updatedAt: string
}

const CATEGORIES = ['AI & Tools', 'Abonnementen', 'Portalen', 'Administratie', 'ICT', 'Overig']

// Belangrijke services & contacten — uit het kantoorhandboek (Workx Docs).
// Geen wachtwoorden; voor logins zie Hanna of de credentials hieronder.
interface ImportantService {
  name: string
  icon: string
  url?: string
  email?: string
  phone?: string
  note?: string
}

const IMPORTANT_SERVICES: ImportantService[] = [
  {
    name: 'BaseNet',
    icon: '📂',
    phone: '020 685 5031',
    email: 'servicedesk@basenet.nl',
    note: 'Dossier- en zakenbeheer',
  },
  {
    name: 'Doxflow',
    icon: '🖨️',
    url: 'http://10.4.42.80/login',
    phone: '020 331 7171',
    email: 'david@doxflow.nl / lennon@doxflow.nl',
    note: 'Voorbereiden processtukken',
  },
  {
    name: 'Constant IT',
    icon: '💻',
    phone: '020 760 8700',
    email: 'support@constant.it',
    note: 'IT-support',
  },
  {
    name: 'De Bary',
    icon: '🏦',
    phone: '020 240 3000',
    email: 'info@debary.nl',
    note: 'Bank',
  },
  {
    name: 'Fietskoerier',
    icon: '🚲',
    phone: '020 612 6700',
    email: 'spoed@fietskoerier.nl',
    note: 'Spoedbezorging',
  },
  {
    name: 'Canon (PCI-Groep)',
    icon: '🖨️',
    phone: '088 543 08 08',
    note: 'Printer-onderhoud',
  },
  {
    name: 'Graphic Design (Joeri)',
    icon: '🎨',
    email: 'joeri@ttwwoo.nl',
    note: 'Vormgeving',
  },
  {
    name: 'Workx Advocaten (kantoor)',
    icon: '🏛️',
    phone: '020 308 0320',
    url: 'https://www.workxadvocaten.nl',
    note: 'Eigen kantoor',
  },
]

export default function WachtwoordenPage() {
  const { data: session } = useSession()
  const { data: credentials, mutate } = useSWR<Credential[]>('/api/credentials', fetcher)
  const [search, setSearch] = useState('')
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Credential | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isAdmin = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

  const filtered = (credentials || []).filter(c =>
    c.service.toLowerCase().includes(search.toLowerCase()) ||
    c.username?.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase()) ||
    c.notes?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, Credential[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})

  const togglePassword = (id: string) => {
    setShowPasswords(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit wachtwoord wilt verwijderen?')) return
    await fetch(`/api/credentials/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wachtwoorden</h1>
          <p className="text-sm text-gray-400 mt-1">Gedeelde wachtwoorden voor tools en abonnementen</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-workx-lime text-workx-dark text-sm font-semibold hover:bg-workx-lime/90 transition-all shadow-lg shadow-workx-lime/20"
          >
            <Icons.plus size={16} />
            Toevoegen
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Icons.search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Zoek op service, gebruikersnaam..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all"
        />
      </div>

      {/* Belangrijke services & contacten */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Belangrijke services</h2>
          <a href="/dashboard/hr-docs" className="text-[11px] text-workx-lime/70 hover:text-workx-lime">
            uit kantoorhandboek →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {IMPORTANT_SERVICES.map((s) => (
            <div key={s.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-xl leading-none flex-shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{s.name}</h3>
                  {s.note && <p className="text-[11px] text-gray-500 mt-0.5">{s.note}</p>}
                </div>
              </div>
              <div className="space-y-1 text-xs">
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-workx-lime hover:underline truncate"
                    title={s.url}
                  >
                    <Icons.link size={11} className="flex-shrink-0" />
                    <span className="truncate">{s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                  </a>
                )}
                {s.email && (
                  <a
                    href={`mailto:${s.email.split(' / ')[0]}`}
                    className="flex items-center gap-2 text-gray-300 hover:text-workx-lime truncate"
                    title={s.email}
                  >
                    <Icons.mail size={11} className="flex-shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </a>
                )}
                {s.phone && (
                  <a
                    href={`tel:${s.phone.replace(/\s+/g, '')}`}
                    className="flex items-center gap-2 text-gray-300 hover:text-workx-lime tabular-nums"
                  >
                    <Icons.phone size={11} className="flex-shrink-0" />
                    <span>{s.phone}</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-3 italic">
          Voor inloggegevens (Trifact, Exact, KPN, etc.): zie credentials hieronder of vraag Hanna.
        </p>
      </div>

      {/* Credentials grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Icons.lock size={28} className="text-gray-500" />
          </div>
          <p className="text-gray-400">
            {search ? 'Geen resultaten gevonden' : 'Nog geen wachtwoorden opgeslagen'}
          </p>
        </div>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h2>
            <div className="grid gap-3">
              {items.map((cred) => (
                <div
                  key={cred.id}
                  className="group bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Service name + URL */}
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{cred.service}</h3>
                        {cred.url && (
                          <a
                            href={cred.url.startsWith('http') ? cred.url : `https://${cred.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-workx-lime hover:text-workx-lime/80 transition-colors"
                          >
                            <Icons.externalLink size={14} />
                          </a>
                        )}
                      </div>

                      {/* Username */}
                      {cred.username && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-24 flex-shrink-0">Gebruiker</span>
                          <span className="text-sm text-gray-300 font-mono">{cred.username}</span>
                          <button
                            onClick={() => copyToClipboard(cred.username!, `user-${cred.id}`)}
                            className="p-1 rounded-lg text-gray-600 hover:text-workx-lime transition-colors"
                            title="Kopieer gebruikersnaam"
                          >
                            {copiedId === `user-${cred.id}` ? <Icons.check size={14} className="text-workx-lime" /> : <Icons.copy size={14} />}
                          </button>
                        </div>
                      )}

                      {/* Password */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-24 flex-shrink-0">Wachtwoord</span>
                        <span className="text-sm text-gray-300 font-mono">
                          {showPasswords.has(cred.id) ? cred.password : '••••••••••'}
                        </span>
                        <button
                          onClick={() => togglePassword(cred.id)}
                          className="p-1 rounded-lg text-gray-600 hover:text-white transition-colors"
                          title={showPasswords.has(cred.id) ? 'Verberg' : 'Toon'}
                        >
                          {showPasswords.has(cred.id) ? <Icons.eyeOff size={14} /> : <Icons.eye size={14} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(cred.password, `pass-${cred.id}`)}
                          className="p-1 rounded-lg text-gray-600 hover:text-workx-lime transition-colors"
                          title="Kopieer wachtwoord"
                        >
                          {copiedId === `pass-${cred.id}` ? <Icons.check size={14} className="text-workx-lime" /> : <Icons.copy size={14} />}
                        </button>
                      </div>

                      {/* Notes */}
                      {cred.notes && (
                        <p className="text-xs text-gray-500 mt-1">{cred.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditing(cred); setShowModal(true) }}
                          className="p-2 rounded-xl text-gray-500 hover:text-workx-lime hover:bg-white/10 transition-all"
                          title="Bewerken"
                        >
                          <Icons.edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(cred.id)}
                          className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-white/10 transition-all"
                          title="Verwijderen"
                        >
                          <Icons.trash size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-gray-600">
                      Toegevoegd door {cred.addedBy.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <CredentialModal
          credential={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { mutate(); setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function CredentialModal({
  credential,
  onClose,
  onSaved,
}: {
  credential: Credential | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!credential
  const [service, setService] = useState(credential?.service || '')
  const [category, setCategory] = useState(credential?.category || 'Overig')
  const [username, setUsername] = useState(credential?.username || '')
  const [password, setPassword] = useState(credential?.password || '')
  const [url, setUrl] = useState(credential?.url || '')
  const [notes, setNotes] = useState(credential?.notes || '')
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service.trim() || !password.trim()) return

    setSaving(true)
    try {
      const res = await fetch(
        isEdit ? `/api/credentials/${credential!.id}` : '/api/credentials',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service, category, username, password, url, notes }),
        }
      )
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-workx-gray border border-white/10 rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(650px, calc(100vh - 2rem))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center">
              <Icons.lock size={20} className="text-workx-lime" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEdit ? 'Wachtwoord bewerken' : 'Wachtwoord toevoegen'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <Icons.x size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto workx-scrollbar p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Service *</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="bv. DeepL Pro"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Categorie</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-workx-lime/20 text-workx-lime border border-workx-lime/40'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="bv. https://deepl.com/login"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Gebruikersnaam / e-mail</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="bv. info@goedebuur.nl"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Wachtwoord *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Vul het wachtwoord in"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-500 hover:text-white transition-colors"
              >
                {showPw ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Notities</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra informatie..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-workx-lime/40 transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleSubmit as any}
            disabled={!service.trim() || !password.trim() || saving}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
              !service.trim() || !password.trim() || saving
                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                : 'bg-workx-lime hover:bg-workx-lime/90 text-workx-dark shadow-lg shadow-workx-lime/20'
            }`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <>
                {isEdit ? <Icons.check size={16} /> : <Icons.plus size={16} />}
                {isEdit ? 'Opslaan' : 'Toevoegen'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
