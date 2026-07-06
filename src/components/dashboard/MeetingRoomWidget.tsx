'use client'

// Compacte homepage-widget: toont of de vergaderruimte vandaag bezet is.
// Voor iedereen zichtbaar op de startpagina; reserveren gaat via Appjeplekje.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface Booking { id: string; startTime: string; endTime: string; title: string | null; userName: string }

export default function MeetingRoomWidget() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/meeting-room?date=${today}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBookings(d?.bookings || []))
      .catch(() => setBookings([]))
  }, [])

  if (bookings === null) return null
  const busy = bookings.length > 0

  return (
    <Link href="/dashboard/appjeplekje" className="block card p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${busy ? 'bg-rose-500/15' : 'bg-emerald-500/15'}`}>
          <Icons.presentation className={busy ? 'text-rose-300' : 'text-emerald-300'} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">Vergaderruimte</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${busy ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {busy ? 'Bezet vandaag' : 'Vrij vandaag'}
            </span>
          </div>
          {busy ? (
            <p className="text-xs text-gray-400 truncate">
              {bookings.map(b => `${b.startTime}–${b.endTime}${b.title ? ` ${b.title}` : ''} (${b.userName.split(' ')[0]})`).join(' · ')}
            </p>
          ) : (
            <p className="text-xs text-gray-500">Klik om te reserveren via Appjeplekje.</p>
          )}
        </div>
        <Icons.chevronRight className="text-gray-600 shrink-0" size={16} />
      </div>
    </Link>
  )
}
