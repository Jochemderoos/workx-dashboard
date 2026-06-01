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

const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr']
const MONTHS_NL_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const STATUS_CONFIG: Record<Status, {
  label: string
  short: string
  emoji: string
  bg: string
  text: string
  ring: string
}> = {
  OFFICE: { label: 'Op kantoor', short: 'Kantoor', emoji: '🏢', bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/40' },
  REMOTE: { label: 'Remote', short: 'Remote', emoji: '🏠', bg: 'bg-blue-500/15', text: 'text-blue-300', ring: 'ring-blue-500/40' },
  ABSENT: { label: 'Afwezig', short: 'Vrij', emoji: '🌴', bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/40' },
}

// Get Monday of current week (in local time), midnight
function getCurrentMonday(): Date {
  const now = new Date()
  const day = now.getDay() // 0=zo, 1=ma, ... 6=za
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
  // YYYY-MM-DD in local time
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateBadge(d: Date): { day: number; month: string; weekday: string } {
  return {
    day: d.getDate(),
    month: MONTHS_NL_SHORT[d.getMonth()],
    weekday: DAYS_NL[(d.getDay() + 6) % 7],
  }
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
  const [weekOffset, setWeekOffset] = useState(0) // 0 = deze + volgende week
  const [editMode, setEditMode] = useState(false)
  const [phoneEditFor, setPhoneEditFor] = useState<string | null>(null) // date-string

  // Load profile
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) setUser(await res.json())
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  // Compute current 2-week range (workdays only displayed but range covers full weeks)
  const range = useMemo(() => {
    const start = addDays(getCurrentMonday(), weekOffset * 7)
    const end = addDays(start, 13) // 2 weken (Ma..Zo van week 2)
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

  // Fetch data
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

  // Lookup
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

  // Who's on office on a given date
  const onOfficeNames = useCallback((d: Date): string[] => {
    const dateKey = isoDateOnly(d)
    return OFFICE_PEOPLE
      .filter(p => lookup.get(`${p.key}|${dateKey}`)?.status === 'OFFICE')
      .map(p => p.name.split(' ')[0])
  }, [lookup])

  // Cycle status: OFFICE → REMOTE → ABSENT → (delete)
  const cycleStatus = async (personKey: string, date: Date, current: Status | null) => {
    const dateStr = isoDateOnly(date)
    const next: Record<Status, Status> = { OFFICE: 'REMOTE', REMOTE: 'ABSENT', ABSENT: 'OFFICE' }
    let newStatus: Status | null
    if (!current) newStatus = 'OFFICE'
    else if (current === 'ABSENT') newStatus = null // remove
    else newStatus = next[current]

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

  // Week split: workdays[0..4] is week 1, workdays[5..9] is week 2
  const week1 = workdays.slice(0, 5)
  const week2 = workdays.slice(5, 10)

  // Today's overview
  const todayOnOffice = onOfficeNames(today)

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-7xl mx-auto relative">
      {/* Decorative */}
      <div className="absolute top-0 right-[10%] w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-64 h-64 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/10 flex items-center justify-center">
            <Icons.building className="text-emerald-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white"><TextReveal>Office</TextReveal></h1>
            <p className="text-sm text-gray-400">
              Wie van de back office is wanneer op kantoor of remote — en hoe de kantoortelefoon wordt opgevangen.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => setEditMode(v => !v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              editMode
                ? 'bg-workx-lime text-workx-dark shadow-lg shadow-workx-lime/20'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Icons.edit size={14} />
            {editMode ? 'Klaar met bewerken' : 'Bewerken'}
          </button>
        )}
      </div>

      {/* Today highlight */}
      <div className="card p-5 relative overflow-hidden border-workx-lime/20">
        <div className="absolute top-0 right-0 w-48 h-48 bg-workx-lime/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>Vandaag</p>
            <p className="text-lg font-semibold text-white">
              {today.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-2">
            {OFFICE_PEOPLE.map(p => {
              const entry = lookup.get(`${p.key}|${isoDateOnly(today)}`)
              const status = entry?.status as Status | undefined
              const cfg = status ? STATUS_CONFIG[status] : null
              const photo = getPhotoUrl(p.name)
              return (
                <div
                  key={p.key}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs ${cfg ? cfg.bg + ' ' + cfg.text : 'bg-white/5 text-gray-500'}`}
                  title={p.name + (status ? ' — ' + STATUS_CONFIG[status].label : ' — geen status')}
                >
                  <div className={`relative w-6 h-6 rounded-full overflow-hidden bg-white/10 ring-1 ${cfg?.ring || 'ring-white/10'}`}>
                    {photo ? (
                      <Image src={photo} alt={p.name} fill className="object-cover" sizes="24px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">{p.name.charAt(0)}</div>
                    )}
                  </div>
                  <span className="font-medium">{p.name.split(' ')[0]}</span>
                  {cfg && <span>{cfg.emoji}</span>}
                </div>
              )
            })}
          </div>
          <PhoneBadge
            date={today}
            phone={phoneLookup.get(isoDateOnly(today))}
            onOffice={todayOnOffice}
            big
          />
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 2)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10"
            aria-label="Vorige 2 weken"
          >
            <Icons.chevronLeft size={16} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-2 rounded-lg bg-workx-lime/10 text-workx-lime text-sm font-medium hover:bg-workx-lime/20 transition-all"
            >
              Naar deze week
            </button>
          )}
          <button
            onClick={() => setWeekOffset(o => o + 2)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10"
            aria-label="Volgende 2 weken"
          >
            <Icons.chevronRight size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-400">
          {range.start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} — {addDays(range.start, 11).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <WeekMatrix
            label={weekOffset === 0 ? 'Deze week' : `Week 1`}
            days={week1}
            today={today}
            lookup={lookup}
            phoneLookup={phoneLookup}
            editMode={editMode && canEdit}
            onCycle={cycleStatus}
            onPhoneEdit={(d) => setPhoneEditFor(isoDateOnly(d))}
            onOfficeNames={onOfficeNames}
          />
          <WeekMatrix
            label={weekOffset === 0 ? 'Volgende week' : `Week 2`}
            days={week2}
            today={today}
            lookup={lookup}
            phoneLookup={phoneLookup}
            editMode={editMode && canEdit}
            onCycle={cycleStatus}
            onPhoneEdit={(d) => setPhoneEditFor(isoDateOnly(d))}
            onOfficeNames={onOfficeNames}
          />
        </>
      )}

      {/* Legend + edit hint */}
      <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="text-gray-500 uppercase tracking-wider font-semibold">Legenda</span>
        {(['OFFICE', 'REMOTE', 'ABSENT'] as Status[]).map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <span key={s} className={`flex items-center gap-1.5 ${cfg.text}`}>
              <span>{cfg.emoji}</span>
              {cfg.label}
            </span>
          )
        })}
        {canEdit && (
          <span className="text-gray-500 ml-auto">
            {editMode ? 'Klik op een cel om door OFFICE → REMOTE → AFWEZIG → leeg te cyclen.' : 'Zet "Bewerken" aan om aan te passen.'}
          </span>
        )}
      </div>

      {/* Phone-edit popover (modal) */}
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

      {/* Info card */}
      <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 relative">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icons.info className="text-blue-400" size={16} />
          </div>
          <div className="text-sm text-gray-400">
            <p className="text-white font-medium mb-1">Hoe werkt het?</p>
            <p className="mb-2">
              Hanna (Head of Office) houdt het schema bij — Lotte en Bente kunnen ook bewerken.
              De kantoortelefoon-regeling staat standaard op <strong>automatisch</strong>: wie op kantoor is, neemt op.
              Als niemand op kantoor is wordt het rood gemarkeerd en kun je instellen waar de telefoon naartoe gaat.
            </p>
            <p>
              <strong>Tip</strong>: combineer dit met de <a href="/dashboard/appjeplekje" className="text-workx-lime underline">Appjeplekje</a>-pagina om ook werkplekken te reserveren.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────── Phone badge ─────────────────────────────────────

function PhoneBadge({
  date,
  phone,
  onOffice,
  big,
}: {
  date: Date
  phone?: PhoneDay
  onOffice: string[]
  big?: boolean
}) {
  const mode: PhoneMode = phone?.mode || 'AUTO'
  const hasNoOffice = onOffice.length === 0

  let text: string
  let icon: string
  let danger = false

  if (mode === 'FORWARD' && phone?.forwardTo) {
    text = `Doorgeschakeld → ${phone.forwardTo}`
    icon = '📞'
  } else if (mode === 'COVER' && phone?.coverBy) {
    text = `Opgenomen door ${phone.coverBy}`
    icon = '☎️'
  } else if (mode === 'AUTO' && !hasNoOffice) {
    text = `Opgenomen door ${onOffice.join(', ')}`
    icon = '☎️'
  } else {
    text = 'Niemand op kantoor — telefoon-regeling nog niet ingesteld'
    icon = '⚠️'
    danger = true
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
        danger
          ? 'bg-red-500/15 text-red-300 border border-red-500/30'
          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
      } ${big ? 'min-w-0 sm:min-w-[280px]' : ''}`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-xs font-medium truncate">{text}</span>
    </div>
  )
}

// ───────── Week matrix ─────────────────────────────────────

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
  label,
  days,
  today,
  lookup,
  phoneLookup,
  editMode,
  onCycle,
  onPhoneEdit,
  onOfficeNames,
}: WeekMatrixProps) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icons.calendar size={14} className="text-workx-lime" />
          {label}
        </h2>
        <p className="text-xs text-gray-500">
          {days[0]?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} —{' '}
          {days[days.length - 1]?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-gray-500 font-semibold w-44">
                Office team
              </th>
              {days.map(d => {
                const isToday = isSameDay(d, today)
                const b = formatDateBadge(d)
                return (
                  <th key={d.toISOString()} className={`text-center py-3 px-2 ${isToday ? 'bg-workx-lime/10' : ''}`}>
                    <div className={`text-[10px] uppercase tracking-wider font-semibold ${isToday ? 'text-workx-lime' : 'text-gray-500'}`}>
                      {b.weekday}
                    </div>
                    <div className={`text-base font-semibold mt-0.5 ${isToday ? 'text-workx-lime' : 'text-white'}`}>
                      {b.day} <span className="text-xs font-normal text-gray-500">{b.month}</span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {OFFICE_PEOPLE.map((p, idx) => {
              const photo = getPhotoUrl(p.name)
              return (
                <tr key={p.key} className={idx % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 ring-2 ring-white/5">
                        {photo ? (
                          <Image src={photo} alt={p.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-300">
                            {p.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{p.role}</p>
                      </div>
                    </div>
                  </td>
                  {days.map(d => {
                    const entry = lookup.get(`${p.key}|${isoDateOnly(d)}`)
                    const status = entry?.status as Status | undefined
                    const cfg = status ? STATUS_CONFIG[status] : null
                    const isToday = isSameDay(d, today)
                    return (
                      <td key={d.toISOString()} className={`py-2 px-2 text-center ${isToday ? 'bg-workx-lime/[0.05]' : ''}`}>
                        <button
                          onClick={() => editMode && onCycle(p.key, d, status ?? null)}
                          disabled={!editMode}
                          className={`w-full max-w-[80px] mx-auto px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                            cfg ? `${cfg.bg} ${cfg.text} hover:brightness-125` : 'bg-white/5 text-gray-600 hover:bg-white/10'
                          } ${editMode ? 'cursor-pointer ring-1 ring-white/10' : 'cursor-default'}`}
                        >
                          {cfg ? (
                            <>
                              <span>{cfg.emoji}</span>
                              <span className="hidden lg:inline">{cfg.short}</span>
                            </>
                          ) : (
                            <span className="text-base">·</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Phone row */}
            <tr className="border-t border-white/5 bg-white/[0.02]">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-base">📞</div>
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
                const mode: PhoneMode = phone?.mode || 'AUTO'
                let label: string
                let danger = false
                if (mode === 'FORWARD' && phone?.forwardTo) label = `→ ${phone.forwardTo}`
                else if (mode === 'COVER' && phone?.coverBy) label = phone.coverBy
                else if (mode === 'AUTO' && onOfficeList.length > 0) label = onOfficeList.join(', ')
                else { label = 'Niemand'; danger = true }
                const isToday = isSameDay(d, today)
                return (
                  <td key={d.toISOString()} className={`py-2 px-2 text-center ${isToday ? 'bg-workx-lime/[0.05]' : ''}`}>
                    <button
                      onClick={() => editMode && onPhoneEdit(d)}
                      disabled={!editMode}
                      className={`w-full max-w-[100px] mx-auto px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all truncate ${
                        danger
                          ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
                          : 'bg-emerald-500/10 text-emerald-300'
                      } ${editMode ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                      title={label}
                    >
                      {label}
                    </button>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────── Phone edit modal ────────────────────────────────

function PhoneEditModal({
  date,
  current,
  onOfficeNames,
  onClose,
  onSave,
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
      <div className="relative w-full max-w-md bg-workx-gray rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-workx-lime">Kantoortelefoon</p>
            <h3 className="text-base font-semibold text-white capitalize">
              {date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <Icons.x size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Mode picker */}
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
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selected
                      ? 'bg-workx-lime/10 border-workx-lime/40 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{o.label}</span>
                    {selected && <Icons.check size={14} className="text-workx-lime" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
                </button>
              )
            })}
          </div>

          {/* Input field */}
          {mode === 'COVER' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Opgenomen door</label>
              <input
                type="text"
                value={coverBy}
                onChange={(e) => setCoverBy(e.target.value)}
                placeholder="Bv. Lotte (vanuit huis) / extern"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
                autoFocus
              />
            </div>
          )}
          {mode === 'FORWARD' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Doorschakelen naar</label>
              <input
                type="text"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder="Bv. 06-12345678 of partner-naam"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notitie (optioneel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bv. 'tot 13u doorgeschakeld'"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-workx-lime/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (mode === 'FORWARD' && !forwardTo.trim()) || (mode === 'COVER' && !coverBy.trim())}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
