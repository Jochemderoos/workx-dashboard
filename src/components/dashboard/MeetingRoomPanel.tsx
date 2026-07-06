'use client'

// Vergaderruimte reserveren — simpel: van–tot + optioneel onderwerp.
// Toont duidelijk wie wanneer de ruimte heeft. Gebruikt op Appjeplekje.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'

interface Booking {
  id: string
  date: string
  startTime: string
  endTime: string
  title: string | null
  userId: string
  userName: string
}

export default function MeetingRoomPanel({ date }: { date: string }) {
  const { data: session } = useSession()
  const uid = (session?.user as { id?: string })?.id
  const role = (session?.user as { role?: string })?.role || ''
  const isManager = role === 'PARTNER' || role === 'ADMIN'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/meeting-room?date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBookings(d?.bookings || []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])

  const reserve = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/meeting-room', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, startTime: start, endTime: end, title: title || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Kon niet reserveren'); return }
      toast.success('Vergaderruimte gereserveerd')
      setTitle(''); setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (b: Booking) => {
    if (!confirm(`Reservering ${b.startTime}–${b.endTime} verwijderen?`)) return
    const res = await fetch(`/api/meeting-room?id=${b.id}`, { method: 'DELETE' })
    if (res.ok) setBookings(prev => prev.filter(x => x.id !== b.id))
    else toast.error('Kon niet verwijderen')
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
            <Icons.presentation className="text-rose-300" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Vergaderruimte</h3>
            <p className="text-[11px] text-gray-500">{bookings.length === 0 ? 'Vrij deze dag' : `${bookings.length} reservering${bookings.length === 1 ? '' : 'en'}`}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
        >
          <Icons.plus size={14} /> Reserveren
        </button>
      </div>

      {/* Reserveer-formulier */}
      {showForm && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Van</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className="input-field text-sm w-28" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Tot</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="input-field text-sm w-28" />
            </div>
            <div className="flex-1 min-w-[8rem]">
              <label className="block text-[11px] text-gray-400 mb-1">Onderwerp (optioneel)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="bv. cliëntgesprek" className="input-field text-sm w-full" />
            </div>
            <button onClick={reserve} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Bezig…' : 'Vastleggen'}
            </button>
          </div>
        </div>
      )}

      {/* Reserveringen */}
      {loading ? (
        <p className="text-sm text-gray-500">Laden…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500">Nog niet gereserveerd — de ruimte is deze dag vrij.</p>
      ) : (
        <div className="space-y-2">
          {bookings.map(b => {
            const photo = getPhotoUrl(b.userName)
            const canDelete = b.userId === uid || isManager
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-lg bg-rose-500/5 border border-rose-500/15 px-3 py-2">
                <span className="text-sm font-mono font-semibold text-rose-200 tabular-nums shrink-0">{b.startTime}–{b.endTime}</span>
                <div className="flex-1 min-w-0">
                  {b.title && <p className="text-sm text-white truncate">{b.title}</p>}
                  <div className="flex items-center gap-1.5">
                    {photo ? <img src={photo} alt={b.userName} className="w-4 h-4 rounded-full object-cover" /> : null}
                    <span className="text-[11px] text-gray-400 truncate">{b.userName}</span>
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => remove(b)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0" title="Verwijderen">
                    <Icons.trash size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
