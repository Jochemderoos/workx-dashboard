'use client'

// Compacte "Dagstart" — bovenaan /dashboard. Drie blokken in één strip:
// 1. Wist je dat?-tip van vandaag (zelfde als bell + Slack)
// 2. Wie is vandaag op kantoor
// 3. Jarigen vandaag
// Doel: één snelle blik = drie redenen om het dashboard open te hebben.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import { getTipOfTheDay } from '@/lib/wist-je-dat-tips'
import { useSession } from 'next-auth/react'

interface Attendee {
  userId: string
  name: string
  avatarUrl: string | null
  timeSlot: string
}

interface BirthdayUser {
  name: string
  birthDate: string | null
  avatarUrl: string | null
}

function todayMMDD(): string {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatToday(): string {
  return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function DagstartWidget() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isPartner = role === 'PARTNER' || role === 'ADMIN'

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [birthdaysToday, setBirthdaysToday] = useState<BirthdayUser[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/office-attendance?date=${todayISO()}`).then(r => r.ok ? r.json() : null),
      fetch('/api/birthdays').then(r => r.ok ? r.json() : []),
    ]).then(([att, bdays]) => {
      if (cancelled) return
      if (att?.attendees) setAttendees(att.attendees)
      if (Array.isArray(bdays)) {
        const md = todayMMDD()
        setBirthdaysToday(bdays.filter((u: BirthdayUser) => u.birthDate === md))
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [])

  const tip = getTipOfTheDay(isPartner)

  return (
    <div className="rounded-2xl border border-workx-lime/20 bg-gradient-to-br from-workx-lime/[0.06] via-workx-lime/[0.02] to-transparent p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-workx-lime/70 mb-0.5">Dagstart</p>
          <h2 className="text-base sm:text-lg font-semibold text-white capitalize">{formatToday()}</h2>
        </div>
        <Link
          href="/dashboard/overzicht"
          className="text-[11px] text-gray-400 hover:text-workx-lime transition-colors flex items-center gap-1"
        >
          Volledig overzicht
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Wist je dat? */}
        <Link
          href={tip.href}
          className="group rounded-xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-workx-lime/30 transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">💡</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Wist je dat?</span>
          </div>
          <p className="text-sm font-medium text-white mb-1.5">{tip.page}</p>
          <p className="text-xs text-gray-400 line-clamp-2">{tip.message}</p>
          <p className="text-[10px] text-workx-lime/70 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            Open →
          </p>
        </Link>

        {/* Vandaag op kantoor */}
        <Link
          href="/dashboard/appjeplekje"
          className="group rounded-xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-workx-lime/30 transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icons.mapPin size={14} className="text-workx-lime/80" />
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Vandaag op kantoor</span>
          </div>
          {loaded ? (
            attendees.length === 0 ? (
              <p className="text-xs text-gray-500">Nog niemand aangemeld.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-white mb-2">
                  {attendees.length} {attendees.length === 1 ? 'persoon' : 'mensen'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {attendees.slice(0, 8).map(a => {
                    const photo = getPhotoUrl(a.name, a.avatarUrl)
                    return photo ? (
                      <img
                        key={a.userId}
                        src={photo}
                        alt={a.name}
                        title={a.name}
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div
                        key={a.userId}
                        title={a.name}
                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold ring-1 ring-white/10"
                      >
                        {a.name.charAt(0)}
                      </div>
                    )
                  })}
                  {attendees.length > 8 && (
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[9px] text-gray-400">
                      +{attendees.length - 8}
                    </div>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="h-6 bg-white/5 rounded animate-pulse" />
          )}
        </Link>

        {/* Jarigen */}
        <Link
          href="/dashboard/team"
          className="group rounded-xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-workx-lime/30 transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎂</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Jarig vandaag</span>
          </div>
          {loaded ? (
            birthdaysToday.length === 0 ? (
              <p className="text-xs text-gray-500">Niemand vandaag jarig.</p>
            ) : (
              <div className="space-y-1.5">
                {birthdaysToday.map(b => {
                  const photo = getPhotoUrl(b.name, b.avatarUrl)
                  return (
                    <div key={b.name} className="flex items-center gap-2">
                      {photo ? (
                        <img src={photo} alt={b.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold ring-1 ring-white/10">
                          {b.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm text-white">{b.name}</span>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="h-6 bg-white/5 rounded animate-pulse" />
          )}
        </Link>
      </div>
    </div>
  )
}
