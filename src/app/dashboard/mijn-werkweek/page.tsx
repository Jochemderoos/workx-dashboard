'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import TextReveal from '@/components/ui/TextReveal'

interface Intake {
  id: string
  weekStartDate: string
  work: string
  availability: string | null
  notes: string | null
  submittedAt: string | null
  updatedAt: string
}

interface CurrentResponse {
  intake: Intake | null
  targetWeekStart: string
  windowOpenAt: string
  windowCloseAt: string
  isOpen: boolean
}

function formatLong(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export default function MijnWerkweekPage() {
  const [data, setData] = useState<CurrentResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [work, setWork] = useState('')
  const [availability, setAvailability] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/week-intake/current')
      if (!res.ok) throw new Error()
      const d: CurrentResponse = await res.json()
      setData(d)
      setWork(d.intake?.work || '')
      setAvailability(d.intake?.availability || '')
      setNotes(d.intake?.notes || '')
    } catch {
      toast.error('Kon je werkweek niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!work.trim()) {
      toast.error('Vul minimaal "wat heb je liggen" in')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/week-intake/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work, availability, notes }),
      })
      if (res.status === 409) {
        toast.error('Het invul-venster is gesloten')
        load()
        return
      }
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setData(prev => prev ? { ...prev, intake: saved } : prev)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
      toast.success('Opgeslagen — partners zien je input bij het werkverdelingsgesprek')
    } catch {
      toast.error('Kon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span className="text-gray-400">Laden…</span>
        </div>
      </div>
    )
  }

  const dirty = !!data.intake && (
    work !== (data.intake.work || '') ||
    availability !== (data.intake.availability || '') ||
    notes !== (data.intake.notes || '')
  )
  const hasUnsavedNew = !data.intake && (work.trim() || availability.trim() || notes.trim())

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-3xl mx-auto relative">
      <div className="absolute top-0 right-[10%] w-96 h-96 bg-workx-lime/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-64 h-64 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 relative">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-emerald-500/10 flex items-center justify-center">
          <Icons.briefcase className="text-workx-lime" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white"><TextReveal>Mijn werkweek</TextReveal></h1>
          <p className="text-sm text-gray-400">
            Vul vóór maandag 10:00 in wat je deze week op je bord hebt. Partners gebruiken dit bij het werkverdelingsgesprek.
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`card p-5 relative overflow-hidden border ${
        data.isOpen ? 'border-workx-lime/30' : 'border-amber-500/30'
      }`}>
        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          data.isOpen ? 'bg-workx-lime/10' : 'bg-amber-500/10'
        }`} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${
              data.isOpen ? 'text-workx-lime' : 'text-amber-300'
            }`}>
              Week
            </p>
            <p className="text-lg font-semibold text-white capitalize">
              {formatLong(data.targetWeekStart)} — {formatLong(addDays(data.targetWeekStart, 4))}
            </p>
          </div>
          <div className="text-right">
            {data.isOpen ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Open tot {formatDateTime(data.windowCloseAt)}
                </span>
                {data.intake?.submittedAt && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Laatst opgeslagen {formatDateTime(data.intake.submittedAt)}
                  </p>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold">
                  <Icons.lock size={11} />
                  Gesloten
                </span>
                <p className="text-[11px] text-gray-500 mt-1">
                  Volgende invul-venster opent {formatDateTime(data.windowOpenAt)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card p-6 space-y-5 relative">
        <Field
          label="Wat heb je liggen deze week?"
          icon="📋"
          hint="Korte opsomming van dossiers, deadlines, klanten — wat ligt er op je bord?"
          value={work}
          onChange={setWork}
          rows={4}
          required
          placeholder="Bv. Procedure X (deadline donderdag), advies Klant Y, twee zittingen…"
          disabled={!data.isOpen}
        />

        <Field
          label="Welke dagen ben je afwezig?"
          icon="🌴"
          hint="Vakantie, vrije dag, externe afspraak — of leeg laten."
          value={availability}
          onChange={setAvailability}
          rows={2}
          placeholder="Bv. Woensdag vrij / dinsdagmiddag rechtbank"
          disabled={!data.isOpen}
        />

        <Field
          label="Heb je ruimte voor extra werk? Bijzonderheden?"
          icon="💬"
          hint="Zit je krap, of juist wat ruimte? Iets dat we als partners moeten weten?"
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder="Bv. Zit krap deze week, liever geen nieuwe zaken. Of: kan er nog wat bij."
          disabled={!data.isOpen}
        />

        {/* Save button */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          <p className="text-xs text-gray-500">
            {savedAt
              ? <span className="text-emerald-400 flex items-center gap-1"><Icons.check size={12} /> Opgeslagen</span>
              : dirty || hasUnsavedNew
                ? <span className="text-amber-400">Niet-opgeslagen wijzigingen</span>
                : data.intake
                  ? 'Alles up-to-date'
                  : 'Nog niet ingevuld voor deze week'}
          </p>
          <button
            onClick={handleSave}
            disabled={!data.isOpen || saving || !work.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Icons.save size={14} /> Opslaan</>
            )}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="card p-5 bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 relative">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icons.info className="text-blue-400" size={16} />
          </div>
          <div className="text-sm text-gray-400">
            <p className="text-white font-medium mb-1">Wanneer invullen?</p>
            <p>
              Het invul-venster opent <strong>donderdag 15:00</strong> en sluit <strong>maandag 10:00</strong>.
              Vrijdags niet werkende collega's kunnen dus al donderdagmiddag invullen voor de week erna.
              Maandagochtend krijg je nog een Slack-reminder.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, icon, hint, value, onChange, rows, placeholder, required, disabled,
}: {
  label: string
  icon: string
  hint: string
  value: string
  onChange: (v: string) => void
  rows: number
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-white mb-1">
        <span className="text-base">{icon}</span>
        {label}
        {required && <span className="text-rose-400 text-xs">*</span>}
      </label>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-workx-lime/30 focus:ring-1 focus:ring-workx-lime/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}
