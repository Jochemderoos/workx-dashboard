'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

// Wie krijgt deze widget te zien? Volledige namen, exacte match.
const UPLOAD_REMINDER_USERS = new Set([
  'Hanna Blaauboer',
  'Lotte van Sint Truiden',
  'Bente Karels',
  'Jochem de Roos',
])

// Interval tussen uploads. Vanaf 14 dagen sinds laatste upload → alarm-modus.
const UPLOAD_INTERVAL_DAYS = 14

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

function formatDateNL(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function UploadReminderWidget() {
  const { data: session } = useSession()
  const userName = session?.user?.name || ''
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const eligible = UPLOAD_REMINDER_USERS.has(userName)

  useEffect(() => {
    if (!eligible) {
      setLoaded(true)
      return
    }
    let cancelled = false
    fetch('/api/open-invoices/last-import')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        setLastImportedAt(data?.lastImportedAt || null)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [eligible])

  if (!eligible || !loaded) return null

  const now = new Date()
  const daysSince = lastImportedAt ? daysBetween(new Date(lastImportedAt), now) : null
  const overdueDays = daysSince !== null ? daysSince - UPLOAD_INTERVAL_DAYS : null
  const isAlarm = daysSince === null || daysSince >= UPLOAD_INTERVAL_DAYS

  // Volgende geplande upload-datum = laatste upload + 14 dagen
  const nextDue = lastImportedAt
    ? new Date(new Date(lastImportedAt).getTime() + UPLOAD_INTERVAL_DAYS * 86400000)
    : now

  return (
    <div className={`rounded-2xl border p-5 ${
      isAlarm
        ? 'border-red-500/40 bg-gradient-to-br from-red-500/15 via-orange-500/10 to-transparent shadow-lg shadow-red-500/10'
        : 'border-green-500/20 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent'
    }`}>
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isAlarm ? 'bg-red-500/25 animate-pulse' : 'bg-green-500/20'
          }`}>
            <Icons.upload size={16} className={isAlarm ? 'text-red-300' : 'text-green-400'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isAlarm ? '⏰ Tijd voor nieuwe debiteuren-upload' : 'Debiteuren — upload up-to-date'}
            </h3>
            <p className="text-[11px] text-gray-400">
              {daysSince === null
                ? 'Nog nooit een upload gedaan'
                : isAlarm
                  ? `${daysSince} dagen sinds laatste upload (${overdueDays! > 0 ? `${overdueDays} dgn te laat` : 'precies op tijd'})`
                  : `${daysSince} dgn sinds laatste upload · volgende keer over ${UPLOAD_INTERVAL_DAYS - daysSince} dgn`}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/debiteuren"
          className={`text-[11px] px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
            isAlarm
              ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {isAlarm ? 'Upload nu →' : 'Naar debiteuren'}
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Laatste upload</p>
          <p className="text-white font-medium tabular-nums">
            {lastImportedAt ? formatDateNL(lastImportedAt) : '—'}
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Volgende upload</p>
          <p className={`font-medium tabular-nums ${isAlarm ? 'text-red-300' : 'text-white'}`}>
            {nextDue.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 col-span-2 sm:col-span-1">
          <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">Cadans</p>
          <p className="text-white/80 font-medium">Elke 2 weken</p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-gray-500 italic">
        Reminder voor Hanna, Lotte, Bente en Jochem. Upload de BaseNet-PDF (en optioneel het Word-overzicht) via de debiteuren-pagina.
      </p>
    </div>
  )
}
