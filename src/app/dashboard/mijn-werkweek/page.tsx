'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  previousIntake: Intake | null
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

  const [updateMessage, setUpdateMessage] = useState('')
  const [sendingUpdate, setSendingUpdate] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/week-intake/current')
      if (!res.ok) throw new Error()
      const d: CurrentResponse = await res.json()
      setData(d)
      // Standaard blijft je lijst staan: heb je nog geen eigen lijst voor deze
      // week, dan vullen we 'm vast met die van afgelopen week (met de optie om
      // 'm leeg te maken voor een schone start).
      const src = d.intake ?? d.previousIntake
      setWork(src?.work || '')
      setAvailability(src?.availability || '')
      setNotes(src?.notes || '')
    } catch {
      toast.error('Kon je werkweek niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveIntake = async (silent = false) => {
    if (!work.trim()) {
      if (!silent) toast.error('Vul minimaal "wat heb je liggen" in')
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
        if (!silent) toast.error('Het invul-venster is gesloten')
        load()
        return
      }
      if (!res.ok) throw new Error()
      const saved = await res.json()
      setData(prev => prev ? { ...prev, intake: saved } : prev)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2500)
      if (!silent) toast.success('Opgeslagen — partners zien je input bij het werkverdelingsgesprek')
    } catch {
      if (!silent) toast.error('Kon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  // Maak de lijst leeg voor een schone start (verwijdert ook de opgeslagen lijst
  // van deze week, indien aanwezig).
  const clearForm = async () => {
    if (
      (work.trim() || availability.trim() || notes.trim()) &&
      !confirm('Lijst leegmaken en met een schone lijst beginnen?')
    ) return
    setWork('')
    setAvailability('')
    setNotes('')
    if (data?.intake) {
      try {
        await fetch('/api/week-intake/current', { method: 'DELETE' })
        setData(prev => prev ? { ...prev, intake: null } : prev)
      } catch { /* stil */ }
    }
    toast.success('Schone lijst — vul je werkweek opnieuw in')
  }

  // Automatisch opslaan (debounced) terwijl je typt, zolang het venster open is.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!data || !work.trim()) return
    const cur = data.intake
    const prev = data.previousIntake
    // Ongewijzigde, overgenomen lijst van vorige week: nog niet automatisch
    // opslaan — zo blijft "Leeg maken" schoon en maken we geen stille kopie.
    if (!cur && prev
      && work === (prev.work || '')
      && availability === (prev.availability || '')
      && notes === (prev.notes || '')) return
    const changed = !cur
      || work !== (cur.work || '')
      || availability !== (cur.availability || '')
      || notes !== (cur.notes || '')
    if (!changed) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { void saveIntake(true) }, 1500)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work, availability, notes, data])

  // Wezenlijke wijziging melden aan de partners (werkt ook buiten het invul-venster)
  const sendUpdate = async () => {
    if (!updateMessage.trim()) { toast.error('Beschrijf eerst kort wat er is gewijzigd'); return }
    setSendingUpdate(true)
    try {
      const r = await fetch('/api/week-intake/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: updateMessage }),
      })
      if (!r.ok) throw new Error()
      setUpdateMessage('')
      setShowUpdateModal(false)
      toast.success('Wijziging gemeld — de partners krijgen een Slack- en dashboard-melding')
    } catch {
      toast.error('Kon de melding niet versturen')
    } finally {
      setSendingUpdate(false)
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

  // Toont de (ongewijzigde) overgenomen lijst van vorige week — nog niet als
  // eigen lijst voor deze week opgeslagen.
  const prevIntake = data.previousIntake
  const isCarryOver = !data.intake && !!prevIntake
    && work === (prevIntake.work || '')
    && availability === (prevIntake.availability || '')
    && notes === (prevIntake.notes || '')

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
            Houd bij wat je op je bord hebt — je kunt het doorlopend bijwerken. Partners gebruiken dit bij het werkverdelingsgesprek.
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-semibold">
                  <Icons.edit size={11} />
                  Altijd bij te werken
                </span>
                <p className="text-[11px] text-gray-500 mt-1">
                  Volgend invul-venster opent {formatDateTime(data.windowOpenAt)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hint: je lijst van afgelopen week staat alvast ingevuld */}
      {isCarryOver && (
        <div className="card p-3 border border-blue-500/20 bg-blue-500/5 flex items-start gap-2 text-sm">
          <Icons.clock size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <span className="text-blue-200">
            Dit is je lijst van <strong>afgelopen week</strong> ({formatLong(prevIntake!.weekStartDate)}) — die staat alvast ingevuld. Pas &apos;m aan, of klik <strong>Leeg maken</strong> voor een schone start.
          </span>
        </div>
      )}

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
          placeholder="Bv. Procedure X (deadline donderdag), advies Klant Y, twee zittingen…"        />

        <Field
          label="Welke dagen ben je afwezig?"
          icon="🌴"
          hint="Vakantie, vrije dag, externe afspraak — of leeg laten."
          value={availability}
          onChange={setAvailability}
          rows={2}
          placeholder="Bv. Woensdag vrij / dinsdagmiddag rechtbank"        />

        <Field
          label="Heb je ruimte voor extra werk? Bijzonderheden?"
          icon="💬"
          hint="Zit je krap, of juist wat ruimte? Iets dat we als partners moeten weten?"
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder="Bv. Zit krap deze week, liever geen nieuwe zaken. Of: kan er nog wat bij."        />

        {/* Save button */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          <p className="text-xs text-gray-500">
            {savedAt
              ? <span className="text-emerald-400 flex items-center gap-1"><Icons.check size={12} /> Opgeslagen</span>
              : saving
                ? <span className="text-gray-400">Bezig met opslaan…</span>
                : isCarryOver
                  ? <span className="text-blue-300">Lijst van afgelopen week — pas aan of bevestig met Opslaan</span>
                  : dirty || hasUnsavedNew
                    ? <span className="text-amber-400">Wordt automatisch opgeslagen…</span>
                    : data.intake
                      ? 'Automatisch opgeslagen'
                      : 'Nog niet ingevuld voor deze week'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={clearForm}
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5"
              title="Begin met een lege lijst"
            >
              <Icons.trash size={14} /> Leeg maken
            </button>
            <button
              onClick={() => setShowUpdateModal(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-all flex items-center gap-2"
              title="Melding sturen aan partners bij een wezenlijke wijziging"
            >
              🔄 Wijziging melden
            </button>
            <button
              onClick={() => saveIntake()}
              disabled={saving || !work.trim()}
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

      {/* Modal: wezenlijke wijziging melden aan partners */}
      {showUpdateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { if (!sendingUpdate) setShowUpdateModal(false) }}
        >
          <div
            className="bg-workx-gray rounded-2xl border border-white/10 w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-lg flex-shrink-0">🔄</div>
              <div>
                <h2 className="text-lg font-semibold text-white">Wijziging melden aan partners</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Beschrijf kort en duidelijk wat er is veranderd, zodat het voor ons helder is. De partners krijgen een Slack-bericht in <strong>MT-Groot</strong> én een melding op hun dashboard.
                </p>
              </div>
            </div>
            <textarea
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Bv. Woensdag toch volgelopen met een spoedzaak — donderdag juist ruimte erbij."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowUpdateModal(false)}
                disabled={sendingUpdate}
                className="px-4 py-2 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition-all disabled:opacity-40"
              >
                Annuleren
              </button>
              <button
                onClick={sendUpdate}
                disabled={sendingUpdate || !updateMessage.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingUpdate ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Icons.send size={14} /> Versturen</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
