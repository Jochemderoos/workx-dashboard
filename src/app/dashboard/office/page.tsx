'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'
import { getPhotoUrl, PARTNERS } from '@/lib/team-photos'
import { OFFICE_PEOPLE, OFFICE_PERSON_KEYS, canEditOffice } from '@/lib/office-team'


type Status = 'OFFICE' | 'REMOTE' | 'ABSENT'
type PhoneMode = 'AUTO' | 'FORWARD' | 'COVER' | 'CENTRALE'

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
  infoboxBy: string | null
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
  const [activeTab, setActiveTab] = useState<'aanwezigheid' | 'requests'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      return sp.get('tab') === 'requests' ? 'requests' : 'aanwezigheid'
    }
    return 'aanwezigheid'
  })

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
            <TextReveal>
              {activeTab === 'requests' ? 'Verzoeken aan Office' : 'Aanwezigheid back office'}
            </TextReveal>
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl">
            {activeTab === 'requests'
              ? 'Eén centrale plek voor alles wat het Office team moet oppakken — geen losse Slack-/mail-/mondelinge stromen meer.'
              : 'Wie van Hanna, Lotte, Bente en Diyar is wanneer op kantoor of remote, met de bijbehorende kantoortelefoon-regeling.'}
          </p>
        </div>
        {canEdit && activeTab === 'aanwezigheid' && (
          <p className="text-xs text-gray-500">Klik op een cel om Kantoor / Remote / Afwezig te kiezen.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 self-start">
        {([
          { id: 'aanwezigheid' as const, label: 'Aanwezigheid & Telefoon', icon: Icons.users },
          { id: 'requests' as const, label: 'Verzoeken aan Office', icon: Icons.fileText },
        ]).map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                active
                  ? 'bg-workx-lime text-workx-dark shadow'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'requests' && user && (
        <OfficeRequestsPanel currentUser={user} canManage={canEdit} />
      )}

      {activeTab === 'aanwezigheid' && (<>

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

      {/* Telefoon doorschakelen — instructiekaart */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icons.phone className="text-workx-lime" size={18} />
          <h2 className="text-sm font-medium text-white">Telefoon doorschakelen</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 flex items-center gap-3">
            <span className="font-mono text-base font-semibold text-workx-lime">*748</span>
            <span className="text-xs text-gray-300">Doorschakelen naar <strong className="font-medium text-white">Hanna</strong> (mobiel)</span>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 flex items-center gap-3">
            <span className="font-mono text-base font-semibold text-workx-lime">*741</span>
            <span className="text-xs text-gray-300">Doorschakelen naar de <strong className="font-medium text-white">Telefoonservice</strong></span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
            <p className="text-xs font-medium text-emerald-300 mb-1">Doorschakelen starten</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              Neem de hoorn op, toets <span className="font-mono text-white">*&lt;nummer&gt;</span> in en wacht tot je hoort:{' '}
              <em className="text-gray-200">“call forwarding activated”</em>. Hang op.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
            <p className="text-xs font-medium text-gray-200 mb-1">Doorschakelen stoppen</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              Toets <span className="font-mono text-white">&lt;nummer&gt;</span> in en wacht tot je hoort:{' '}
              <em className="text-gray-200">“call forwarding ended”</em>. Hang op.
            </p>
          </div>
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

      </>)}

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
  if (mode === 'CENTRALE') return { label: 'Opgenomen door de Telefooncentrale', danger: false }
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
                    : phone?.mode === 'CENTRALE'
                      ? 'Centrale'
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
              { id: 'CENTRALE' as PhoneMode, label: 'Telefooncentrale', desc: 'Opgenomen door de externe telefooncentrale.' },
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

// ───────── Verzoeken aan Office ─────────

interface OfficeRequestItem {
  id: string
  title: string
  description: string | null
  assigneeName: string | null
  category: string | null
  confidential: boolean
  officeReply: string | null
  officeReplyBy: string | null
  officeReplyAt: string | null
  completedAt: string | null
  completedBy: string | null
  createdAt: string
  requester: { id: string; name: string; avatarUrl: string | null; role: string }
}

interface OfficeRequestCategory {
  id: string
  name: string
  emoji: string | null
  sortOrder: number
}

function OfficeRequestsPanel({ currentUser, canManage }: { currentUser: SessionUser; canManage: boolean }) {
  const [requests, setRequests] = useState<OfficeRequestItem[]>([])
  const [categories, setCategories] = useState<OfficeRequestCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([])

  const isPartner = currentUser.role === 'PARTNER' || currentUser.role === 'ADMIN'
  const isOfficeTeam = canManage // Office team mag toewijzen + afronden + namens iemand

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/office-requests')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/office-request-categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch { /* silent */ }
  }, [])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  // Voor Office team: lijst users om namens te kunnen invoeren
  useEffect(() => {
    if (!isOfficeTeam) return
    fetch('/api/team').then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) setAllUsers(d.map((u: any) => ({ id: u.id, name: u.name })))
    }).catch(() => {})
  }, [isOfficeTeam])

  const open = requests.filter(r => !r.completedAt)
  const done = requests.filter(r => r.completedAt)
  // "Aan jou toegewezen" — voor Office team-leden eigen verantwoordelijkheid
  const isOfficeMember = OFFICE_PEOPLE.some(
    p => p.name.toLowerCase() === currentUser.name.toLowerCase(),
  )
  const myAssigned = isOfficeMember
    ? open.filter(r => r.assigneeName?.toLowerCase() === currentUser.name.toLowerCase())
    : []
  const otherOpen = isOfficeMember
    ? open.filter(r => r.assigneeName?.toLowerCase() !== currentUser.name.toLowerCase())
    : open

  return (
    <section className="space-y-6">
      {/* Header met counter + acties */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{open.length} open verzoek{open.length === 1 ? '' : 'en'}</h2>
          {done.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{done.length} afgerond (laatste 7 dagen)</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOfficeTeam && (
            <button
              onClick={() => setShowCategories(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-gray-300 text-xs font-medium hover:bg-white/[0.08] transition-colors"
            >
              <Icons.hash size={13} />
              Categorieën
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Icons.plus size={16} />
            Nieuw verzoek
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Laden…</div>
      ) : (
        <>
          {open.length === 0 && done.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/10 p-12 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-300 font-medium mb-1">Nog geen verzoeken</p>
              <p className="text-sm text-gray-500">
                Klik op &quot;Nieuw verzoek&quot; om het eerste verzoek aan Office in te dienen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Eigen toegewezen verzoeken — prominent voor Office team */}
              {isOfficeMember && myAssigned.length > 0 && (
                <>
                  <div className="rounded-xl border border-workx-lime/30 bg-workx-lime/[0.04] p-4 mb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-workx-lime/15 flex items-center justify-center">
                        <Icons.check size={14} className="text-workx-lime" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">
                        Aan jou toegewezen ({myAssigned.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {myAssigned.map(r => (
                        <RequestCard
                          key={r.id}
                          request={r}
                          canManage={isOfficeTeam}
                          isOwner={r.requester.id === currentUser.id}
                          categories={categories}
                          onChange={fetchRequests}
                        />
                      ))}
                    </div>
                  </div>
                  {otherOpen.length > 0 && (
                    <p className="text-xs uppercase tracking-[0.2em] font-medium text-gray-500 mt-6 mb-2">
                      Overige open verzoeken
                    </p>
                  )}
                </>
              )}
              {/* Groepeer overige open verzoeken per categorie */}
              {(() => {
                const groups = new Map<string, OfficeRequestItem[]>()
                for (const r of otherOpen) {
                  const cat = r.category || 'Overig'
                  if (!groups.has(cat)) groups.set(cat, [])
                  groups.get(cat)!.push(r)
                }
                // Sort categorieën op categorie-sortOrder, dan alfabetisch
                const sortOrder = new Map(categories.map(c => [c.name, c.sortOrder]))
                const emojis = new Map(categories.map(c => [c.name, c.emoji]))
                const sorted = Array.from(groups.entries()).sort((a, b) => {
                  const sa = sortOrder.get(a[0]) ?? 500
                  const sb = sortOrder.get(b[0]) ?? 500
                  return sa - sb || a[0].localeCompare(b[0])
                })
                return sorted.map(([catName, items]) => (
                  <div key={catName} className="space-y-2 mt-4 first:mt-0">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-sm">{emojis.get(catName) || '📌'}</span>
                      <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-gray-400">
                        {catName}
                      </h4>
                      <span className="text-[10px] text-gray-500 ml-1">{items.length}</span>
                      <div className="flex-1 h-px bg-white/5 ml-2" />
                    </div>
                    <div className="space-y-3">
                      {items.map(r => (
                        <RequestCard
                          key={r.id}
                          request={r}
                          canManage={isOfficeTeam}
                          isOwner={r.requester.id === currentUser.id}
                          categories={categories}
                          onChange={fetchRequests}
                        />
                      ))}
                    </div>
                  </div>
                ))
              })()}
              {done.length > 0 && (
                <>
                  <div className="pt-4 mt-4 border-t border-white/10">
                    <p className="text-xs uppercase tracking-[0.2em] font-medium text-gray-500 mb-3">Afgerond — verdwijnt na 7 dagen</p>
                  </div>
                  {done.map(r => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      canManage={isOfficeTeam}
                      isOwner={r.requester.id === currentUser.id}
                      categories={categories}
                      onChange={fetchRequests}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {showForm && (
        <NewRequestModal
          isPartner={isPartner}
          isOfficeTeam={isOfficeTeam}
          allUsers={allUsers}
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchRequests() }}
        />
      )}
      {showCategories && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategories(false)}
          onChange={() => { fetchCategories(); fetchRequests() }}
        />
      )}
    </section>
  )
}

function CategoriesModal({
  categories, onClose, onChange,
}: {
  categories: OfficeRequestCategory[]
  onClose: () => void
  onChange: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [busy, setBusy] = useState(false)

  const addCat = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/office-request-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() || undefined }),
      })
      if (res.ok) { setNewName(''); setNewEmoji(''); onChange() }
      else {
        const d = await res.json().catch(() => null)
        toast.error(d?.error || 'Kon niet toevoegen')
      }
    } finally { setBusy(false) }
  }

  const deleteCat = async (id: string, name: string) => {
    if (name === 'Overig') return toast.error('Standaard categorie "Overig" kan niet worden verwijderd')
    if (!confirm(`Categorie "${name}" verwijderen? Verzoeken in deze categorie gaan naar Overig.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/office-request-categories/${id}`, { method: 'DELETE' })
      if (res.ok) onChange()
    } finally { setBusy(false) }
  }

  const renameCat = async (id: string, currentName: string) => {
    const next = prompt('Nieuwe naam', currentName)
    if (!next || next === currentName) return
    setBusy(true)
    try {
      const res = await fetch(`/api/office-request-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next.trim() }),
      })
      if (res.ok) onChange()
      else toast.error('Kon naam niet wijzigen')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-workx-gray rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Categorieën beheren</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/5">
            <Icons.x size={18} />
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5">
              <span className="text-base w-7 text-center">{c.emoji || '📌'}</span>
              <span className="flex-1 text-sm text-white">{c.name}</span>
              <button
                onClick={() => renameCat(c.id, c.name)}
                disabled={busy || c.name === 'Overig'}
                className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30"
              >
                Hernoemen
              </button>
              <button
                onClick={() => deleteCat(c.id, c.name)}
                disabled={busy || c.name === 'Overig'}
                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                title="Verwijderen"
              >
                <Icons.trash size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-white/5 space-y-2">
          <label className="block text-[10px] uppercase tracking-widest text-gray-500">Nieuwe categorie</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value.slice(0, 4))}
              placeholder="🎨"
              maxLength={4}
              className="w-14 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-center text-sm text-white focus:outline-none focus:border-workx-lime/30"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Naam"
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
            />
            <button
              onClick={addCat}
              disabled={busy || !newName.trim()}
              className="px-3 py-2 rounded-md text-sm font-medium bg-workx-lime text-workx-dark hover:opacity-90 disabled:opacity-40"
            >
              Toevoegen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RequestCard({
  request, canManage, isOwner, categories, onChange,
}: {
  request: OfficeRequestItem
  canManage: boolean
  isOwner: boolean
  categories: OfficeRequestCategory[]
  onChange: () => void
}) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const setCategory = async (name: string) => {
    try {
      const res = await fetch(`/api/office-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: name }),
      })
      if (res.ok) { onChange(); setShowCategoryPicker(false) }
    } catch { toast.error('Kon categorie niet wijzigen') }
  }
  const currentCatEmoji = categories.find(c => c.name === request.category)?.emoji
  const [busy, setBusy] = useState(false)
  const [showAssignee, setShowAssignee] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyDraft, setReplyDraft] = useState(request.officeReply || '')
  const isDone = !!request.completedAt
  const requesterPhoto = getPhotoUrl(request.requester.name, request.requester.avatarUrl)
  const assigneePhoto = request.assigneeName ? getPhotoUrl(request.assigneeName) : null

  const toggleDone = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/office-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !isDone }),
      })
      if (res.ok) {
        toast.success(isDone ? 'Heropend' : 'Afgerond — aanvrager krijgt melding')
        onChange()
      } else toast.error('Kon status niet wijzigen')
    } finally { setBusy(false) }
  }

  const setAssignee = async (name: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/office-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeName: name }),
      })
      if (res.ok) { onChange(); setShowAssignee(false) }
      else toast.error('Kon niet toewijzen')
    } finally { setBusy(false) }
  }

  const deleteRequest = async () => {
    if (!confirm('Verzoek verwijderen?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/office-requests/${request.id}`, { method: 'DELETE' })
      if (res.ok) onChange()
    } finally { setBusy(false) }
  }

  const saveReply = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/office-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officeReply: replyDraft }),
      })
      if (res.ok) {
        toast.success(replyDraft.trim() ? 'Reactie verzonden — aanvrager krijgt melding' : 'Reactie verwijderd')
        setShowReplyForm(false)
        onChange()
      } else toast.error('Kon reactie niet opslaan')
    } finally { setBusy(false) }
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isDone
        ? 'bg-white/[0.02] border-white/5 opacity-60'
        : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.06]'
    }`}>
      <div className="flex items-start gap-3">
        {/* Requester avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
          {requesterPhoto ? (
            <Image src={requesterPhoto} alt={request.requester.name} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-gray-300">
              {request.requester.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className={`text-sm font-semibold ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}>
                {request.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {request.requester.name} · {new Date(request.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 relative">
              {request.category && (
                <button
                  onClick={() => canManage && setShowCategoryPicker(v => !v)}
                  disabled={!canManage}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-white/[0.06] text-gray-300 ${canManage ? 'hover:bg-white/[0.12] cursor-pointer' : 'cursor-default'}`}
                  title={canManage ? 'Categorie wijzigen' : ''}
                >
                  {currentCatEmoji && <span>{currentCatEmoji}</span>}
                  {request.category}
                </button>
              )}
              {!request.category && canManage && (
                <button
                  onClick={() => setShowCategoryPicker(v => !v)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.08]"
                >
                  + Categorie
                </button>
              )}
              {request.confidential && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-amber-500/10 text-amber-300">
                  <Icons.lock size={10} />
                  Vertrouwelijk
                </span>
              )}
              {showCategoryPicker && canManage && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCategoryPicker(false)} />
                  <div className="absolute right-0 top-6 z-50 min-w-[200px] rounded-lg bg-workx-dark border border-white/15 shadow-2xl py-1 max-h-64 overflow-y-auto">
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.name)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/[0.06] transition-colors ${
                          request.category === c.name ? 'text-workx-lime' : 'text-gray-300'
                        }`}
                      >
                        <span>{c.emoji || '📌'}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {request.description && !isDone && (
            <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{request.description}</p>
          )}

          {/* Office-reactie (zichtbaar voor iedereen die het verzoek mag zien) */}
          {request.officeReply && !showReplyForm && (
            <div className="mt-3 rounded-lg bg-sky-500/[0.06] border border-sky-500/20 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Icons.chat size={11} className="text-sky-300" />
                <p className="text-[10px] uppercase tracking-widest font-semibold text-sky-300">
                  Reactie van {request.officeReplyBy?.split(' ')[0] || 'Office'}
                </p>
                {canManage && !isDone && (
                  <button
                    onClick={() => { setReplyDraft(request.officeReply || ''); setShowReplyForm(true) }}
                    className="ml-auto text-[10px] text-sky-300/70 hover:text-sky-200 underline"
                  >
                    Wijzig
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{request.officeReply}</p>
            </div>
          )}

          {/* Reactie-formulier — alleen Office team, alleen op open verzoeken */}
          {canManage && !isDone && showReplyForm && (
            <div className="mt-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-sky-300 mb-1.5">
                Je reactie naar {request.requester.name.split(' ')[0]}
              </p>
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={3}
                placeholder={`Bv. 'Helaas niet mogelijk omdat...' of 'Doe ik morgenmiddag, hoor je nog!'`}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-400/30 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => { setShowReplyForm(false); setReplyDraft(request.officeReply || '') }}
                  className="px-3 py-1 rounded-md text-xs text-gray-400 hover:text-white"
                >
                  Annuleren
                </button>
                <button
                  onClick={saveReply}
                  disabled={busy}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors disabled:opacity-50"
                >
                  {replyDraft.trim() ? 'Reactie verzenden' : 'Reactie wissen'}
                </button>
              </div>
            </div>
          )}

          {/* Assignee + action row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {request.assigneeName ? (
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 text-xs">
                {assigneePhoto && (
                  <Image src={assigneePhoto} alt={request.assigneeName} width={16} height={16} className="w-4 h-4 rounded-full object-cover" />
                )}
                <span>Toegewezen aan {request.assigneeName.split(' ')[0]}</span>
              </div>
            ) : (
              canManage && !isDone && (
                <button
                  onClick={() => setShowAssignee(v => !v)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                >
                  + Toewijzen
                </button>
              )
            )}

            {showAssignee && canManage && (
              <div className="w-full flex flex-wrap gap-1.5 mt-1">
                {OFFICE_PEOPLE.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setAssignee(p.name)}
                    disabled={busy}
                    className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-workx-lime/10 hover:text-workx-lime transition-colors text-gray-300"
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1" />

            {canManage && !isDone && !request.officeReply && !showReplyForm && (
              <button
                onClick={() => { setReplyDraft(''); setShowReplyForm(true) }}
                disabled={busy}
                className="text-xs text-sky-300 hover:text-sky-200 px-2 py-1 rounded-md bg-sky-500/[0.08] hover:bg-sky-500/[0.15] transition-colors flex items-center gap-1"
              >
                <Icons.chat size={12} />
                Reageer
              </button>
            )}

            {canManage && (
              <button
                onClick={toggleDone}
                disabled={busy}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
                  isDone
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                    : 'bg-workx-lime/20 text-workx-lime hover:bg-workx-lime/30'
                }`}
              >
                {isDone ? '↺ Heropenen' : '✓ Afronden'}
              </button>
            )}
            {(canManage || isOwner) && (
              <button
                onClick={deleteRequest}
                disabled={busy}
                className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Verwijderen"
              >
                <Icons.trash size={14} />
              </button>
            )}
          </div>

          {isDone && request.completedAt && (
            <p className="text-[11px] text-gray-500 mt-2">
              Afgerond op {new Date(request.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              {request.completedBy ? ` door ${request.completedBy.split(' ')[0]}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function NewRequestModal({
  isPartner, isOfficeTeam, allUsers, currentUser, onClose, onCreated,
}: {
  isPartner: boolean
  isOfficeTeam: boolean
  allUsers: { id: string; name: string }[]
  currentUser: SessionUser
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [onBehalfOf, setOnBehalfOf] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast.error('Titel verplicht'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/office-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          confidential: isPartner && confidential,
          requesterId: isOfficeTeam && onBehalfOf ? onBehalfOf : undefined,
        }),
      })
      if (res.ok) { onCreated(); toast.success('Verzoek aangemaakt') }
      else toast.error('Kon verzoek niet opslaan')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-workx-gray rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Nieuw verzoek aan Office</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/5">
            <Icons.x size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {isOfficeTeam && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Namens (optioneel)</label>
              <select
                value={onBehalfOf}
                onChange={(e) => setOnBehalfOf(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
              >
                <option value="">Mezelf ({currentUser.name})</option>
                {allUsers.filter(u => u.id !== currentUser.id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Wat moet er gebeuren?</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bv. 'Reservering BBQ voor 12 juni'"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-widest">Toelichting (optioneel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Extra context, deadline, contactpersoon…"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30 resize-none"
            />
          </div>
          {isPartner && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confidential}
                onChange={(e) => setConfidential(e.target.checked)}
                className="mt-0.5 accent-workx-lime"
              />
              <div>
                <span className="text-sm text-white">Vertrouwelijk</span>
                <p className="text-[11px] text-gray-500">Alleen Hanna en partners zien dit verzoek.</p>
              </div>
            </label>
          )}
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-white">
            Annuleren
          </button>
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-md text-sm font-medium bg-workx-lime text-workx-dark hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Opslaan…' : 'Verzenden'}
          </button>
        </div>
      </div>
    </div>
  )
}
