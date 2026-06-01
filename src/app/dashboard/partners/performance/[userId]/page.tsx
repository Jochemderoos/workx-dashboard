'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import TextReveal from '@/components/ui/TextReveal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getPhotoUrl } from '@/lib/team-photos'

interface Note {
  id: string
  userId: string
  authorId: string
  noteDate: string
  sentiment: 'POSITIVE' | 'NEGATIVE'
  content: string
  discussed: boolean
  discussedAt: string | null
  createdAt: string
  author: { id: string; name: string }
}

interface TargetUser {
  id: string
  name: string
  role: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PerformanceDetailPage() {
  const params = useParams<{ userId: string }>()
  const router = useRouter()
  const userId = params.userId

  const [user, setUser] = useState<TargetUser | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // New-note form
  const [newContent, setNewContent] = useState('')
  const [newSentiment, setNewSentiment] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE')
  const [newDate, setNewDate] = useState<Date>(new Date())
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [editSentiment, setEditSentiment] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE')

  // Delete
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  // Filter
  const [tab, setTab] = useState<'all' | 'open' | 'positive' | 'negative'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/performance/${userId}`)
      if (res.status === 403) {
        setErrorMsg('Je hebt geen toegang tot deze pagina.')
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUser(data.user)
      setNotes(data.notes)
    } catch {
      toast.error('Kon notities niet laden')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const content = newContent.trim()
    if (!content) {
      toast.error('Schrijf eerst iets')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/performance/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          sentiment: newSentiment,
          noteDate: newDate.toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNewContent('')
      setNewSentiment('POSITIVE')
      setNewDate(new Date())
      toast.success('Genoteerd')
    } catch {
      toast.error('Kon niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (n: Note) => {
    setEditingId(n.id)
    setEditContent(n.content)
    setEditDate(new Date(n.noteDate))
    setEditSentiment(n.sentiment)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditDate(null)
  }

  const handleSaveEdit = async (id: string) => {
    const trimmed = editContent.trim()
    if (!trimmed) {
      toast.error('Inhoud mag niet leeg zijn')
      return
    }
    try {
      const res = await fetch(`/api/performance/${userId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          sentiment: editSentiment,
          noteDate: editDate?.toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
      cancelEdit()
      toast.success('Bijgewerkt')
    } catch {
      toast.error('Kon niet bijwerken')
    }
  }

  const handleToggleDiscussed = async (n: Note) => {
    try {
      const res = await fetch(`/api/performance/${userId}/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discussed: !n.discussed }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setNotes(prev => prev.map(x => x.id === n.id ? updated : x))
    } catch {
      toast.error('Kon niet bijwerken')
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      const res = await fetch(`/api/performance/${userId}/${pendingDelete}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setNotes(prev => prev.filter(n => n.id !== pendingDelete))
      toast.success('Verwijderd')
    } catch {
      toast.error('Kon niet verwijderen')
    } finally {
      setPendingDelete(null)
    }
  }

  const stats = useMemo(() => {
    const total = notes.length
    const positive = notes.filter(n => n.sentiment === 'POSITIVE').length
    const negative = notes.filter(n => n.sentiment === 'NEGATIVE').length
    const open = notes.filter(n => !n.discussed).length
    return { total, positive, negative, open }
  }, [notes])

  const visibleNotes = useMemo(() => {
    if (tab === 'open') return notes.filter(n => !n.discussed)
    if (tab === 'positive') return notes.filter(n => n.sentiment === 'POSITIVE')
    if (tab === 'negative') return notes.filter(n => n.sentiment === 'NEGATIVE')
    return notes
  }, [notes, tab])

  if (errorMsg) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icons.lock className="text-red-400" size={28} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Geen toegang</h2>
          <p className="text-sm text-gray-400">{errorMsg}</p>
          <Link href="/dashboard/partners/performance" className="text-workx-lime text-sm mt-4 inline-block hover:underline">← Terug naar overzicht</Link>
        </div>
      </div>
    )
  }

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <span className="text-gray-400">Laden…</span>
        </div>
      </div>
    )
  }

  const photo = getPhotoUrl(user.name)

  return (
    <div className="space-y-6 fade-in p-4 sm:p-6 max-w-4xl mx-auto relative">
      <div className="absolute top-0 right-[10%] w-96 h-96 bg-workx-lime/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Back link */}
      <Link
        href="/dashboard/partners/performance"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-workx-lime transition-colors"
      >
        <Icons.chevronLeft size={14} />
        Terug naar overzicht
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 relative">
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0 ring-2 ring-workx-lime/30 shadow-lg shadow-workx-lime/10">
          {photo ? (
            <Image src={photo} alt={user.name} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-gray-300">
              {user.name.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white"><TextReveal>{user.name}</TextReveal></h1>
          <p className="text-sm text-gray-400">
            Performance-notities ·{' '}
            <span className="text-emerald-400">{stats.positive} positief</span> ·{' '}
            <span className="text-rose-400">{stats.negative} kritisch</span>
            {stats.open > 0 && <> · <span className="text-amber-400">{stats.open} nog niet besproken</span></>}
          </p>
        </div>
      </div>

      {/* Quick add */}
      <div className="card p-5 border-workx-lime/20 relative">
        <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: 'rgb(140, 150, 30)' }}>
          Nieuwe observatie
        </p>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setNewSentiment('POSITIVE')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              newSentiment === 'POSITIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <span>👍</span> Positief
          </button>
          <button
            onClick={() => setNewSentiment('NEGATIVE')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              newSentiment === 'NEGATIVE'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-500/10'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <span>👎</span> Kritisch
          </button>
        </div>

        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          placeholder="Wat viel je op? Bv. 'Sterk geschreven advies aan klant X — heldere structuur, snelle levering.'"
          className={`w-full rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none transition-all border ${
            newSentiment === 'POSITIVE'
              ? 'bg-emerald-500/5 border-emerald-500/20 focus:border-emerald-500/50'
              : 'bg-rose-500/5 border-rose-500/20 focus:border-rose-500/50'
          }`}
        />

        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Datum:</span>
            <div className="w-44">
              <DatePicker
                selected={newDate}
                onChange={(d) => d && setNewDate(d)}
                dateFormat="d MMM yyyy"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: newContent.trim() ? 'rgb(249, 255, 133)' : 'rgba(255,255,255,0.05)',
              color: newContent.trim() ? 'rgb(45, 45, 45)' : 'rgb(150,150,150)',
            }}
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Icons.plus size={14} /> Toevoegen</>
            )}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit overflow-x-auto">
        {[
          { id: 'all' as const, label: 'Alles', count: stats.total },
          { id: 'open' as const, label: 'Nog te bespreken', count: stats.open },
          { id: 'positive' as const, label: 'Positief', count: stats.positive },
          { id: 'negative' as const, label: 'Kritisch', count: stats.negative },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              tab === t.id ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-black/20' : 'bg-white/10'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Notes timeline */}
      <div className="space-y-3">
        {visibleNotes.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Icons.fileText className="text-gray-600" size={24} />
            </div>
            <p className="text-gray-400 text-sm">
              {notes.length === 0
                ? 'Nog geen notities — voeg de eerste hierboven toe.'
                : `Geen notities in deze filter.`}
            </p>
          </div>
        ) : (
          visibleNotes.map(n => {
            const positive = n.sentiment === 'POSITIVE'
            const isEditing = editingId === n.id
            return (
              <div
                key={n.id}
                className={`card p-5 border-l-4 transition-all ${
                  positive
                    ? 'border-l-emerald-400 bg-gradient-to-br from-emerald-500/[0.04] to-transparent'
                    : 'border-l-rose-400 bg-gradient-to-br from-rose-500/[0.04] to-transparent'
                }`}
                style={{ borderColor: positive ? 'rgba(52, 211, 153, 0.6)' : 'rgba(251, 113, 133, 0.6)' }}
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                      positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}>
                      <span>{positive ? '👍' : '👎'}</span>
                      {positive ? 'Positief' : 'Kritisch'}
                    </span>
                    <span className="text-gray-400">{formatDate(n.noteDate)}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-500">door {n.author.name.split(' ')[0]}</span>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(n)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                        title="Bewerken"
                      >
                        <Icons.edit size={13} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(n.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Verwijderen"
                      >
                        <Icons.trash size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content / edit */}
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditSentiment('POSITIVE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          editSentiment === 'POSITIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        👍 Positief
                      </button>
                      <button
                        onClick={() => setEditSentiment('NEGATIVE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          editSentiment === 'NEGATIVE'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        👎 Kritisch
                      </button>
                      <div className="w-44 ml-auto">
                        <DatePicker
                          selected={editDate}
                          onChange={(d) => setEditDate(d)}
                          dateFormat="d MMM yyyy"
                        />
                      </div>
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-workx-lime/30"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white">
                        Annuleren
                      </button>
                      <button
                        onClick={() => handleSaveEdit(n.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
                      >
                        Opslaan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                )}

                {/* Discussed CTA */}
                {!isEditing && (
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-gray-400">
                      Heb je deze feedback al met {user.name.split(' ')[0]} besproken?
                    </p>
                    {n.discussed ? (
                      <button
                        onClick={() => handleToggleDiscussed(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                      >
                        <Icons.check size={12} />
                        Besproken
                        {n.discussedAt && (
                          <span className="text-emerald-400/60 ml-1">· {formatDate(n.discussedAt)}</span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          Nog niet
                        </span>
                        <button
                          onClick={() => handleToggleDiscussed(n)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-workx-lime/15 text-workx-lime text-xs font-semibold hover:bg-workx-lime/25 transition-all border border-workx-lime/30"
                        >
                          <Icons.check size={12} />
                          Markeer als besproken
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Notitie verwijderen"
        message="Weet je zeker dat je deze notitie wilt verwijderen?"
        confirmText="Verwijderen"
        type="danger"
      />
    </div>
  )
}
