'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'
import { getPhotoUrl } from '@/lib/team-photos'
import { OFFICE_PEOPLE, OFFICE_PERSON_KEYS, canEditOffice } from '@/lib/office-team'

type Status = 'OFFICE' | 'REMOTE' | 'ABSENT'
type PhoneMode = 'AUTO' | 'FORWARD' | 'COVER'

interface AttendanceEntry {
  id: string
  personKey: string
  date: string
  status: Status
  note: string | null
}

interface PhoneDay {
  id: string
  date: string
  mode: PhoneMode
  forwardTo: string | null
  coverBy: string | null
  note: string | null
}

const DAYS_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag']
const DAYS_NL_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr']
const MONTHS_NL_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// Subtiel kleurgebruik — geen iconen of emoji's.
const STATUS_CONFIG: Record<Status, {
  label: string
  short: string
  bar: string         // verticaal bandje links in cel
  bg: string
  text: string
}> = {
  OFFICE: {
    label: 'Op kantoor',
    short: 'Kantoor',
    bar: 'bg-emerald-400',
    bg: 'bg-emerald-500/[0.08]',
    text: 'text-emerald-300',
  },
  REMOTE: {
    label: 'Remote',
    short: 'Remote',
    bar: 'bg-sky-400',
    bg: 'bg-sky-500/[0.08]',
    text: 'text-sky-300',
  },
  ABSENT: {
    label: 'Afwezig',
    short: 'Vrij',
    bar: 'bg-zinc-500',
    bg: 'bg-zinc-500/[0.08]',
    text: 'text-zinc-400',
  },
}

function getCurrentMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isoDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface SessionUser {
  id: string
  name: string
  role: string
}

export default function OfficePage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [phoneDays, setPhoneDays] = useState<PhoneDay[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [phoneEditFor, setPhoneEditFor] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) setUser(await res.json())
      } catch { /* ignore */ }
    }
    load()
  }, [])

  const range = useMemo(() => {
    const start = addDays(getCurrentMonday(), weekOffset * 7)
    const end = addDays(start, 13)
    return { start, end }
  }, [weekOffset])

  const workdays = useMemo<Date[]>(() => {
    const days: Date[] = []
    for (let i = 0; i < 14; i++) {
      const d = addDays(range.start, i)
      if (!isWeekend(d)) days.push(d)
    }
    return days
  }, [range])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/office?startDate=${isoDateOnly(range.start)}&endDate=${isoDateOnly(range.end)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries(data.entries)
      setPhoneDays(data.phoneDays)
    } catch {
      toast.error('Kon office-data niet laden')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchData() }, [fetchData])

  const lookup = useMemo(() => {
    const map = new Map<string, AttendanceEntry>()
    for (const e of entries) {
      const dateKey = isoDateOnly(new Date(e.date))
      map.set(`${e.personKey}|${dateKey}`, e)
    }
    return map
  }, [entries])

  const phoneLookup = useMemo(() => {
    const map = new Map<string, PhoneDay>()
    for (const p of phoneDays) {
      map.set(isoDateOnly(new Date(p.date)), p)
    }
    return map
  }, [phoneDays])

  const canEdit = canEditOffice(user ? { user: { name: user.name, role: user.role } } : null)

  const onOfficeNames = useCallback((d: Date): string[] => {
    const dateKey = isoDateOnly(d)
    return OFFICE_PEOPLE
      .filter(p => lookup.get(`${p.key}|${dateKey}`)?.status === 'OFFICE')
      .map(p => p.name.split(' ')[0])
  }, [lookup])

  const cycleStatus = async (personKey: string, date: Date, current: Status | null) => {
    const dateStr = isoDateOnly(date)
    // Cycle: leeg (= afwezig) → OFFICE → REMOTE → leeg. Geen aparte ABSENT-klik.
    // Legacy ABSENT-records cyclen ook terug naar leeg.
    let newStatus: Status | null
    if (!current) newStatus = 'OFFICE'
    else if (current === 'OFFICE') newStatus = 'REMOTE'
    else newStatus = null // REMOTE → leeg, ABSENT → leeg

    try {
      if (newStatus === null) {
        await fetch('/api/office/attendance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personKey, date: dateStr }),
        })
        setEntries(prev => prev.filter(e => !(e.personKey === personKey && isoDateOnly(new Date(e.date)) === dateStr)))
      } else {
        const res = await fetch('/api/office/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personKey, date: dateStr, status: newStatus }),
        })
        if (!res.ok) throw new Error()
        const saved = await res.json()
        setEntries(prev => {
          const without = prev.filter(e => !(e.personKey === personKey && isoDateOnly(new Date(e.date)) === dateStr))
          return [...without, saved]
        })
      }
    } catch {
      toast.error('Kon niet opslaan')
      fetchData()
    }
  }

  const updatePhone = async (date: Date, patch: Partial<PhoneDay>) => {
    const dateStr = isoDateOnly(date)
    const existing = phoneLookup.get(dateStr)
    try {
      const res = await fetch('/api/office/phone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          mode: patch.mode ?? existing?.mode ?? 'AUTO',
          forwardTo: patch.forwardTo !== undefined ? patch.forwardTo : existing?.forwardTo ?? null,
          coverBy: patch.coverBy !== undefined ? patch.coverBy : existing?.coverBy ?? null,
          note: patch.note !== undefined ? patch.note : existing?.note ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setPhoneDays(prev => {
        const without = prev.filter(p => isoDateOnly(new Date(p.date)) !== dateStr)
        return [...without, saved]
      })
    } catch {
      toast.error('Kon telefoon-regeling niet opslaan')
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const week1 = workdays.slice(0, 5)
  const week2 = workdays.slice(5, 10)
  const todayOnOffice = onOfficeNames(today)

  return (
    <div className="space-y-8 fade-in p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-gray-500 mb-1">Office</p>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            <TextReveal>Aanwezigheid back office</TextReveal>
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl">
            Wie van Hanna, Lotte, Bente en Diyar is wanneer op kantoor of remote, met de bijbehorende kantoortelefoon-regeling.
          </p>
        </div>
        {canEdit && (
          <p className="text-xs text-gray-500">Klik op een cel om Kantoor / Remote / Afwezig te kiezen.</p>
        )}
      </div>

      {/* Vandaag-paneel */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-gray-500">Vandaag</h2>
          <p className="text-sm text-gray-400 capitalize">
            {today.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
          {OFFICE_PEOPLE.map(p => {
            const entry = lookup.get(`${p.key}|${isoDateOnly(today)}`)
            const status = entry?.status as Status | undefined
            const cfg = status ? STATUS_CONFIG[status] : null
            const photo = getPhotoUrl(p.name)
            return (
              <div key={p.key} className="flex items-center gap-4 px-5 py-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {photo ? (
                    <Image src={photo} alt={p.name} fill className="object-cover" sizes="40px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-medium text-gray-300">
                      {p.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[11px] text-gray-500">{p.role}</p>
                </div>
                {cfg ? (
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.bar}`} />
                    {cfg.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </div>
            )
          })}
          {/* Telefoon-regeling van vandaag */}
          <PhoneRow
            date={today}
            phone={phoneLookup.get(isoDateOnly(today))}
            onOffice={todayOnOffice}
          />
        </div>
      </section>

      {/* Week-navigatie */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 2)}
            className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Vorige 2 weken"
          >
            <Icons.chevronLeft size={16} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 rounded-md bg-workx-lime/10 text-workx-lime text-xs font-medium hover:bg-workx-lime/20 transition-colors"
            >
              Naar deze week
            </button>
          )}
          <button
            onClick={() => setWeekOffset(o => o + 2)}
            className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Volgende 2 weken"
          >
            <Icons.chevronRight size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-400 tabular-nums">
          {range.start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — {addDays(range.start, 11).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-16 flex items-center justify-center">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <WeekMatrix
            label={weekOffset === 0 ? 'Deze week' : 'Week 1'}
            days={week1}
            today={today}
            lookup={lookup}
            phoneLookup={phoneLookup}
            editMode={canEdit}
            onCycle={cycleStatus}
            onPhoneEdit={(d) => setPhoneEditFor(isoDateOnly(d))}
            onOfficeNames={onOfficeNames}
          />
          <WeekMatrix
            label={weekOffset === 0 ? 'Volgende week' : 'Week 2'}
            days={week2}
            today={today}
            lookup={lookup}
            phoneLookup={phoneLookup}
            editMode={canEdit}
            onCycle={cycleStatus}
            onPhoneEdit={(d) => setPhoneEditFor(isoDateOnly(d))}
            onOfficeNames={onOfficeNames}
          />
        </div>
      )}

      {/* Legenda */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="text-gray-500 uppercase tracking-widest font-medium">Legenda</span>
        <span className={`flex items-center gap-1.5 ${STATUS_CONFIG.OFFICE.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG.OFFICE.bar}`} />
          Op kantoor
        </span>
        <span className={`flex items-center gap-1.5 ${STATUS_CONFIG.REMOTE.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG.REMOTE.bar}`} />
          Remote
        </span>
        <span className="flex items-center gap-1.5 text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          Afwezig (niet ingevuld)
        </span>
      </div>

      {/* Kantoorgegevens — handig voor facturen, contracten, betalingen */}
      <OfficeDetails />

      {/* Phone-edit modal — open voor iedereen die canEdit heeft */}
      {phoneEditFor && canEdit && (
        <PhoneEditModal
          date={new Date(phoneEditFor)}
          current={phoneLookup.get(phoneEditFor)}
          onOfficeNames={onOfficeNames(new Date(phoneEditFor))}
          onClose={() => setPhoneEditFor(null)}
          onSave={async (patch) => {
            await updatePhone(new Date(phoneEditFor), patch)
            setPhoneEditFor(null)
          }}
        />
      )}
    </div>
  )
}

// ───────── Phone row in vandaag-paneel ─────────

function PhoneRow({
  date, phone, onOffice,
}: {
  date: Date
  phone?: PhoneDay
  onOffice: string[]
}) {
  const { label, danger } = describePhone(phone, onOffice)
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icons.phone className="text-gray-400" size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Kantoortelefoon</p>
        <p className="text-[11px] text-gray-500">Vandaag</p>
      </div>
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium ${
        danger
          ? 'bg-red-500/10 text-red-300'
          : 'bg-emerald-500/[0.08] text-emerald-300'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${danger ? 'bg-red-400' : 'bg-emerald-400'}`} />
        {label}
      </span>
    </div>
  )
}

function describePhone(phone: PhoneDay | undefined, onOffice: string[]): { label: string; danger: boolean } {
  const mode: PhoneMode = phone?.mode || 'AUTO'
  if (mode === 'FORWARD' && phone?.forwardTo) return { label: `Doorgeschakeld naar ${phone.forwardTo}`, danger: false }
  if (mode === 'COVER' && phone?.coverBy) return { label: `Opgenomen door ${phone.coverBy}`, danger: false }
  if (mode === 'AUTO' && onOffice.length > 0) return { label: `Opgenomen door ${onOffice.join(', ')}`, danger: false }
  return { label: 'Niemand op kantoor — telefoon niet ingesteld', danger: true }
}

// ───────── Week matrix ─────────

interface WeekMatrixProps {
  label: string
  days: Date[]
  today: Date
  lookup: Map<string, AttendanceEntry>
  phoneLookup: Map<string, PhoneDay>
  editMode: boolean
  onCycle: (personKey: string, date: Date, current: Status | null) => void
  onPhoneEdit: (date: Date) => void
  onOfficeNames: (d: Date) => string[]
}

function WeekMatrix({
  label, days, today, lookup, phoneLookup, editMode, onCycle, onPhoneEdit, onOfficeNames,
}: WeekMatrixProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <header className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-gray-400">{label}</h2>
        <p className="text-xs text-gray-500 tabular-nums">
          {days[0]?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} —{' '}
          {days[days.length - 1]?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-3 px-5 text-[10px] uppercase tracking-widest text-gray-500 font-medium w-48">
                Medewerker
              </th>
              {days.map((d, i) => {
                const isToday = isSameDay(d, today)
                return (
                  <th key={d.toISOString()} className={`text-center py-3 px-2 ${isToday ? 'bg-workx-lime/[0.06]' : ''}`}>
                    <div className={`text-[10px] uppercase tracking-widest font-medium ${isToday ? 'text-workx-lime' : 'text-gray-500'}`}>
                      {DAYS_NL_SHORT[i]}
                    </div>
                    <div className={`text-sm font-medium mt-0.5 tabular-nums ${isToday ? 'text-workx-lime' : 'text-white'}`}>
                      {d.getDate()} <span className="text-[10px] font-normal text-gray-500">{MONTHS_NL_SHORT[d.getMonth()]}</span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {OFFICE_PEOPLE.map((p) => {
              const photo = getPhotoUrl(p.name)
              return (
                <tr key={p.key} className="border-b border-white/5 last:border-b-0">
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                        {photo ? (
                          <Image src={photo} alt={p.name} fill className="object-cover" sizes="36px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-300">
                            {p.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-500 truncate">{p.role}</p>
                      </div>
                    </div>
                  </td>
                  {days.map(d => {
                    const entry = lookup.get(`${p.key}|${isoDateOnly(d)}`)
                    const status = entry?.status as Status | undefined
                    const cfg = status ? STATUS_CONFIG[status] : null
                    const isToday = isSameDay(d, today)
                    return (
                      <td key={d.toISOString()} className={`py-2 px-2 ${isToday ? 'bg-workx-lime/[0.04]' : ''}`}>
                        <button
                          onClick={() => editMode && onCycle(p.key, d, status ?? null)}
                          disabled={!editMode}
                          className={`relative w-full h-9 rounded-md text-xs font-medium transition-colors flex items-center justify-center overflow-hidden ${
                            cfg
                              ? `${cfg.bg} ${cfg.text}`
                              : 'bg-white/[0.02] text-gray-600'
                          } ${editMode ? 'cursor-pointer hover:brightness-125 ring-1 ring-inset ring-white/5' : 'cursor-default'}`}
                        >
                          {cfg && <span className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-r ${cfg.bar}`} />}
                          {cfg ? cfg.short : <span className="text-gray-600 text-base">·</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Telefoon-rij */}
            <tr className="bg-white/[0.02]">
              <td className="py-3 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Icons.phone className="text-gray-400" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Telefoon</p>
                    <p className="text-[10px] text-gray-500">Kantoorlijn</p>
                  </div>
                </div>
              </td>
              {days.map(d => {
                const dateKey = isoDateOnly(d)
                const phone = phoneLookup.get(dateKey)
                const onOfficeList = onOfficeNames(d)
                const { label: phoneLabel, danger } = describePhone(phone, onOfficeList)
                const isToday = isSameDay(d, today)
                const compact = phone?.mode === 'FORWARD' && phone.forwardTo
                  ? `→ ${phone.forwardTo}`
                  : phone?.mode === 'COVER' && phone.coverBy
                    ? phone.coverBy
                    : onOfficeList.length > 0
                      ? onOfficeList.join(', ')
                      : 'Niemand'
                return (
                  <td key={d.toISOString()} className={`py-2 px-2 ${isToday ? 'bg-workx-lime/[0.04]' : ''}`}>
                    <button
                      onClick={() => editMode && onPhoneEdit(d)}
                      disabled={!editMode}
                      className={`relative w-full h-9 rounded-md text-[11px] font-medium transition-colors overflow-hidden truncate px-2 ${
                        danger
                          ? 'bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20'
                          : 'bg-emerald-500/[0.08] text-emerald-300'
                      } ${editMode ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                      title={phoneLabel}
                    >
                      {compact}
                    </button>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ───────── Phone edit modal ─────────

function PhoneEditModal({
  date, current, onOfficeNames, onClose, onSave,
}: {
  date: Date
  current?: PhoneDay
  onOfficeNames: string[]
  onClose: () => void
  onSave: (patch: Partial<PhoneDay>) => Promise<void>
}) {
  const [mode, setMode] = useState<PhoneMode>(current?.mode || 'AUTO')
  const [forwardTo, setForwardTo] = useState(current?.forwardTo || '')
  const [coverBy, setCoverBy] = useState(current?.coverBy || '')
  const [note, setNote] = useState(current?.note || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        mode,
        forwardTo: mode === 'FORWARD' ? forwardTo : null,
        coverBy: mode === 'COVER' ? coverBy : null,
        note,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-workx-gray rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Kantoortelefoon</p>
            <h3 className="text-base font-medium text-white capitalize">
              {date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Icons.x size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {([
              { id: 'AUTO' as PhoneMode, label: 'Automatisch', desc: onOfficeNames.length > 0 ? `Opgenomen door ${onOfficeNames.join(', ')}` : 'Niemand op kantoor — kies een andere optie' },
              { id: 'COVER' as PhoneMode, label: 'Opgenomen door…', desc: 'Specifieke persoon (override).' },
              { id: 'FORWARD' as PhoneMode, label: 'Doorgeschakeld naar…', desc: 'Nummer of partner (bv. mobiel).' },
            ]).map(o => {
              const selected = mode === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setMode(o.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selected
                      ? 'bg-workx-lime/[0.08] border-workx-lime/40 text-white'
                      : 'bg-white/[0.02] border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{o.label}</span>
                    {selected && <Icons.check size={14} className="text-workx-lime" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{o.desc}</p>
                </button>
              )
            })}
          </div>

          {mode === 'COVER' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Opgenomen door</label>
              <input
                type="text"
                value={coverBy}
                onChange={(e) => setCoverBy(e.target.value)}
                placeholder="Bv. Lotte (vanuit huis) / extern"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
                autoFocus
              />
            </div>
          )}
          {mode === 'FORWARD' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Doorschakelen naar</label>
              <input
                type="text"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder="Bv. 06-12345678 of partner-naam"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Notitie (optioneel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bv. 'tot 13u doorgeschakeld'"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (mode === 'FORWARD' && !forwardTo.trim()) || (mode === 'COVER' && !coverBy.trim())}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────── Kantoorgegevens ─────────
// Handig bij facturen, contracten, betalingsverkeer — klik op een waarde
// kopieert 'm naar klembord.

function OfficeDetails() {
  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} gekopieerd`),
      () => toast.error('Kon niet kopiëren'),
    )
  }

  const Row = ({ label, value, copyLabel }: { label: string; value: string; copyLabel?: string }) => (
    <button
      type="button"
      onClick={() => copy(value, copyLabel || label)}
      className="group w-full flex items-baseline justify-between gap-4 px-4 py-2.5 -mx-1 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
    >
      <span className="text-xs uppercase tracking-wider text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-white font-mono tabular-nums truncate">{value}</span>
    </button>
  )

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <header className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <Icons.briefcase size={16} className="text-workx-lime" />
        <h2 className="text-sm font-semibold text-white">Kantoorgegevens</h2>
        <span className="text-xs text-gray-500 ml-auto">klik om te kopiëren</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-5">
        {/* Bedrijf */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2 px-1">Bedrijf</h3>
          <div className="space-y-0.5">
            <Row label="Naam" value="Workx Advocaten B.V." />
            <Row label="Adres" value="Herengracht 448" />
            <Row label="Postcode" value="1017 CA Amsterdam" />
            <Row label="KvK" value="56660936" />
            <Row label="BTW / VAT" value="NL852244034B01" />
          </div>
        </div>

        {/* Bankgegevens */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2 px-1">Bankgegevens</h3>
          <div className="space-y-0.5">
            <Row label="Bank" value="ABN AMRO" />
            <Row label="IBAN" value="NL86ABNA0457897503" />
            <Row label="BIC" value="ABNANL2A" />
            <Row label="T.n.v." value="Workx Advocaten B.V." />
            <Row label="Bank-adres" value="Gustav Mahlerlaan 10, 1082 PP Amsterdam" copyLabel="Bank-adres" />
          </div>
        </div>
      </div>
    </section>
  )
}
