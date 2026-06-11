'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
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
  | 'bowling'
  | 'padel'
  | 'bierfiets'
  | 'rollerdisco'
  | 'overig'

// ── Constants ─────────────────────────────────────────────────────────────

// Sfeer-presets: visueel inspiratie + cover-foto per vibe. Geen "categorie"
// — gewoon een leuke foto die past bij het idee. User kan ook gewoon zelf
// invullen en de eerste foto kiezen.
const TYPES: { key: OutingType; label: string; emoji: string; color: string; bg: string; ring: string; accent: string; defaultImage: string }[] = [
  { key: 'borrel-kantoor', label: 'Borrel op kantoor', emoji: '🍻', color: 'amber',   bg: 'from-amber-500/20 via-yellow-500/10',     ring: 'ring-amber-500/30',   accent: 'text-amber-300',    defaultImage: '/workx-uitjes/borrel-elders.jpg' },
  { key: 'borrel-elders',  label: 'Terras-borrel',     emoji: '🍹', color: 'rose',    bg: 'from-rose-500/20 via-pink-500/10',        ring: 'ring-rose-500/30',    accent: 'text-rose-300',     defaultImage: '/workx-uitjes/borrel-elders.jpg' },
  { key: 'etentje',        label: 'Etentje',           emoji: '🍝', color: 'orange',  bg: 'from-orange-500/20 via-red-500/10',       ring: 'ring-orange-500/30',  accent: 'text-orange-300',   defaultImage: '/workx-uitjes/etentje.avif' },
  { key: 'film',           label: 'Film',              emoji: '🎬', color: 'indigo',  bg: 'from-indigo-500/20 via-violet-500/10',    ring: 'ring-indigo-500/30',  accent: 'text-indigo-300',   defaultImage: '/workx-uitjes/film.jpg' },
  { key: 'suppen',         label: 'Suppen',            emoji: '🏄', color: 'cyan',    bg: 'from-cyan-500/20 via-sky-500/10',         ring: 'ring-cyan-500/30',    accent: 'text-cyan-300',     defaultImage: '/workx-uitjes/suppen.jpg' },
  { key: 'jeu-de-boules',  label: 'Jeu de boules',     emoji: '🎯', color: 'emerald', bg: 'from-emerald-500/20 via-green-500/10',    ring: 'ring-emerald-500/30', accent: 'text-emerald-300',  defaultImage: '/workx-uitjes/jeu-de-boules.jpg' },
  { key: 'opera',          label: 'Opera',             emoji: '🎭', color: 'purple',  bg: 'from-purple-500/20 via-fuchsia-500/10',   ring: 'ring-purple-500/30',  accent: 'text-purple-300',   defaultImage: '/workx-uitjes/theater.jpg' },
  { key: 'voorstelling',   label: 'Voorstelling',      emoji: '🎤', color: 'fuchsia', bg: 'from-fuchsia-500/20 via-pink-500/10',     ring: 'ring-fuchsia-500/30', accent: 'text-fuchsia-300',  defaultImage: '/workx-uitjes/theater.jpg' },
  { key: 'bowling',        label: 'Bowling',           emoji: '🎳', color: 'red',     bg: 'from-red-500/20 via-rose-500/10',         ring: 'ring-red-500/30',     accent: 'text-red-300',      defaultImage: '/workx-uitjes/bowling.webp' },
  { key: 'padel',          label: 'Padel',             emoji: '🎾', color: 'lime',    bg: 'from-lime-500/20 via-emerald-500/10',     ring: 'ring-lime-500/30',    accent: 'text-lime-300',     defaultImage: '/workx-uitjes/padel.jpg' },
  { key: 'bierfiets',      label: 'Bierfiets',         emoji: '🍺', color: 'orange',  bg: 'from-orange-500/25 via-amber-500/15',     ring: 'ring-orange-500/40',  accent: 'text-orange-200',   defaultImage: '/workx-uitjes/bierfiets.jpg' },
  { key: 'rollerdisco',    label: 'Rollerdisco',       emoji: '🛼', color: 'pink',    bg: 'from-pink-500/20 via-fuchsia-500/10',     ring: 'ring-pink-500/30',    accent: 'text-pink-300',     defaultImage: '/workx-uitjes/rollerdisco.webp' },
  { key: 'overig',         label: 'Iets anders',       emoji: '✨', color: 'workx-lime', bg: 'from-workx-lime/20 via-yellow-300/10', ring: 'ring-workx-lime/30',  accent: 'text-workx-lime',   defaultImage: '/workx-uitjes/boot.jpg' },
]

const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]))

// Sfeer-collage onder de hero — alle 11 unieke foto's, geen tekst.
const SFEER_FOTOS = [
  '/workx-uitjes/bowling.webp',
  '/workx-uitjes/padel.jpg',
  '/workx-uitjes/bierfiets.jpg',
  '/workx-uitjes/rollerdisco.webp',
  '/workx-uitjes/film.jpg',
  '/workx-uitjes/theater.jpg',
  '/workx-uitjes/jeu-de-boules.jpg',
  '/workx-uitjes/suppen.jpg',
  '/workx-uitjes/borrel-elders.jpg',
  '/workx-uitjes/etentje.avif',
  '/workx-uitjes/boot.jpg',
]

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
    type: 'overig' as OutingType,
    date: null as Date | null,
    time: '17:00',
    location: '',
    description: '',
    imageUrl: '',
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
      imageUrl: form.imageUrl,
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
    title: '', type: 'overig', date: null, time: '17:00', location: '', description: '', imageUrl: '',
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
      imageUrl: o.imageUrl || '',
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

      {/* HERO met mozaiek-strip */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-rose-500/15 via-amber-500/8 to-purple-500/12">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-rose-400/15 rounded-full blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-300/70 mb-1">Team-uitjes ✨</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                <TextReveal>Workx uitjes</TextReveal>
              </h1>
              <p className="text-sm text-white/80 mt-2 max-w-xl leading-relaxed">
                Iedere paar maanden iets gezelligs met het team. <span className="text-white font-semibold">Bedenk samen met een kantoorgenoot iets leuks</span> — een borrel, etentje, padel-avond, suppen, bowling, theater, bierfiets… Echt alles mag. Samen organiseren is het leukst.
              </p>
            </div>
            <button
              onClick={() => { setEditingId(null); resetForm(); setShowForm(true) }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500/30 to-amber-500/30 border border-rose-300/40 text-white font-semibold text-sm hover:from-rose-500/40 hover:to-amber-500/40 transition-colors flex items-center gap-2 shadow-lg shadow-rose-500/10"
            >
              <Icons.plus size={14} /> Plan iets leuks
            </button>
          </div>

          {/* Budget-tip */}
          <div className="mt-4 rounded-xl bg-workx-dark/40 backdrop-blur border border-amber-300/30 px-3 py-2 flex items-center gap-2 text-xs">
            <span className="text-base">💸</span>
            <p className="text-amber-100/90">
              <span className="font-semibold">Stem het budget even af met Hanna</span> voordat je iets vastlegt — dan weet zij ook wat eraan komt.
            </p>
          </div>

          {/* Filter-pills */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
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
        </div>

      </section>

      {/* JAAROVERZICHT: 12 maanden verticaal met geplande uitjes per maand */}
      <YearOverview outings={outings} />

      {/* Sfeer-strook 1 — 3 horizontale foto's tussen kalender en lijst */}
      <SfeerStrook fotos={SFEER_FOTOS.slice(0, 3)} />

      {/* Compact overzichtskader met alle aankomende uitjes */}
      {filter === 'upcoming' && outings.length > 0 && (
        <UpcomingOverview outings={outings} />
      )}

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
        <div className="rounded-2xl border-2 border-dashed border-rose-400/30 bg-gradient-to-br from-rose-500/8 via-amber-500/5 to-purple-500/8 p-8 sm:p-10 text-center">
          <div className="text-6xl mb-3 animate-pulse">{filter === 'upcoming' ? '🎉' : '📷'}</div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {filter === 'upcoming' ? 'Verzin iets met een collega' : 'Nog geen herinneringen hier'}
          </h3>
          <p className="text-sm text-white/70 max-w-md mx-auto mb-4">
            {filter === 'upcoming'
              ? 'Pak je favoriete kantoorgenoot, kies hierboven een vibe of bedenk iets compleet anders. Hoe gekker, hoe leuker.'
              : 'Zodra er uitjes zijn geweest verschijnen ze hier.'
            }
          </p>
          {filter === 'upcoming' && (
            <button
              onClick={() => { setEditingId(null); resetForm(); setShowForm(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500/40 to-amber-500/40 border border-rose-300/50 text-white font-semibold text-sm hover:from-rose-500/50 hover:to-amber-500/50 transition-colors shadow-lg shadow-rose-500/20"
            >
              <Icons.plus size={14} /> Plan iets leuks
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {outings.map((o, idx) => (
            <Fragment key={o.id}>
              <OutingCard
                outing={o}
                meId={meId}
                onChange={fetchOutings}
                onEdit={() => startEdit(o)}
                onDelete={() => handleDelete(o.id)}
              />
              {/* Sfeerfoto's verspreid: na elke 2e card een strookje */}
              {(idx + 1) % 2 === 0 && idx < outings.length - 1 && (
                <SfeerStrook
                  fotos={SFEER_FOTOS.slice(((idx / 2) * 2 + 3) % SFEER_FOTOS.length, ((idx / 2) * 2 + 3) % SFEER_FOTOS.length + 2)}
                  compact
                />
              )}
            </Fragment>
          ))}
          {/* Afsluit-strookje met de overgebleven foto's */}
          <SfeerStrook fotos={SFEER_FOTOS.slice(5)} />
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
    <div className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${type.bg} to-transparent ${type.ring.replace('ring-', 'border-')} shadow-lg hover:shadow-xl transition-shadow`}>
      {/* Cover-foto — aspect-ratio fix zodat upload niet uitgerekt wordt.
          object-cover crop'pet centraal; ratio past op de meeste foto's. */}
      <div className="relative w-full aspect-[16/9] overflow-hidden bg-workx-dark/40">
        <img
          src={outing.imageUrl || type.defaultImage}
          alt={outing.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-workx-dark via-workx-dark/20 to-transparent pointer-events-none" />
        {/* Emoji-badge in hoek */}
        <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-workx-dark/80 backdrop-blur flex items-center justify-center text-xl shadow-lg">
          {type.emoji}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Header: titel */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white">{outing.title}</h3>
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
  form: { title: string; type: OutingType; date: Date | null; time: string; location: string; description: string; imageUrl: string }
  setForm: React.Dispatch<React.SetStateAction<{ title: string; type: OutingType; date: Date | null; time: string; location: string; description: string; imageUrl: string }>>
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

      {/* Titel */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Wat ga je doen?</label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={`Bijv. "Padel-avond" / "Etentje bij Pollux" / "Bowling"`}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-rose-400/50 focus:outline-none placeholder:text-white/30"
          autoFocus
        />
      </div>

      {/* Foto-upload (optioneel) */}
      <CoverImageUpload
        currentUrl={form.imageUrl}
        onUploaded={(url) => setForm(f => ({ ...f, imageUrl: url }))}
        onClear={() => setForm(f => ({ ...f, imageUrl: '' }))}
      />

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

// ── Jaaroverzicht (verticaal JAN-DEC) ────────────────────────────────────

const MONTH_NAMES = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
const MONTH_ABBR  = ['JAN','FEB','MRT','APR','MEI','JUN','JUL','AUG','SEP','OKT','NOV','DEC']

function YearOverview({ outings }: { outings: Outing[] }) {
  const [yearOffset, setYearOffset] = useState(0)
  const targetYear = new Date().getFullYear() + yearOffset
  const currentMonth = new Date().getMonth()
  const isCurrentYear = yearOffset === 0

  // Groepeer uitjes per maand (alleen in targetYear)
  const byMonth = useMemo(() => {
    const map = new Map<number, Outing[]>()
    for (const o of outings) {
      const d = new Date(o.date)
      if (d.getFullYear() !== targetYear) continue
      const m = d.getMonth()
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(o)
    }
    // Sorteer per maand op datum
    map.forEach(list => list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
    return map
  }, [outings, targetYear])

  const totalInYear = Array.from(byMonth.values()).reduce((s, l) => s + l.length, 0)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/8 to-rose-500/8">
        <div className="flex items-center gap-2">
          <Icons.calendar className="text-amber-300" size={16} />
          <h2 className="text-sm font-semibold text-white tabular-nums">Jaar {targetYear}</h2>
          <span className="text-[10px] uppercase tracking-wider text-white/40 tabular-nums">
            {totalInYear} {totalInYear === 1 ? 'uitje' : 'uitjes'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYearOffset(o => o - 1)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center transition-colors"
            title="Vorig jaar"
          >
            ‹
          </button>
          <button
            onClick={() => setYearOffset(0)}
            disabled={yearOffset === 0}
            className="px-2.5 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[11px] flex items-center transition-colors disabled:opacity-40"
          >
            nu
          </button>
          <button
            onClick={() => setYearOffset(o => o + 1)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center transition-colors"
            title="Volgend jaar"
          >
            ›
          </button>
        </div>
      </div>

      <ul className="divide-y divide-white/5">
        {MONTH_NAMES.map((_, mIdx) => {
          const monthOutings = byMonth.get(mIdx) || []
          const isCurrent = isCurrentYear && mIdx === currentMonth
          const isPast = isCurrentYear && mIdx < currentMonth
          return (
            <li
              key={mIdx}
              className={`flex items-stretch gap-3 px-4 sm:px-5 py-2.5 sm:py-3 transition-colors ${
                isCurrent
                  ? 'bg-amber-500/8'
                  : monthOutings.length > 0
                    ? 'bg-rose-500/5'
                    : ''
              }`}
            >
              {/* Maand-label */}
              <div className={`flex-shrink-0 w-10 sm:w-12 flex flex-col items-start justify-center ${isPast ? 'opacity-40' : ''}`}>
                <span className={`text-[10px] sm:text-xs font-bold tracking-widest tabular-nums ${
                  isCurrent ? 'text-amber-300' : monthOutings.length > 0 ? 'text-rose-300' : 'text-white/40'
                }`}>
                  {MONTH_ABBR[mIdx]}
                </span>
              </div>

              {/* Uitjes in deze maand */}
              <div className="flex-1 min-w-0 flex items-center">
                {monthOutings.length === 0 ? (
                  <span className={`text-xs italic ${isPast ? 'text-white/20' : 'text-white/30'}`}>—</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {monthOutings.map(o => {
                      const t = TYPE_BY_KEY[o.type] || TYPE_BY_KEY['overig']
                      const dayNum = new Date(o.date).getDate()
                      return (
                        <span
                          key={o.id}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${t.accent} bg-white/5 border border-white/10`}
                          title={`${o.title} · ${formatDateLong(o.date)} · ${formatTime(o.date)}${o.location ? ` · ${o.location}` : ''}`}
                        >
                          <span className="text-[10px] tabular-nums text-white/50">{dayNum}</span>
                          <span>{t.emoji}</span>
                          <span className="truncate max-w-[180px]">{o.title}</span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Sfeerfoto-strook (horizontale rij om verdeeld te plaatsen) ───────────

function SfeerStrook({ fotos, compact = false }: { fotos: string[]; compact?: boolean }) {
  if (fotos.length === 0) return null
  return (
    <div
      className={`grid gap-2 rounded-2xl overflow-hidden ${
        fotos.length === 1 ? 'grid-cols-1' : fotos.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
      }`}
    >
      {fotos.map((src) => (
        <div key={src} className={`rounded-2xl overflow-hidden ${compact ? 'h-28 sm:h-32' : 'h-40 sm:h-48'}`}>
          <img
            src={src}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500"
          />
        </div>
      ))}
    </div>
  )
}

// ── Overzichtskader met alle aankomende uitjes ───────────────────────────

function UpcomingOverview({ outings }: { outings: Outing[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-gradient-to-r from-amber-500/8 to-rose-500/8">
        <Icons.calendar className="text-amber-300" size={16} />
        <h2 className="text-sm font-semibold text-white">Komt eraan</h2>
        <span className="text-[10px] uppercase tracking-wider text-white/40 tabular-nums">
          {outings.length} {outings.length === 1 ? 'uitje' : 'uitjes'}
        </span>
      </div>
      <ul className="divide-y divide-white/5">
        {outings.map(o => {
          const type = TYPE_BY_KEY[o.type] || TYPE_BY_KEY['overig']
          const days = daysFromNow(o.date)
          const totalAttendees = o.attendances.reduce((s, a) => s + 1 + (a.plusOnes || 0), 0)
          return (
            <li key={o.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
              <span className="text-xl flex-shrink-0">{type.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{o.title}</p>
                <p className="text-[11px] text-white/50 truncate">
                  {formatDateLong(o.date)} · {formatTime(o.date)}
                  {o.location && ` · ${o.location}`}
                  {' · '}
                  <span className="text-white/40">door {o.organizer.name.split(' ')[0]}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                {days >= 0 && days <= 30 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums ${
                    days <= 2 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-white/50'
                  }`}>
                    {days === 0 ? 'vandaag' : days === 1 ? 'morgen' : `over ${days}d`}
                  </span>
                )}
                <span className="text-[11px] text-white/60 tabular-nums">
                  {totalAttendees === 0 ? '–' : `${totalAttendees}×`}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Cover-foto upload (Vercel Blob, client-side) ─────────────────────────

function CoverImageUpload({
  currentUrl, onUploaded, onClear,
}: {
  currentUrl: string
  onUploaded: (url: string) => void
  onClear: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Alleen afbeeldingen')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Max 4 MB')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/workx-outings/upload-cover', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      onUploaded(url)
      toast.success('Foto geüpload')
    } catch (err) {
      console.error(err)
      toast.error('Upload mislukt')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">Eigen foto (optioneel)</label>
      {currentUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[16/9] bg-workx-dark/40">
          <img src={currentUrl} alt="" className="w-full h-full object-cover object-center" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-workx-dark/80 backdrop-blur flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"
            title="Verwijderen"
          >
            <Icons.x size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full px-3 py-3 rounded-xl bg-white/5 border-2 border-dashed border-white/15 text-white/60 text-sm hover:bg-white/10 hover:border-rose-300/30 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploaden…
            </>
          ) : (
            <>
              <Icons.upload size={14} /> Voeg een foto toe
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        className="hidden"
      />
    </div>
  )
}
