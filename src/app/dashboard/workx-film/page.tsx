'use client'

// Tijdelijke pagina: de Workx-film + input van het hele team.
// Jochem kan alle input in één keer kopiëren om naar de editor te sturen.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'

interface Feedback {
  id: string
  userId: string
  userName: string
  message: string
  createdAt: string
}

const MANAGER_ROLES = ['PARTNER', 'ADMIN']

export default function WorkxFilmPage() {
  const { data: session } = useSession()
  const uid = (session?.user as { id?: string })?.id
  const role = (session?.user as { role?: string })?.role || ''
  const isManager = MANAGER_ROLES.includes(role)

  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch('/api/film-feedback')
      .then(r => r.ok ? r.json() : null)
      .then(d => setItems(d?.feedback || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    const msg = message.trim()
    if (!msg) return
    setSaving(true)
    try {
      const res = await fetch('/api/film-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      if (!res.ok) { toast.error('Kon niet plaatsen'); return }
      setMessage('')
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (f: Feedback) => {
    if (!confirm('Deze reactie verwijderen?')) return
    const res = await fetch(`/api/film-feedback?id=${f.id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== f.id))
    else toast.error('Kon niet verwijderen')
  }

  const copyAll = async () => {
    if (items.length === 0) { toast.error('Nog geen input om te kopiëren'); return }
    const text = items.map(f => {
      const date = new Date(f.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
      return `${f.userName} (${date}):\n${f.message}`
    }).join('\n\n')
    const header = `Input Workx-film — ${items.length} reactie${items.length === 1 ? '' : 's'}\n\n`
    try {
      await navigator.clipboard.writeText(header + text)
      toast.success('Alle input gekopieerd — plak het in je mail aan de editor')
    } catch {
      toast.error('Kopiëren mislukt')
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Icons.play className="text-workx-lime" size={22} /> Workx film
          </h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">Tijdelijk</span>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Bekijk de nieuwe "Werken bij Workx"-film en geef je input. Alle reacties verzamel ik hier, zodat we ze in één keer naar de editor kunnen sturen.
        </p>
      </div>

      {/* Video */}
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black">
        <video controls preload="metadata" className="w-full h-auto block" playsInline>
          <source src="https://bibyb2ew6qnzn3ni.public.blob.vercel-storage.com/workx-film/werken-bij-workx-2026.mp4" type="video/mp4" />
          Je browser kan deze video niet afspelen.
        </video>
      </div>

      {/* Input plaatsen */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-white mb-2">Jouw input op de film</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          placeholder="Wat vind je? Wat kan beter — beeld, muziek, tekst, volgorde, lengte…"
          className="input-field w-full text-sm resize-y"
        />
        <div className="flex justify-end mt-2">
          <button onClick={submit} disabled={saving || !message.trim()} className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
            <Icons.plus size={15} /> {saving ? 'Plaatsen…' : 'Plaats input'}
          </button>
        </div>
      </div>

      {/* Alle input */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-white">Alle input <span className="text-gray-500 font-normal">({items.length})</span></h2>
          <button onClick={copyAll} className="btn-secondary text-xs flex items-center gap-1.5">
            <Icons.copy size={14} /> Kopieer alles
          </button>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-gray-500">Laden…</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Nog geen input. Wees de eerste!</p>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map(f => {
              const photo = getPhotoUrl(f.userName)
              const canDelete = f.userId === uid || isManager
              return (
                <div key={f.id} className="px-5 py-3 flex gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0 ring-1 ring-white/10">
                    {photo ? <img src={photo} alt={f.userName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white/60">{f.userName.charAt(0)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{f.userName}</span>
                      <span className="text-[11px] text-gray-500">{new Date(f.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap mt-0.5">{f.message}</p>
                  </div>
                  {canDelete && (
                    <button onClick={() => remove(f)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 self-start" title="Verwijderen">
                      <Icons.trash size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
