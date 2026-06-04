'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import {
  APPROACH_STATUSES,
  POSTING_OPTIONS,
  INITIAL_CANDIDATE_SLOTS,
} from '@/lib/recruitment-config'

// ─── Types ────────────────────────────────────────────────────────────────

interface Candidate {
  id?: string
  type: 'candidate' | 'ambassador'
  name: string
  experienceYear: number | null
  currentOffice: string | null
  linkedinUrl?: string | null
  inNetwork: boolean
  notes?: string | null
  sortOrder?: number
  approachStatus?: string | null
  approachedBy?: string | null
  approachNotes?: string | null
  networkOwner?: string | null
}

interface User {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
}

interface Entry {
  id: string
  userId: string
  visibilityIdeas: string | null
  willPostHimself: string | null
  postingFormat: string | null
  submittedAt: string | null
  candidates: Candidate[]
}

interface EntryWithUser extends Entry {
  user: User
}

interface ApiData {
  currentUser: { id: string; name: string; role: string }
  revealAt: string
  isBeforeReveal: boolean
  canSeeAll: boolean
  ownEntry: Entry | null
  allEntries: EntryWithUser[]
  activeUsers: User[]
}

// ─── Statics ───────────────────────────────────────────────────────────────

const TRIPS = [
  { name: 'Een trip naar Parijs', img: '/recruitment/parijs.png', tag: 'Luxe city-trip' },
  { name: 'Botanic Sanctuary Antwerpen', img: '/recruitment/antwerpen.png', tag: 'Luxe city-trip' },
  { name: 'Boutique Bungalow — Peace & Quiet', img: '/recruitment/peace-and-quiet.png', tag: 'Bos retreat' },
]

const REFERRAL_MENU_IMG = '/recruitment/referral-menu.png'

// ─── Helpers ───────────────────────────────────────────────────────────────

const linkedInSearchUrl = (name: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + ' advocaat')}`

function statusMeta(value: string | null | undefined) {
  return APPROACH_STATUSES.find(s => s.value === value)
}

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  gray:   { bg: 'bg-white/5',     text: 'text-white/60',    ring: 'ring-white/10' },
  yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', ring: 'ring-yellow-500/30' },
  blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-300',   ring: 'ring-blue-500/30' },
  green:  { bg: 'bg-green-500/15',  text: 'text-green-300',  ring: 'ring-green-500/30' },
  red:    { bg: 'bg-red-500/15',    text: 'text-red-300',    ring: 'ring-red-500/30' },
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function RecruitmentPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [rawData, setRawData] = useState<ApiData | null>(null)
  const [previewAsEmployee, setPreviewAsEmployee] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [ambassadors, setAmbassadors] = useState<Candidate[]>([
    { type: 'ambassador', name: '', experienceYear: null, currentOffice: null, inNetwork: false },
  ])
  const [visibilityIdeas, setVisibilityIdeas] = useState('')
  const [willPostHimself, setWillPostHimself] = useState('')
  const [postingFormat, setPostingFormat] = useState('')

  // Countdown
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number } | null>(null)

  // Overview filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMineOnly, setShowMineOnly] = useState(false)

  // Approach edit modal
  const [editingCandidate, setEditingCandidate] = useState<{ key: string; name: string; ids: string[]; status: string; by: string; notes: string; netOwner: string } | null>(null)
  const [savingApproach, setSavingApproach] = useState(false)

  // Jochem mag een "alsof ik medewerker ben" preview-tab gebruiken
  const isJochem = session?.user?.email === 'jochem.deroos@workxadvocaten.nl'

  // Effective data: respecteert de preview-toggle (alleen voor Jochem)
  const data: ApiData | null = useMemo(() => {
    if (!rawData) return null
    if (previewAsEmployee && isJochem) {
      return {
        ...rawData,
        canSeeAll: false,
        isBeforeReveal: true,
        allEntries: [],
        activeUsers: [],
      }
    }
    return rawData
  }, [rawData, previewAsEmployee, isJochem])

  const isManager = data?.currentUser.role === 'PARTNER' || data?.currentUser.role === 'ADMIN'

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/recruitment')
      if (!res.ok) {
        toast.error('Kon recruitment niet laden')
        setLoading(false)
        return
      }
      const d: ApiData = await res.json()
      setRawData(d)
      if (d.ownEntry) {
        const cands = d.ownEntry.candidates.filter(c => c.type === 'candidate')
        const ambs = d.ownEntry.candidates.filter(c => c.type === 'ambassador')
        const padded = [...cands]
        while (padded.length < INITIAL_CANDIDATE_SLOTS) {
          padded.push({ type: 'candidate', name: '', experienceYear: null, currentOffice: null, inNetwork: false })
        }
        setCandidates(padded)
        setAmbassadors(ambs.length > 0
          ? ambs
          : [{ type: 'ambassador', name: '', experienceYear: null, currentOffice: null, inNetwork: false }])
        setVisibilityIdeas(d.ownEntry.visibilityIdeas || '')
        setWillPostHimself(d.ownEntry.willPostHimself || '')
        setPostingFormat(d.ownEntry.postingFormat || '')
      } else {
        setCandidates(Array.from({ length: INITIAL_CANDIDATE_SLOTS }, () => ({
          type: 'candidate', name: '', experienceYear: null, currentOffice: null, inNetwork: false,
        })))
      }
    } catch {
      toast.error('Kon recruitment niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Countdown
  useEffect(() => {
    if (!data?.revealAt) return
    const target = new Date(data.revealAt).getTime()
    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown(null); return }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      })
    }
    tick()
    const t = setInterval(tick, 30 * 1000)
    return () => clearInterval(t)
  }, [data?.revealAt])

  // ─── Save ────
  const save = async () => {
    setSaving(true)
    try {
      const allCands = [
        ...candidates.filter(c => c.name.trim()).map((c, i) => ({
          type: 'candidate' as const,
          name: c.name.trim(),
          experienceYear: c.experienceYear,
          currentOffice: c.currentOffice,
          linkedinUrl: c.linkedinUrl ?? null,
          inNetwork: c.inNetwork,
          notes: c.notes ?? null,
          sortOrder: i,
        })),
      ]
      ambassadors.filter(a => a.name.trim()).forEach((a, idx) => {
        allCands.push({
          type: 'ambassador' as any,
          name: a.name.trim(),
          experienceYear: a.experienceYear,
          currentOffice: a.currentOffice,
          linkedinUrl: a.linkedinUrl ?? null,
          inNetwork: a.inNetwork,
          notes: a.notes ?? null,
          sortOrder: idx,
        })
      })
      const res = await fetch('/api/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibilityIdeas: visibilityIdeas.trim() || null,
          willPostHimself: willPostHimself || null,
          postingFormat: postingFormat.trim() || null,
          candidates: allCands,
        }),
      })
      if (res.ok) {
        toast.success('Opgeslagen')
        await loadData()
      } else {
        toast.error('Opslaan mislukt')
      }
    } catch {
      toast.error('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const addSlot = () => setCandidates([...candidates, { type: 'candidate', name: '', experienceYear: null, currentOffice: null, inNetwork: false }])
  const removeSlot = (i: number) => setCandidates(candidates.filter((_, idx) => idx !== i))
  const updateSlot = (i: number, patch: Partial<Candidate>) =>
    setCandidates(candidates.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  // ─── Overview ────
  type RankedCandidate = Candidate & {
    mentionedBy: { name: string; role: string; userId: string }[]
    allIds: string[]
    canonicalId: string
    type: 'candidate' | 'ambassador'
  }

  const ranking: RankedCandidate[] = useMemo(() => {
    if (!data?.canSeeAll) return []
    const map = new Map<string, RankedCandidate>()
    for (const entry of data.allEntries) {
      for (const c of entry.candidates) {
        const key = `${c.type}|${c.name.trim().toLowerCase()}`
        const mention = { name: entry.user.name, role: entry.user.role, userId: entry.user.id }
        const existing = map.get(key)
        if (existing) {
          existing.mentionedBy.push(mention)
          if (c.id) existing.allIds.push(c.id)
          // Take any non-null approach data (latest wins via order)
          if (c.approachStatus) existing.approachStatus = c.approachStatus
          if (c.approachedBy) existing.approachedBy = c.approachedBy
          if (c.approachNotes) existing.approachNotes = c.approachNotes
          if (c.networkOwner) existing.networkOwner = c.networkOwner
          if (!existing.experienceYear && c.experienceYear) existing.experienceYear = c.experienceYear
          if (!existing.currentOffice && c.currentOffice) existing.currentOffice = c.currentOffice
          if (!existing.linkedinUrl && c.linkedinUrl) existing.linkedinUrl = c.linkedinUrl
        } else {
          map.set(key, {
            ...c,
            mentionedBy: [mention],
            allIds: c.id ? [c.id] : [],
            canonicalId: c.id || '',
          })
        }
      }
    }
    const arr = Array.from(map.values())
    return arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'candidate' ? -1 : 1
      return (b.experienceYear ?? -1) - (a.experienceYear ?? -1)
    })
  }, [data])

  const filteredRanking = useMemo(() => {
    let r = ranking
    if (statusFilter !== 'all') {
      if (statusFilter === 'niet_benaderd') {
        r = r.filter(c => !c.approachStatus || c.approachStatus === 'niet_benaderd')
      } else {
        r = r.filter(c => c.approachStatus === statusFilter)
      }
    }
    if (showMineOnly && data?.currentUser) {
      const first = data.currentUser.name.split(' ')[0]
      r = r.filter(c => c.approachedBy?.toLowerCase().includes(first.toLowerCase()) || c.networkOwner?.toLowerCase().includes(first.toLowerCase()))
    }
    return r
  }, [ranking, statusFilter, showMineOnly, data?.currentUser])

  // Status counts for filter chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ranking.length, niet_benaderd: 0 }
    for (const s of APPROACH_STATUSES) counts[s.value] = 0
    for (const c of ranking) {
      const k = c.approachStatus || 'niet_benaderd'
      counts[k] = (counts[k] || 0) + 1
    }
    return counts
  }, [ranking])

  // ─── Approach modal save ────
  const saveApproach = async () => {
    if (!editingCandidate) return
    setSavingApproach(true)
    try {
      const payload = {
        approachStatus: editingCandidate.status || null,
        approachedBy: editingCandidate.by || null,
        approachNotes: editingCandidate.notes || null,
        networkOwner: editingCandidate.netOwner || null,
      }
      // Update alle records met dezelfde name+type zodat de dedup consistent blijft
      await Promise.all(editingCandidate.ids.map(id =>
        fetch(`/api/recruitment/candidate/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ))
      toast.success('Bijgewerkt')
      setEditingCandidate(null)
      await loadData()
    } catch {
      toast.error('Bijwerken mislukt')
    } finally {
      setSavingApproach(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Laden...</div>
  }

  return (
    <div className="space-y-6 sm:space-y-8 fade-in">
      {/* Header + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎯</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Recruitment</h1>
          </div>
          <p className="text-sm text-gray-400">Doorlopend op zoek naar talent — vul je lijst aan en houd 'm actueel.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-end p-1 rounded-xl bg-white/5 border border-white/10">
          <button
            onClick={() => router.push('/dashboard/recruitment')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              previewAsEmployee
                ? 'text-white/60 hover:text-white hover:bg-white/5'
                : 'bg-workx-lime/20 text-workx-lime'
            }`}
          >
            Recruitment
          </button>
          {isManager && (
            <button
              onClick={() => router.push('/dashboard/partners/sollicitaties')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Sollicitaties
            </button>
          )}
          {isManager && (
            <button
              onClick={() => router.push('/dashboard/recruitment/oude-lijst')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              (oude) lijst kandidaten
            </button>
          )}
          {isJochem && (
            <button
              onClick={() => setPreviewAsEmployee(!previewAsEmployee)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                previewAsEmployee ? 'bg-violet-500/30 text-violet-200' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Toon zoals een medewerker dit ziet vóór maandag 10:45"
            >
              👁 Medewerker-view
            </button>
          )}
        </div>
      </div>

      {/* Voorvertoning-banner (alleen Jochem, alleen actief) */}
      {previewAsEmployee && isJochem && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span>👁</span>
            <span className="text-violet-200">
              <span className="font-semibold">Medewerker-voorvertoning</span> — dit is wat een advocaat/medewerker tot maandag 10:45 ziet. Je eigen ingevulde lijst blijft zichtbaar, maar geen overzicht van anderen.
            </span>
          </div>
          <button
            onClick={() => setPreviewAsEmployee(false)}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium flex-shrink-0"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* Countdown banner */}
      {countdown && (
        <div className="relative overflow-hidden rounded-2xl border border-workx-lime/20 bg-gradient-to-r from-workx-lime/10 via-emerald-500/5 to-violet-500/10 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-workx-lime font-bold mb-1">Reveal-moment</p>
              <h3 className="text-white text-base sm:text-lg font-semibold">
                Maandag 8 juni · 10:45 — daarna zien we elkaars input
              </h3>
              <p className="text-xs text-white/60 mt-1">Toevoegen kan ook na het overleg, doorlopend.</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              {[
                { v: countdown.days, l: 'd' },
                { v: countdown.hours, l: 'u' },
                { v: countdown.minutes, l: 'm' },
              ].map(({ v, l }) => (
                <div key={l} className="w-14 h-14 rounded-xl bg-black/30 border border-white/10 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-workx-lime tabular-nums">{String(v).padStart(2, '0')}</span>
                  <span className="text-[10px] text-white/40 uppercase">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overview na reveal — bovenaan vanaf maandag 10:45 */}
      {!data?.isBeforeReveal && data?.canSeeAll && (
        <>
          {/* Per-medewerker grid */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>👥</span> Wie heeft wat ingevuld
              </h2>
              <span className="text-xs text-white/50">
                {data.allEntries.length} van {data.activeUsers.length} medewerkers
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.activeUsers.map(u => {
                const entry = data.allEntries.find(e => e.user.id === u.id)
                const photo = getPhotoUrl(u.name, u.avatarUrl)
                const candCount = entry?.candidates.filter(c => c.type === 'candidate').length || 0
                const hasAmb = entry?.candidates.some(c => c.type === 'ambassador') || false
                return (
                  <div key={u.id} className={`rounded-xl border p-3 ${entry ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                        {photo ? <Image src={photo} alt={u.name} width={36} height={36} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white/40">{u.name.charAt(0)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-white/40">{u.role === 'PARTNER' ? 'Partner' : u.role === 'ADMIN' ? 'Office' : 'Advocaat'}</p>
                      </div>
                      {entry ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300">✓</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">leeg</span>
                      )}
                    </div>
                    {entry ? (
                      <div className="space-y-1 text-xs text-white/70">
                        <div>{candCount} kandida{candCount === 1 ? 'at' : 'aten'}{hasAmb && ', 1 ambassadeur'}</div>
                        {entry.willPostHimself && (
                          <div className="text-[11px] text-white/50">
                            Posten: {POSTING_OPTIONS.find(o => o.value === entry.willPostHimself)?.label}
                          </div>
                        )}
                        {entry.visibilityIdeas && (
                          <p className="text-[11px] text-white/40 italic truncate">"{entry.visibilityIdeas.slice(0, 80)}{entry.visibilityIdeas.length > 80 ? '...' : ''}"</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 italic">Nog niet ingevuld</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Total ranking */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🏆</span> Alle kandidaten — gerangschikt op ervaring
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMineOnly(!showMineOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    showMineOnly ? 'bg-workx-lime/20 text-workx-lime border-workx-lime/40' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Mijn kandidaten
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <FilterChip active={statusFilter === 'all'} label="Alles" count={statusCounts.all} onClick={() => setStatusFilter('all')} color="gray" />
              {APPROACH_STATUSES.map(s => (
                <FilterChip key={s.value} active={statusFilter === s.value} label={s.label} count={statusCounts[s.value] || 0} onClick={() => setStatusFilter(s.value)} color={s.color} />
              ))}
            </div>

            <div className="space-y-2">
              {filteredRanking.length === 0 && (
                <p className="text-sm text-white/40 italic py-8 text-center">Geen kandidaten in deze filter.</p>
              )}
              {filteredRanking.map((c) => {
                const sm = statusMeta(c.approachStatus)
                const color = COLOR_MAP[sm?.color || 'gray']
                const isAmb = c.type === 'ambassador'
                const multi = c.mentionedBy.length > 1
                return (
                  <div key={`top-${c.type}|${c.name}`} className={`rounded-xl border p-3 sm:p-4 transition-colors ${color.bg} ${color.ring} ring-1 ${isAmb ? 'border-pink-500/20' : 'border-white/10'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isAmb ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/15 text-blue-300'}`}>{isAmb ? 'Ambassadeur' : 'Kandidaat'}</span>
                          {c.experienceYear !== null && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{c.experienceYear} jr ervaring</span>}
                          {c.inNetwork && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">In netwerk</span>}
                          {multi && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">{c.mentionedBy.length}× genoemd</span>}
                          {sm && <span className={`text-[10px] px-2 py-0.5 rounded-full ${color.text} ${color.bg}`}>{sm.label}</span>}
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h4 className="text-base sm:text-lg font-semibold text-white">{c.name}</h4>
                          {c.currentOffice && <span className="text-sm text-white/60">· {c.currentOffice}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-white/40">Genoemd door</span>
                          {c.mentionedBy.map(m => {
                            const ph = getPhotoUrl(m.name)
                            return (
                              <div key={m.userId} className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                {ph ? <Image src={ph} alt={m.name} width={18} height={18} className="w-4 h-4 rounded-full object-cover" /> : <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">{m.name.charAt(0)}</div>}
                                <span className="text-[11px] text-white/70">{m.name.split(' ')[0]}</span>
                              </div>
                            )
                          })}
                        </div>
                        {(c.approachedBy || c.networkOwner || c.approachNotes) && (
                          <div className="mt-2 pt-2 border-t border-white/5 space-y-1 text-xs text-white/70">
                            {c.approachedBy && <div><span className="text-white/40">Opvolging:</span> {c.approachedBy}</div>}
                            {c.networkOwner && <div><span className="text-white/40">Netwerk via:</span> {c.networkOwner}</div>}
                            {c.approachNotes && <div className="italic text-white/60">"{c.approachNotes}"</div>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={c.linkedinUrl || linkedInSearchUrl(c.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 text-xs font-medium hover:bg-blue-500/25 transition-colors"
                          title={c.linkedinUrl ? 'Open LinkedIn-profiel' : 'Zoek op LinkedIn'}
                        >
                          {c.linkedinUrl ? '🔗 Profiel' : '🔍 LinkedIn'}
                        </a>
                        <button
                          onClick={() => setEditingCandidate({
                            key: `${c.type}|${c.name}`,
                            name: c.name,
                            ids: c.allIds,
                            status: c.approachStatus || '',
                            by: c.approachedBy || '',
                            notes: c.approachNotes || '',
                            netOwner: c.networkOwner || '',
                          })}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium border border-white/10 transition-colors"
                        >
                          Opvolging…
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Preamble — verandert mee na het reveal-moment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(data?.isBeforeReveal
          ? [
              { icon: '👥', title: '5 advocaten', body: 'Die volgens jou passen. Binnen of buiten je netwerk — alleen niet wie al bedankt heeft.' },
              { icon: '🤝', title: 'Een ambassadeur', body: 'Iemand die ons niet werkt bij ons maar wel enthousiast is en een groot netwerk heeft.' },
              { icon: '📣', title: 'Zichtbaarheid', body: 'Ideeën voor LinkedIn-posts vanuit Workx of jezelf. Wil je zelf posten?' },
            ]
          : [
              { icon: '➕', title: 'Nieuwe kandidaten', body: 'Kom je iemand tegen die wel zou passen? Voeg \'m toe. We zoeken het hele jaar door — je lijst hoeft nooit af.' },
              { icon: '🔄', title: 'Bijhouden & opvolgen', body: 'Heb je iemand benaderd of gesproken? Houd de status bij in het overzicht hierboven — dan blijven we synchroon.' },
              { icon: '💡', title: 'Zichtbaarheid', body: 'Nieuwe ideeën voor LinkedIn of Workx-posts? Update je input — anderen pikken het op.' },
            ]
        ).map((c, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-workx-lime/5 via-transparent to-violet-500/5 p-4 hover:border-workx-lime/30 transition-colors"
          >
            <div className="text-3xl mb-2">{c.icon}</div>
            <h3 className="text-white font-semibold mb-1">{c.title}</h3>
            <p className="text-sm text-white/60 leading-snug">{c.body}</p>
          </div>
        ))}
      </div>

      {/* Form section */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Jouw recruitment-input</h2>
          <p className="text-xs text-white/60">Bewaar tussendoor — je kunt altijd later terugkomen om aan te vullen.</p>
        </div>

        {/* Candidates */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
            <span>👤</span> Vijf potentiele Workxers
          </h3>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <CandidateRow
                key={i}
                value={c}
                index={i}
                onChange={(p) => updateSlot(i, p)}
                onRemove={candidates.length > INITIAL_CANDIDATE_SLOTS ? () => removeSlot(i) : undefined}
              />
            ))}
          </div>
          <button
            onClick={addSlot}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
          >
            <Icons.plus size={14} /> Nog een kandidaat toevoegen
          </button>
        </div>

        {/* Ambassadeurs — kunnen er meerdere zijn */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
            <span>🤝</span> Workx-ambassadeur(s)
          </h3>
          <p className="text-xs text-white/50 mb-3">Iemand die niet bij ons werkt maar wel enthousiast is en een groot netwerk heeft. Ken je er meerdere? Voeg ze allemaal toe.</p>
          <div className="space-y-2">
            {ambassadors.map((a, i) => (
              <CandidateRow
                key={i}
                value={a}
                index={i}
                onChange={(p) => setAmbassadors(ambassadors.map((x, idx) => idx === i ? { ...x, ...p } : x))}
                onRemove={ambassadors.length > 1 ? () => setAmbassadors(ambassadors.filter((_, idx) => idx !== i)) : undefined}
              />
            ))}
          </div>
          <button
            onClick={() => setAmbassadors([...ambassadors, { type: 'ambassador', name: '', experienceYear: null, currentOffice: null, inNetwork: false }])}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
          >
            <Icons.plus size={14} /> Nog een ambassadeur toevoegen
          </button>
        </div>

        {/* Visibility ideas */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
            <span>💡</span> Ideeën voor LinkedIn-posts
          </h3>
          <p className="text-xs text-white/50 mb-2">Vanuit Workx of vanuit jezelf. Schrijf het idee kort op.</p>
          <textarea
            value={visibilityIdeas}
            onChange={(e) => setVisibilityIdeas(e.target.value)}
            rows={4}
            placeholder="Bijv. mini-docu over een advocaat, post over recent gewonnen zaak, video over kantoorcultuur..."
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25 resize-none"
          />
        </div>

        {/* Posting preference */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
            <span>📣</span> Zou jij zelf willen posten over je werk?
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {POSTING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setWillPostHimself(willPostHimself === opt.value ? '' : opt.value)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  willPostHimself === opt.value
                    ? 'bg-workx-lime/15 border-workx-lime/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                <div className="text-2xl mb-1">{opt.emoji}</div>
                <div className="text-xs font-medium">{opt.label}</div>
              </button>
            ))}
          </div>
          <textarea
            value={postingFormat}
            onChange={(e) => setPostingFormat(e.target.value)}
            rows={2}
            placeholder="In welke vorm? (tekstpost, video, korte tip, vraag aan netwerk, etc.)"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-workx-lime to-emerald-500 text-black font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : data?.ownEntry ? 'Wijzigingen opslaan' : 'Opslaan'}
          </button>
        </div>
      </div>

      {/* Incentives */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <span>🎁</span> What's in it for me?
          </h2>
          <p className="text-sm text-white/70 max-w-3xl leading-relaxed">
            Ten eerste natuurlijk een leuke nieuwe collega. En een nog betere werkverdeling. Maar we willen ook een echte beloning geven, vandaar — een referral-menu bij een geslaagde aanname, plus een extra weekend weg.
          </p>
        </div>

        {/* Referral menu — afbeelding groot zodat 'ie leesbaar is */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-6 overflow-hidden">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-3">
            Referral Menu
          </div>
          <h3 className="text-white font-bold text-xl mb-1">Breng jij DE nieuwe Workxer aan?</h3>
          <p className="text-sm text-white/70 mb-4">Cadeautje voor jou — plus een beloning voor het hele team.</p>
          {/* Grote, leesbare afbeelding */}
          <div className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-white/10 bg-black/20">
            <Image
              src={REFERRAL_MENU_IMG}
              alt="Referral menu"
              width={1024}
              height={1448}
              className="w-full h-auto block"
              priority
            />
          </div>
        </div>

        {/* Trip incentives */}
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-pink-500/5 p-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            Extra weekend weg
          </div>
          <h3 className="text-white font-bold text-xl mb-1">Speciaal voor jou — een trip naar keuze</h3>
          <p className="text-sm text-white/70 mb-4">Voor twee personen. Kies je favoriet bij geslaagde aanbreng.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TRIPS.map(t => (
              <div key={t.name} className="group rounded-xl overflow-hidden border border-white/10 hover:border-violet-400/40 transition-colors">
                <div className="relative aspect-[2/3]">
                  <Image src={t.img} alt={t.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3 bg-black/30">
                  <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold">{t.tag}</p>
                  <p className="text-sm text-white font-semibold">{t.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overview pre-reveal (= alleen partners/admin zien 'm onder de form) */}
      {data?.canSeeAll && data.isBeforeReveal && (
        <>
          {/* Per-medewerker grid */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>👥</span> Wie heeft wat ingevuld
              </h2>
              <span className="text-xs text-white/50">
                {data.allEntries.length} van {data.activeUsers.length} medewerkers
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.activeUsers.map(u => {
                const entry = data.allEntries.find(e => e.user.id === u.id)
                const photo = getPhotoUrl(u.name, u.avatarUrl)
                const candCount = entry?.candidates.filter(c => c.type === 'candidate').length || 0
                const hasAmb = entry?.candidates.some(c => c.type === 'ambassador') || false
                return (
                  <div key={u.id} className={`rounded-xl border p-3 ${entry ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                        {photo ? <Image src={photo} alt={u.name} width={36} height={36} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white/40">{u.name.charAt(0)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-white/40">{u.role === 'PARTNER' ? 'Partner' : u.role === 'ADMIN' ? 'Office' : 'Advocaat'}</p>
                      </div>
                      {entry ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300">✓</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">leeg</span>
                      )}
                    </div>
                    {entry ? (
                      <div className="space-y-1 text-xs text-white/70">
                        <div>{candCount} kandida{candCount === 1 ? 'at' : 'aten'}{hasAmb && ', 1 ambassadeur'}</div>
                        {entry.willPostHimself && (
                          <div className="text-[11px] text-white/50">
                            Posten: {POSTING_OPTIONS.find(o => o.value === entry.willPostHimself)?.label}
                          </div>
                        )}
                        {entry.visibilityIdeas && (
                          <p className="text-[11px] text-white/40 italic truncate">"{entry.visibilityIdeas.slice(0, 80)}{entry.visibilityIdeas.length > 80 ? '...' : ''}"</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 italic">Nog niet ingevuld</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Total ranking */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🏆</span> Alle kandidaten — gerangschikt op ervaring
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMineOnly(!showMineOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    showMineOnly ? 'bg-workx-lime/20 text-workx-lime border-workx-lime/40' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Mijn kandidaten
                </button>
              </div>
            </div>

            {/* Status filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterChip
                active={statusFilter === 'all'}
                label="Alles"
                count={statusCounts.all}
                onClick={() => setStatusFilter('all')}
                color="gray"
              />
              {APPROACH_STATUSES.map(s => (
                <FilterChip
                  key={s.value}
                  active={statusFilter === s.value}
                  label={s.label}
                  count={statusCounts[s.value] || 0}
                  onClick={() => setStatusFilter(s.value)}
                  color={s.color}
                />
              ))}
            </div>

            {/* Ranking list */}
            <div className="space-y-2">
              {filteredRanking.length === 0 && (
                <p className="text-sm text-white/40 italic py-8 text-center">Geen kandidaten in deze filter.</p>
              )}
              {filteredRanking.map((c) => {
                const sm = statusMeta(c.approachStatus)
                const color = COLOR_MAP[sm?.color || 'gray']
                const isAmb = c.type === 'ambassador'
                const multi = c.mentionedBy.length > 1
                return (
                  <div
                    key={`${c.type}|${c.name}`}
                    className={`rounded-xl border p-3 sm:p-4 transition-colors ${color.bg} ${color.ring} ring-1 ${isAmb ? 'border-pink-500/20' : 'border-white/10'}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isAmb ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/15 text-blue-300'}`}>
                            {isAmb ? 'Ambassadeur' : 'Kandidaat'}
                          </span>
                          {c.experienceYear !== null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                              {c.experienceYear} jr ervaring
                            </span>
                          )}
                          {c.inNetwork && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">In netwerk</span>
                          )}
                          {multi && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                              {c.mentionedBy.length}× genoemd
                            </span>
                          )}
                          {sm && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${color.text} ${color.bg}`}>
                              {sm.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h4 className="text-base sm:text-lg font-semibold text-white">{c.name}</h4>
                          {c.currentOffice && (
                            <span className="text-sm text-white/60">· {c.currentOffice}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-white/40">Genoemd door</span>
                          {c.mentionedBy.map(m => {
                            const ph = getPhotoUrl(m.name)
                            return (
                              <div key={m.userId} className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                {ph ? <Image src={ph} alt={m.name} width={18} height={18} className="w-4 h-4 rounded-full object-cover" /> : <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">{m.name.charAt(0)}</div>}
                                <span className="text-[11px] text-white/70">{m.name.split(' ')[0]}</span>
                              </div>
                            )
                          })}
                        </div>
                        {(c.approachedBy || c.networkOwner || c.approachNotes) && (
                          <div className="mt-2 pt-2 border-t border-white/5 space-y-1 text-xs text-white/70">
                            {c.approachedBy && <div><span className="text-white/40">Opvolging:</span> {c.approachedBy}</div>}
                            {c.networkOwner && <div><span className="text-white/40">Netwerk via:</span> {c.networkOwner}</div>}
                            {c.approachNotes && <div className="italic text-white/60">"{c.approachNotes}"</div>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={c.linkedinUrl || linkedInSearchUrl(c.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 text-xs font-medium hover:bg-blue-500/25 transition-colors"
                          title={c.linkedinUrl ? 'Open LinkedIn-profiel' : 'Zoek op LinkedIn'}
                        >
                          {c.linkedinUrl ? '🔗 Profiel' : '🔍 LinkedIn'}
                        </a>
                        <button
                          onClick={() => setEditingCandidate({
                            key: `${c.type}|${c.name}`,
                            name: c.name,
                            ids: c.allIds,
                            status: c.approachStatus || '',
                            by: c.approachedBy || '',
                            notes: c.approachNotes || '',
                            netOwner: c.networkOwner || '',
                          })}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium border border-white/10 transition-colors"
                        >
                          Opvolging…
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Approach edit modal — createPortal */}
      {editingCandidate && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditingCandidate(null)}
        >
          <div
            className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">Opvolging — {editingCandidate.name}</p>
                  <h3 className="text-lg font-semibold text-white">Wie pakt het op en hoe?</h3>
                </div>
                <button onClick={() => setEditingCandidate(null)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                  <Icons.x size={20} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Status</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {APPROACH_STATUSES.map(s => {
                    const c = COLOR_MAP[s.color]
                    const sel = editingCandidate.status === s.value
                    return (
                      <button
                        key={s.value}
                        onClick={() => setEditingCandidate({ ...editingCandidate, status: s.value })}
                        className={`p-2.5 rounded-lg text-sm border transition-colors text-left ${sel ? `${c.bg} ${c.text} ${c.ring} ring-1` : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Wie pakt het op? (voornaam of namen)</label>
                <input
                  type="text"
                  value={editingCandidate.by}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, by: e.target.value })}
                  placeholder="Bijv. Marnix, Hanna"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Binnen wiens (afgeleide) netwerk?</label>
                <input
                  type="text"
                  value={editingCandidate.netOwner}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, netOwner: e.target.value })}
                  placeholder="Bijv. Maaike via NautaDutilh"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Notities</label>
                <textarea
                  value={editingCandidate.notes}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, notes: e.target.value })}
                  rows={3}
                  placeholder="Vrije aantekeningen, datum laatste contact, etc."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25 resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t border-white/10 flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setEditingCandidate(null)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-sm">
                Annuleren
              </button>
              <button onClick={saveApproach} disabled={savingApproach} className="px-5 py-2 rounded-lg bg-gradient-to-r from-workx-lime to-emerald-500 text-black font-semibold text-sm disabled:opacity-50">
                {savingApproach ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function CandidateRow({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: Candidate
  index: number
  onChange: (patch: Partial<Candidate>) => void
  onRemove?: () => void
}) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="hidden sm:flex items-center justify-center text-white/30 text-sm font-bold w-7 pt-2 flex-shrink-0">
          {value.type === 'ambassador' ? '🤝' : `#${index + 1}`}
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Naam"
            className="sm:col-span-5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
          />
          <input
            type="number"
            value={value.experienceYear ?? ''}
            onChange={(e) => onChange({ experienceYear: e.target.value === '' ? null : parseInt(e.target.value) })}
            placeholder="Jaren ervaring"
            min={0}
            max={50}
            className="sm:col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
          />
          <input
            type="text"
            value={value.currentOffice ?? ''}
            onChange={(e) => onChange({ currentOffice: e.target.value })}
            placeholder="Huidig kantoor"
            className="sm:col-span-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
          />
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 mt-1"
            title="Verwijderen"
          >
            <Icons.x size={14} />
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:pl-9">
        {/* LinkedIn-URL */}
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400 text-sm">in</span>
          <input
            type="url"
            value={value.linkedinUrl ?? ''}
            onChange={(e) => onChange({ linkedinUrl: e.target.value })}
            placeholder="LinkedIn-URL (optioneel) — bv. linkedin.com/in/…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs sm:text-sm focus:border-workx-lime/50 focus:outline-none placeholder:text-white/25"
          />
        </div>
        {/* Netwerk binary toggle — twee duidelijke knoppen */}
        <div className="flex gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 sm:w-auto">
          <button
            onClick={() => onChange({ inNetwork: true })}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              value.inNetwork ? 'bg-emerald-500/25 text-emerald-200' : 'text-white/40 hover:text-white/70'
            }`}
          >
            In mijn netwerk
          </button>
          <button
            onClick={() => onChange({ inNetwork: false })}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              !value.inNetwork ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Daarbuiten
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  active,
  label,
  count,
  onClick,
  color,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
  color: string
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.gray
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
        active ? `${c.bg} ${c.text} ${c.ring} ring-1 border-transparent` : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-black/30' : 'bg-white/10'}`}>{count}</span>
    </button>
  )
}
