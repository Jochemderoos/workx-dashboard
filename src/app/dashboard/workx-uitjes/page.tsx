'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import LabelDropdown from '@/components/ui/LabelDropdown'
import TextReveal from '@/components/ui/TextReveal'
import { formatDateForAPI } from '@/lib/date-utils'
import { getPhotoUrl } from '@/lib/team-photos'

// ── Types ─────────────────────────────────────────────────────────────────

interface Attendance {
  id: string
  plusOnes: number
  response: 'in' | 'misschien'
  note: string | null
  user: { id: string; name: string; avatarUrl: string | null }
}

interface Outing {
  id: string
  title: string
  type: OutingType
  date: string
  location: string | null
  description: string | null
  imageUrl: string | null
  organizer: { id: string; name: string; avatarUrl: string | null }
  attendances: Attendance[]
}

type OutingType =
  | 'borrel-kantoor'
  | 'borrel-elders'
  | 'etentje'
  | 'film'
  | 'suppen'
  | 'jeu-de-boules'
  | 'opera'
  | 'voorstelling'
  | 'overig'

// ── Constants ─────────────────────────────────────────────────────────────

const TYPES: { key: OutingType; label: string; emoji: string; color: string; bg: string; ring: string; accent: string }[] = [
  { key: 'borrel-kantoor', label: 'Borrel op kantoor', emoji: '🍻', color: 'amber',   bg: 'from-amber-500/20 via-yellow-500/10',     ring: 'ring-amber-500/30',   accent: 'text-amber-300' },
  { key: 'borrel-elders',  label: 'Borrel elders',     emoji: '🍹', color: 'rose',    bg: 'from-rose-500/20 via-pink-500/10',        ring: 'ring-rose-500/30',    accent: 'text-rose-300' },
  { key: 'etentje',        label: 'Etentje',           emoji: '🍝', color: 'orange',  bg: 'from-orange-500/20 via-red-500/10',       ring: 'ring-orange-500/30',  accent: 'text-orange-300' },
  { key: 'film',           label: 'Film',              emoji: '🎬', color: 'indigo',  bg: 'from-indigo-500/20 via-violet-500/10',    ring: 'ring-indigo-500/30',  accent: 'text-indigo-300' },
  { key: 'suppen',         label: 'Suppen',            emoji: '🏄', color: 'cyan',    bg: 'from-cyan-500/20 via-sky-500/10',         ring: 'ring-cyan-500/30',    accent: 'text-cyan-300' },
  { key: 'jeu-de-boules',  label: 'Jeu de boules',     emoji: '🎯', color: 'emerald', bg: 'from-emerald-500/20 via-green-500/10',    ring: 'ring-emerald-500/30', accent: 'text-emerald-300' },
  { key: 'opera',          label: 'Opera',             emoji: '🎭', color: 'purple',  bg: 'from-purple-500/20 via-fuchsia-500/10',   ring: 'ring-purple-500/30',  accent: 'text-purple-300' },
  { key: 'voorstelling',   label: 'Voorstelling',      emoji: '🎤', color: 'fuchsia', bg: 'from-fuchsia-500/20 via-pink-500/10',     ring: 'ring-fuchsia-500/30', accent: 'text-fuchsia-300' },
  { key: 'overig',         label: 'Overig',            emoji: '✨', color: 'workx-lime', bg: 'from-workx-lime/20 via-yellow-300/10', ring: 'ring-workx-lime/30',  accent: 'text-workx-lime' },
]

const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]))

const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

const daysFromNow = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

// ── Pagina ────────────────────────────────────────────────────────────────

export default function WorkxUitjesPage() {
  const { data: session } = useSession()
  const meId = session?.user?.id

  const [outings, setOutings] = useState<Outing[]>([])
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    type: 'borrel-kantoor' as OutingType,
    date: null as Date | null,
    time: '17:00',
    location: '',
    description: '',
  })

  // Fetch
  const fetchOutings = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/workx-outings?filter=${filter}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOutings(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Kon uitjes niet laden')
    } finally {
      setIsLoading(false)
    }
  }, [filter])
  useEffect(() => { fetchOutings() }, [fetchOutings])

  // Submit nieuw / edit
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) {
      toast.error('Titel en datum zijn verplicht')
      return
    }
    const [h, m] = form.time.split(':').map(Number)
    const dt = new Date(form.date)
    dt.setHours(h || 17, m || 0, 0, 0)
    const body = {
      title: form.title,
      type: form.type,
      date: dt.toISOString(),
      location: form.location,
      description: form.description,
    }
    try {
      const url = editingId ? '/api/workx-outings' : '/api/workx-outings'
      const method = editingId ? 'PATCH' : 'POST'
      const payload = editingId ? { ...body, id: editingId } : body
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editingId ? 'Bijgewerkt' : 'Uitje gepland — Slack-bericht verstuurd 🎉')
      setShowForm(false)
      setEditingId(null)
      resetForm()
      fetchOutings()
    } catch {
      toast.error('Opslaan mislukt')
    }
  }

  const resetForm = () => setForm({
    title: '', type: 'borrel-kantoor', date: null, time: '17:00', location: '', description: '',
  })

  const startEdit = (o: Outing) => {
    setEditingId(o.id)
    setShowForm(true)
    setForm({
      title: o.title,
      type: o.type,
      date: new Date(o.date),
      time: formatTime(o.date),
      location: o.location || '',
      description: o.description || '',
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Dit uitje verwijderen?')) return
    try {
      const res = await fetch(`/api/workx-outings?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Verwijderd')
      fetchOutings()
    } catch {
      toast.error('Verwijderen mislukt')
    }
  }

  const totalUpcoming = useMemo(() => outings.length, [outings])

  if (isLoading) {
    return <div className="card p-10 text-center text-white/50">Workx uitjes laden…</div>
  }

  return (
    <div className="max-w-6xl space-y-6 fade-in relative">
      {/* Sfeerblobs */}
      <div className="absolute -top-10 right-[5%] w-72 h-72 bg-rose-500/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[30%] left-[5%] w-64 h-64 bg-amber-500/6 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-[20%] w-56 h-56 bg-purple-500/8 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-rose-500/15 via-amber-500/8 to-purple-500/12 p-6 sm:p-8">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-rose-400/15 rounded-full blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-rose-300/70 mb-1">Team-uitjes ✨</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              <TextReveal>Workx uitjes</TextReveal>
            </h1>
            <p className="text-sm text-white/70 mt-2 max-w-lg">
              Elke twee maanden iets leuks plannen — borrel, etentje, film, suppen, jeu de boules, opera, voorstelling… verzin maar. Schrijf je in en neem gerust iemand mee.
            </p>
          </div>
          <button
            onClick={() => { setEditingId(null); resetForm(); setShowForm(true) }}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500/30 to-amber-500/30 border border-rose-300/40 text-white font-semibold text-sm hover:from-rose-500/40 hover:to-amber-500/40 transition-colors flex items-center gap-2 shadow-lg shadow-rose-500/10"
          >
            <Icons.plus size={14} /> Uitje plannen
          </button>
        </div>

        {/* Filter-pills */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-white text-workx-dark'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Aankomend {filter === 'upcoming' && `(${totalUpcoming})`}
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'past'
                ? 'bg-white text-workx-dark'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Geweest
          </button>
        </div>
      </section>

      {/* FORM */}
      {showForm && (
        <OutingForm
          form={form}
          setForm={setForm}
          isEdit={!!editingId}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingId(null); resetForm() }}
        />
      )}

      {/* LIJST */}
      {outings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <div className="text-5xl mb-2">{filter === 'upcoming' ? '🎉' : '📷'}</div>
          <p className="text-white/60">
            {filter === 'upcoming' ? 'Nog geen uitjes gepland. Plan er één!' : 'Geen uitjes uit het verleden gevonden.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {outings.map(o => (
            <OutingCard
              key={o.id}
              outing={o}
              meId={meId}
              onChange={fetchOutings}
              onEdit={() => startEdit(o)}
              onDelete={() => handleDelete(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Outing card ───────────────────────────────────────────────────────────

function OutingCard({
  outing, meId, onChange, onEdit, onDelete,
}: {
  outing: Outing
  meId?: string
  onChange: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const type = TYPE_BY_KEY[outing.type] || TYPE_BY_KEY['overig']
  const myAttendance = outing.attendances.find(a => a.user.id === meId)
  const isOrganizer = outing.organizer.id === meId
  const days = daysFromNow(outing.date)

  const [busy, setBusy] = useState(false)
  const [showPlusOnes, setShowPlusOnes] = useState(false)

  const totalAttendees = useMemo(() =>
    outing.attendances.reduce((sum, a) => sum + 1 + (a.plusOnes || 0), 0),
  [outing.attendances])

  const inAttendees = outing.attendances.filter(a => a.response === 'in')
  const misschienAttendees = outing.attendances.filter(a => a.response === 'misschien')

  const toggleAttend = async (response: 'in' | 'misschien', plusOnes = myAttendance?.plusOnes || 0) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/workx-outings/${outing.id}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, plusOnes }),
      })
      if (!res.ok) throw new Error()
      onChange()
    } catch {
      toast.error('Kon niet opslaan')
    } finally {
      setBusy(false)
    }
  }

  const cancelAttend = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/workx-outings/${outing.id}/attend`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onChange()
      setShowPlusOnes(false)
    } catch {
      toast.error('Kon niet uitschrijven')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${type.bg} to-transparent ${type.ring.replace('ring-', 'border-')} shadow-lg`}>
      {/* Optionele cover-foto */}
      {outing.imageUrl && (
        <div className="relative w-full h-32 overflow-hidden">
          <img src={outing.imageUrl} alt={outing.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-workx-dark via-workx-dark/40 to-transparent" />
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header: titel + type-emoji */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`text-3xl shrink-0 ${type.accent}`}>{type.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white">{outing.title}</h3>
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${type.accent}`}>
                {type.label}
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5 capitalize">
              {formatDateLong(outing.date)} · {formatTime(outing.date)}
              {outing.location && ` · ${outing.location}`}
            </p>
            {days >= 0 && days <= 30 && (
              <p className={`text-[11px] mt-1 font-medium ${days <= 2 ? 'text-amber-300' : 'text-white/50'}`}>
                {days === 0 ? '🔥 Vandaag!' : days === 1 ? 'Morgen' : `Over ${days} dagen`}
              </p>
            )}
          </div>
          {isOrganizer && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Bewerken"
              >
                <Icons.edit size={12} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Verwijderen"
              >
                <Icons.trash size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Beschrijving */}
        {outing.description && (
          <p className="text-sm text-white/75 whitespace-pre-wrap mb-3">{outing.description}</p>
        )}

        {/* Organisator */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
          {getPhotoUrl(outing.organizer.name) ? (
            <Image src={getPhotoUrl(outing.organizer.name)!} alt={outing.organizer.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold text-white">
              {outing.organizer.name.charAt(0)}
            </div>
          )}
          <span className="text-xs text-white/60">
            Georganiseerd door <span className="text-white font-medium">{outing.organizer.name}</span>
          </span>
        </div>

        {/* Aanwezigen */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-white/50">Wie is erbij?</p>
            <span className="text-xs text-white/70 tabular-nums">
              {totalAttendees} {totalAttendees === 1 ? 'persoon' : 'mensen'}
              {misschienAttendees.length > 0 && ` · ${misschienAttendees.length} misschien`}
            </span>
          </div>
          {inAttendees.length === 0 && misschienAttendees.length === 0 ? (
            <p className="text-xs text-white/30 italic">Nog niemand. Wees de eerste!</p>
          ) : (
            <div className="flex items-center gap-1 flex-wrap">
              {inAttendees.map(a => (
                <AttendeeAvatar key={a.id} attendance={a} mode="in" />
              ))}
              {misschienAttendees.map(a => (
                <AttendeeAvatar key={a.id} attendance={a} mode="misschien" />
              ))}
            </div>
          )}
        </div>

        {/* Inschrijf-knoppen */}
        {!showPlusOnes ? (
          <div className="flex items-center gap-2 flex-wrap">
            {myAttendance?.response === 'in' ? (
              <>
                <button
                  onClick={() => setShowPlusOnes(true)}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-emerald-500/25 border border-emerald-300/40 text-emerald-100 text-sm font-semibold hover:bg-emerald-500/35 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Icons.check size={12} /> Je bent erbij
                  {myAttendance.plusOnes > 0 && <span className="text-[10px] opacity-75">+{myAttendance.plusOnes}</span>}
                </button>
                <button
                  onClick={cancelAttend}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  Toch niet
                </button>
              </>
            ) : myAttendance?.response === 'misschien' ? (
              <>
                <button
                  onClick={() => toggleAttend('in', 0)}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-emerald-500/25 border border-emerald-300/40 text-emerald-100 text-sm font-semibold hover:bg-emerald-500/35 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  Ik ben erbij!
                </button>
                <button
                  onClick={cancelAttend}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  Verwijder
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => toggleAttend('in', 0)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-emerald-500/20 border border-emerald-300/40 text-emerald-50 text-sm font-bold hover:from-emerald-500/40 hover:to-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  <Icons.check size={14} /> Ik ben erbij!
                </button>
                <button
                  onClick={() => toggleAttend('misschien')}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  Misschien
                </button>
              </>
            )}
          </div>
        ) : (
          <PlusOnesPicker
            value={myAttendance?.plusOnes || 0}
            onSave={(n) => { toggleAttend('in', n); setShowPlusOnes(false) }}
            onCancel={() => setShowPlusOnes(false)}
          />
        )}
      </div>
    </div>
  )
}

function AttendeeAvatar({ attendance, mode }: { attendance: Attendance; mode: 'in' | 'misschien' }) {
  const photo = getPhotoUrl(attendance.user.name)
  const ringColor = mode === 'in' ? 'ring-emerald-400/40' : 'ring-amber-300/30'
  const opacity = mode === 'in' ? '' : 'opacity-60'
  return (
    <div className={`flex items-center gap-1 ${opacity}`} title={`${attendance.user.name}${attendance.plusOnes > 0 ? ` +${attendance.plusOnes}` : ''}${attendance.response === 'misschien' ? ' (misschien)' : ''}`}>
      <div className={`relative w-7 h-7 rounded-full ring-2 ${ringColor} overflow-hidden bg-white/10`}>
        {photo ? (
          <Image src={photo} alt={attendance.user.name} width={28} height={28} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">
            {attendance.user.name.charAt(0)}
          </div>
        )}
        {attendance.plusOnes > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-workx-lime text-workx-dark text-[9px] font-bold rounded-full px-1 leading-tight tabular-nums border border-workx-dark">
            +{attendance.plusOnes}
          </span>
        )}
      </div>
    </div>
  )
}

function PlusOnesPicker({ value, onSave, onCancel }: { value: number; onSave: (n: number) => void; onCancel: () => void }) {
  const [n, setN] = useState(value)
  return (
    <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 space-y-2">
      <p className="text-xs text-emerald-100 font-medium">Iemand meenemen?</p>
      <div className="flex items-center gap-1 flex-wrap">
        {[0, 1, 2, 3, 4].map(opt => (
          <button
            key={opt}
            onClick={() => setN(opt)}
            className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
              n === opt
                ? 'bg-emerald-400/30 text-emerald-50 border border-emerald-300/50'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            {opt === 0 ? '–' : `+${opt}`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(n)}
          className="px-3 py-1.5 rounded-lg bg-emerald-400/30 text-emerald-50 text-xs font-semibold border border-emerald-300/50 hover:bg-emerald-400/40 transition-colors"
        >
          Opslaan
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

// ── Outing form ───────────────────────────────────────────────────────────

function OutingForm({
  form, setForm, isEdit, onSubmit, onCancel,
}: {
  form: { title: string; type: OutingType; date: Date | null; time: string; location: string; description: string }
  setForm: React.Dispatch<React.SetStateAction<{ title: string; type: OutingType; date: Date | null; time: string; location: string; description: string }>>
  isEdit: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">
          {isEdit ? 'Uitje bewerken' : '✨ Nieuw uitje'}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white">
          <Icons.x size={14} />
        </button>
      </div>

      {/* Type-pills */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">Type</label>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t.key }))}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                form.type === t.key
                  ? `${t.accent} bg-white/10 border-current`
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Titel */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Titel</label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={`Bijv. "Borrel bij ${TYPE_BY_KEY[form.type]?.label.toLowerCase()}"`}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-rose-400/50 focus:outline-none placeholder:text-white/30"
          autoFocus
        />
      </div>

      {/* Datum + tijd */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Datum</label>
          <DatePicker
            selected={form.date}
            onChange={d => setForm(f => ({ ...f, date: d }))}
            placeholder="Kies datum"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Tijd</label>
          <input
            type="time"
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-rose-400/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Locatie */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Locatie</label>
        <input
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="Optioneel — kantoor / café-naam / restaurant"
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-rose-400/50 focus:outline-none placeholder:text-white/30"
        />
      </div>

      {/* Beschrijving */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Beschrijving</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Praktische info, dresscode, kosten…"
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-rose-400/50 focus:outline-none placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="flex items-center gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-colors"
        >
          Annuleren
        </button>
        <button
          onClick={onSubmit}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500/30 to-amber-500/30 border border-rose-300/40 text-white text-sm font-semibold hover:from-rose-500/40 hover:to-amber-500/40 transition-colors flex items-center gap-2 shadow-lg shadow-rose-500/10"
        >
          {isEdit ? 'Opslaan' : '🎉 Uitje plannen'}
        </button>
      </div>
    </section>
  )
}
