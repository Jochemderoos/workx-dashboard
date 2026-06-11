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

// Sfeer-moodboard: échte Workx-team foto's. Polaroid-stijl op de pagina.
const SFEER_FOTOS = [
  '/workx-uitjes/team/PHOTO-2026-05-28-21-49-14.jpg',
  '/workx-uitjes/team/PHOTO-2026-01-24-19-02-46.jpg',
  '/workx-uitjes/team/PHOTO-2025-12-12-18-54-41.jpg',
  '/workx-uitjes/team/PHOTO-2025-12-12-09-51-59.jpg',
  '/workx-uitjes/team/PHOTO-2025-12-12-09-51-58.jpg',
  '/workx-uitjes/team/PHOTO-2025-12-12-09-51-57.jpg',
  '/workx-uitjes/team/PHOTO-2025-12-12-09-51-56.jpg',
  '/workx-uitjes/team/PHOTO-2025-09-03-11-39-00.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-31-20-36-01.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-31-20-36-00.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-31-20-35-59.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-31-12-06-46.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-29-18-40-00.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-07-18-09-42.jpg',
  '/workx-uitjes/team/PHOTO-2025-08-07-17-45-05.jpg',
  '/workx-uitjes/team/PHOTO-2025-02-28-17-32-55.jpg',
  '/workx-uitjes/team/PHOTO-2024-07-20-14-06-26.jpg',
  '/workx-uitjes/team/PHOTO-2024-07-20-14-06-17.jpg',
  '/workx-uitjes/team/PHOTO-2024-07-20-00-10-32.jpg',
  '/workx-uitjes/team/PHOTO-2024-07-19-10-21-51.jpg',
  '/workx-uitjes/team/PHOTO-2024-02-22-22-55-20.jpg',
  '/workx-uitjes/team/PHOTO-2023-12-15-15-35-27.jpg',
  '/workx-uitjes/team/PHOTO-2023-10-01-21-38-35.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-23-10-56-07.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-23-10-55-37.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-23-10-55-36.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-23-10-55-31.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-23-10-55-29.jpg',
  '/workx-uitjes/team/PHOTO-2023-07-21-16-31-03.jpg',
  '/workx-uitjes/team/PHOTO-2023-03-31-16-51-02.jpg',
  '/workx-uitjes/team/PHOTO-2022-08-08-17-39-42.jpg',
  '/workx-uitjes/team/PHOTO-2022-07-23-17-12-04.jpg',
  '/workx-uitjes/team/PHOTO-2022-07-23-17-12-03.jpg',
  '/workx-uitjes/team/PHOTO-2022-07-22-21-25-26.jpg',
  '/workx-uitjes/team/PHOTO-2022-07-22-18-13-59.jpg',
  '/workx-uitjes/team/PHOTO-2022-05-13-19-44-21.jpg',
  '/workx-uitjes/team/PHOTO-2022-05-13-15-24-17.jpg',
  '/workx-uitjes/team/PHOTO-2022-05-13-15-24-16.jpg',
  '/workx-uitjes/team/PHOTO-2022-05-13-09-36-47.jpg',
  '/workx-uitjes/team/PHOTO-2022-05-12-20-20-18.jpg',
  '/workx-uitjes/team/PHOTO-2022-04-07-20-20-41.jpg',
  '/workx-uitjes/team/PHOTO-2021-12-31-14-12-44.jpg',
  '/workx-uitjes/team/PHOTO-2021-11-06-16-25-56.jpg',
  '/workx-uitjes/team/PHOTO-2021-10-28-21-44-54.jpg',
  '/workx-uitjes/team/PHOTO-2021-07-03-11-08-41.jpg',
  '/workx-uitjes/team/PHOTO-2021-07-03-10-38-29.jpg',
  '/workx-uitjes/team/PHOTO-2021-05-12-18-01-05.jpg',
  '/workx-uitjes/team/PHOTO-2021-03-31-17-21-08.jpg',
  '/workx-uitjes/team/PHOTO-2020-01-10-17-32-09.jpg',
  '/workx-uitjes/team/PHOTO-2020-01-10-17-21-58.jpg',
  '/workx-uitjes/team/PHOTO-2019-07-18-09-43-34.jpg',
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
  // PARTNER/ADMIN/OFFICE_MANAGER mogen elk uitje aanpassen, niet alleen eigen.
  const meCanManageAll = ['PARTNER', 'ADMIN', 'OFFICE_MANAGER'].includes(
    (session?.user?.role || '') as string,
  )

  const [outings, setOutings] = useState<Outing[]>([])
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNoFotoConfirm, setShowNoFotoConfirm] = useState(false)

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
    // Zacht duwtje als er geen foto is — sfeer = opkomst. De daadwerkelijke
    // opslag gebeurt in doSubmit() (na confirm of direct als er wel een foto is).
    if (!form.imageUrl) {
      setShowNoFotoConfirm(true)
      return
    }
    await doSubmit()
  }

  const doSubmit = async () => {
    if (!form.title.trim() || !form.date) return
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
    <div className="max-w-screen-2xl mx-auto space-y-6 fade-in relative">
      {/* Sfeerblobs */}
      <div className="absolute -top-10 right-[5%] w-72 h-72 bg-rose-500/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[30%] left-[5%] w-64 h-64 bg-amber-500/6 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-[20%] w-56 h-56 bg-purple-500/8 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* HERO met mozaiek-strip */}
      <section className="max-w-6xl mx-auto relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-rose-500/15 via-amber-500/8 to-purple-500/12">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-rose-400/15 rounded-full blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-rose-300/70 mb-1">Team-uitjes ✨</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                <TextReveal>Workx uitjes</TextReveal>
              </h1>
              <p className="text-sm text-white/80 mt-2 max-w-xl leading-relaxed">
                Iedere paar maanden iets gezelligs met het team. <span className="text-white font-semibold">Bedenk samen met een kantoorgenoot iets leuks</span> — een borrel, etentje, padel-avond, suppen, bowling, theater, bierfiets… Echt alles mag. Samen organiseren is het leukst.
              </p>
            </div>

            {/* Spotlight CTA */}
            <div className="relative">
              {/* Glow halo achter de knop */}
              <div className="absolute inset-0 -m-3 bg-gradient-to-br from-rose-400/40 via-amber-400/30 to-purple-400/40 rounded-3xl blur-2xl opacity-70 animate-pulse pointer-events-none" />
              <button
                onClick={() => { setEditingId(null); resetForm(); setShowForm(true) }}
                className="relative group px-6 sm:px-8 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 border-2 border-white/30 text-white font-bold text-base sm:text-lg shadow-2xl shadow-rose-500/40 hover:shadow-rose-500/60 hover:scale-105 transition-all flex items-center gap-3"
              >
                <span className="text-2xl group-hover:rotate-12 transition-transform">🎉</span>
                <span>Plan iets leuks!</span>
                <Icons.plus size={20} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>
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
      <div className="max-w-6xl mx-auto">
        <YearOverview outings={outings} />
      </div>

      {/* Polaroid-moodboard 1 — boven 'Komt eraan' (full-width binnen page-container) */}
      <SfeerStrook fotos={SFEER_FOTOS.slice(0, 25)} />

      {/* Compact overzichtskader met alle aankomende uitjes */}
      {filter === 'upcoming' && outings.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <UpcomingOverview outings={outings} />
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <div className="max-w-6xl mx-auto">
          <OutingForm
            form={form}
            setForm={setForm}
            isEdit={!!editingId}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingId(null); resetForm() }}
          />
        </div>
      )}

      {/* Zacht-duwtje-modal bij opslaan zonder foto */}
      {showNoFotoConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowNoFotoConfirm(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-rose-300/30 bg-gradient-to-br from-rose-900/40 via-workx-dark to-amber-900/30 p-6 shadow-2xl shadow-rose-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-3 text-center">📸</div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Echt geen foto?
            </h3>
            <p className="text-sm text-white/80 text-center mb-6 leading-relaxed">
              Een foto <span className="font-semibold text-white">verhoogt de sfeer</span> en vergroot de kans op een grote opkomst! Plak gewoon een screenshot met <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl+V</kbd>.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => { setShowNoFotoConfirm(false); doSubmit() }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
              >
                Ga door zonder foto
              </button>
              <button
                onClick={() => setShowNoFotoConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-bold hover:from-rose-400 hover:to-amber-400 transition-colors shadow-lg shadow-rose-500/30"
              >
                Toch foto plakken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIJST */}
      {outings.length === 0 ? (
        <div className="max-w-6xl mx-auto rounded-2xl border-2 border-dashed border-rose-400/30 bg-gradient-to-br from-rose-500/8 via-amber-500/5 to-purple-500/8 p-8 sm:p-10 text-center">
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
        <>
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            {outings.map((o) => (
              <OutingCard
                key={o.id}
                outing={o}
                meId={meId}
                canManageAll={meCanManageAll}
                onChange={fetchOutings}
                onEdit={() => startEdit(o)}
                onDelete={() => handleDelete(o.id)}
              />
            ))}
          </div>
          {/* Polaroid-moodboard 2 — onderaan, full-width */}
          <SfeerStrook fotos={SFEER_FOTOS.slice(25)} />
        </>
      )}
    </div>
  )
}

// ── Outing card ───────────────────────────────────────────────────────────

function OutingCard({
  outing, meId, canManageAll = false, onChange, onEdit, onDelete,
}: {
  outing: Outing
  meId?: string
  canManageAll?: boolean
  onChange: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const type = TYPE_BY_KEY[outing.type] || TYPE_BY_KEY['overig']
  const myAttendance = outing.attendances.find(a => a.user.id === meId)
  const isOrganizer = outing.organizer.id === meId
  const canManage = isOrganizer || canManageAll
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
      {/* Cover — eigen foto óf typografische tile met titel + emoji.
          Geen automatische fallback-foto's meer (zoals de boot bij PARADE). */}
      <div className={`relative w-full aspect-[5/2] overflow-hidden bg-workx-dark/40 ${!outing.imageUrl ? `bg-gradient-to-br ${type.bg} via-transparent to-workx-dark` : ''}`}>
        {outing.imageUrl ? (
          <>
            <img
              src={outing.imageUrl}
              alt={outing.title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-workx-dark via-workx-dark/20 to-transparent pointer-events-none" />
          </>
        ) : (
          // Geen eigen foto → grote typografische tile, sfeervol per type.
          <div className="relative w-full h-full flex items-center justify-center px-6">
            <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none" />
            <div className="text-center relative">
              <div className="text-5xl sm:text-6xl mb-2 drop-shadow-lg">{type.emoji}</div>
              <h4 className="text-white font-bold uppercase tracking-[0.2em] text-xl sm:text-2xl leading-tight break-words drop-shadow-lg">
                {outing.title}
              </h4>
              <p className={`mt-1 text-xs font-medium uppercase tracking-widest ${type.accent}`}>
                {type.label}
              </p>
            </div>
          </div>
        )}
        {/* Emoji-badge in hoek (alleen als er een foto is — anders dubbelop) */}
        {outing.imageUrl && (
          <div className="absolute top-3 left-3 w-9 h-9 rounded-full bg-workx-dark/80 backdrop-blur flex items-center justify-center text-lg shadow-lg">
            {type.emoji}
          </div>
        )}
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
          {canManage && (
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

      {/* Grid: 1 kol mobile · 2 kol tablet · 4 kol desktop = 4×3 op breed scherm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 p-1.5">
        {MONTH_NAMES.map((_, mIdx) => {
          const monthOutings = byMonth.get(mIdx) || []
          const isCurrent = isCurrentYear && mIdx === currentMonth
          const isPast = isCurrentYear && mIdx < currentMonth
          return (
            <div
              key={mIdx}
              className={`rounded-xl p-2.5 sm:p-3 min-h-[80px] flex flex-col gap-1.5 transition-colors ${
                isCurrent
                  ? 'bg-amber-500/12 border border-amber-300/30'
                  : monthOutings.length > 0
                    ? 'bg-rose-500/8 border border-rose-300/20'
                    : 'bg-white/[0.02] border border-white/5'
              }`}
            >
              {/* Maand-label */}
              <div className={`flex items-baseline justify-between gap-2 ${isPast ? 'opacity-50' : ''}`}>
                <span className={`text-[11px] font-bold tracking-widest ${
                  isCurrent ? 'text-amber-300' : monthOutings.length > 0 ? 'text-rose-300' : 'text-white/40'
                }`}>
                  {MONTH_ABBR[mIdx]}
                </span>
                {monthOutings.length > 0 && (
                  <span className="text-[9px] text-white/40 tabular-nums">
                    {monthOutings.length}
                  </span>
                )}
              </div>

              {/* Uitjes in deze maand — gestapeld */}
              {monthOutings.length === 0 ? (
                <span className={`text-xs italic ${isPast ? 'text-white/15' : 'text-white/25'}`}>—</span>
              ) : (
                <div className="flex flex-col gap-1">
                  {monthOutings.map(o => {
                    const t = TYPE_BY_KEY[o.type] || TYPE_BY_KEY['overig']
                    const dayNum = new Date(o.date).getDate()
                    return (
                      <div
                        key={o.id}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] font-medium ${t.accent} bg-white/5 border border-white/10`}
                        title={`${o.title} · ${formatDateLong(o.date)} · ${formatTime(o.date)}${o.location ? ` · ${o.location}` : ''}`}
                      >
                        <span className="text-[9px] tabular-nums text-white/50 w-3 flex-shrink-0 text-right">{dayNum}</span>
                        <span className="flex-shrink-0">{t.emoji}</span>
                        <span className="truncate">{o.title}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Polaroid moodboard: foto's overlappen, getilt, verstrooid ────────────

function SfeerStrook({ fotos }: { fotos: string[]; compact?: boolean }) {
  if (fotos.length === 0) return null
  const tilts = ['-rotate-6', 'rotate-4', '-rotate-3', 'rotate-7', '-rotate-5', 'rotate-2', '-rotate-2', 'rotate-5', '-rotate-7', 'rotate-3', '-rotate-1']
  const vOffsets = ['mt-0', 'mt-6 sm:mt-10', 'mt-2 sm:mt-3', 'mt-8 sm:mt-12', 'mt-1', 'mt-4 sm:mt-8', 'mt-3', 'mt-7 sm:mt-9']
  const tapeColors = ['bg-amber-200/50', 'bg-rose-200/45', 'bg-sky-200/45', 'bg-emerald-200/45']

  return (
    // pointer-events-none op wrapper + auto op polaroids: clicks op zwarte
    // tussenruimte gaan door naar de sidebar zodat die volledig bruikbaar
    // blijft. Geen negative margins meer — de page-container is nu breed
    // genoeg zelf (max-w-screen-2xl op page-root).
    <div className="pointer-events-none">
      <div className="flex flex-wrap items-start justify-center gap-0 py-6 px-2 sm:px-6 lg:px-10">
        {fotos.map((src, i) => {
          const tilt = tilts[i % tilts.length]
          const vOff = vOffsets[i % vOffsets.length]
          const tape = tapeColors[i % tapeColors.length]
          const overlap = i === 0 ? '' : '-ml-4 sm:-ml-8'
          return (
            <div
              key={src + i}
              style={{ zIndex: 10 + i }}
              // hover:!z-[100] gebruikt !important zodat het inline-style z-index overrulet —
              // anders blijft een vroege polaroid bij hover achter een latere liggen.
              // pointer-events-auto: alleen de polaroid zelf vangt muis, niet de wrapper.
              className={`relative pointer-events-auto w-32 sm:w-40 md:w-48 bg-white p-2.5 pb-10 sm:pb-12 rounded-sm shadow-2xl shadow-black/50 ${tilt} ${vOff} ${overlap} hover:rotate-0 hover:scale-[2.2] hover:!z-[100] hover:shadow-2xl hover:shadow-black/80 transition-all duration-700 ease-out cursor-pointer`}
            >
              <div className="aspect-square overflow-hidden bg-workx-dark/20">
                <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
              {/* Plakband bovenaan */}
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3.5 ${tape} rounded-sm rotate-2 shadow-sm`} />
            </div>
          )
        })}
      </div>
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

  // Plak-support: zolang er nog geen cover staat, vangen we Ctrl/Cmd+V op
  // window-niveau zodat je gewoon een screenshot kunt plakken zonder eerst
  // ergens te focussen.
  useEffect(() => {
    if (currentUrl || uploading) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleFile(file)
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // handleFile is stable enough — we re-bind alleen op state-veranderingen die echt nodig zijn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, uploading])

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
        <>
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
                <Icons.upload size={14} /> Klik om te uploaden of plak met <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-mono text-[10px]">Ctrl+V</kbd>
              </>
            )}
          </button>
          <p className="text-[11px] text-rose-200/80 mt-2 leading-snug">
            ✨ Wil je <span className="font-semibold">echt</span> geen foto plakken? Dat verhoogt de sfeer en vergroot de kans op een grote opkomst!
          </p>
        </>
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
