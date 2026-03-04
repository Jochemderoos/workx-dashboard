'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl, ALL_TEAM_MEMBERS } from '@/lib/team-photos'
import { uploadToBlob } from '@/lib/blob-upload'

// ─── Types ────────────────────────────────────────────────────────────────

interface ApplicantDocument {
  id: string
  type: string
  naam: string
  fileUrl: string
  fileSize: number | null
  createdAt: string
}

interface ApplicantInterview {
  id: string
  datum: string
  interviewerIds: string | null
  interviewerNames: string | null
  feedback: string | null
  aandachtspunten: string | null
  status: string
  createdAt: string
}

interface Applicant {
  id: string
  naam: string
  email: string | null
  telefoon: string | null
  geboortedatum: string | null
  adres: string | null
  photoUrl: string | null
  huidigeWerkgever: string | null
  huidigeFunctie: string | null
  opleiding: string | null
  ervaring: string | null
  vaardigheden: string | null
  talen: string | null
  cvSummary: string | null
  status: string
  notities: string | null
  createdAt: string
  documents: ApplicantDocument[]
  interviews: ApplicantInterview[]
}

type StatusFilter = 'alle' | 'nieuw' | 'in_gesprek' | 'aangenomen' | 'afgewezen'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nieuw: { label: 'Nieuw', color: 'text-blue-400', bg: 'bg-blue-500/20 text-blue-400' },
  in_gesprek: { label: 'In gesprek', color: 'text-yellow-400', bg: 'bg-yellow-500/20 text-yellow-400' },
  aangenomen: { label: 'Aangenomen', color: 'text-green-400', bg: 'bg-green-500/20 text-green-400' },
  afgewezen: { label: 'Afgewezen', color: 'text-red-400', bg: 'bg-red-500/20 text-red-400' },
}

// ─── PDF/DOCX Text Extraction (client-side) ──────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    try {
      const arrayBuf = await file.arrayBuffer()
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = content.items.map((item: any) => item.str).join(' ')
        if (text.trim()) pages.push(text.trim())
      }
      return pages.join('\n\n') || ''
    } catch {
      return ''
    }
  }

  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const arrayBuf = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf })
      return result.value || ''
    } catch {
      return ''
    }
  }

  if (ext === 'txt') {
    return await file.text()
  }

  return ''
}

// ─── Main Page Component ──────────────────────────────────────────────────

export default function SollicitatiesPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  // New applicant form
  const [newNaam, setNewNaam] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newTelefoon, setNewTelefoon] = useState('')
  const [newFunctie, setNewFunctie] = useState('')
  const [newWerkgever, setNewWerkgever] = useState('')
  const [creating, setCreating] = useState(false)

  // Access check
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) { router.push('/login'); return }
    const role = (session.user as { role?: string })?.role
    if (role !== 'PARTNER' && role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, sessionStatus, router])

  // Fetch applicants
  const fetchApplicants = useCallback(async () => {
    try {
      const res = await fetch('/api/sollicitaties')
      if (res.ok) {
        const data = await res.json()
        setApplicants(data)
      }
    } catch {
      toast.error('Kon sollicitanten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApplicants() }, [fetchApplicants])

  // Filter applicants
  const filtered = statusFilter === 'alle'
    ? applicants
    : applicants.filter(a => a.status === statusFilter)

  const selectedApplicant = applicants.find(a => a.id === selectedId) || null

  // Create new applicant
  const handleCreate = async () => {
    if (!newNaam.trim()) { toast.error('Naam is verplicht'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/sollicitaties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          naam: newNaam,
          email: newEmail || undefined,
          telefoon: newTelefoon || undefined,
          huidigeFunctie: newFunctie || undefined,
          huidigeWerkgever: newWerkgever || undefined,
        }),
      })
      if (res.ok) {
        const applicant = await res.json()
        toast.success('Sollicitant aangemaakt')
        setShowNewForm(false)
        setNewNaam(''); setNewEmail(''); setNewTelefoon(''); setNewFunctie(''); setNewWerkgever('')
        await fetchApplicants()
        setSelectedId(applicant.id)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Kon sollicitant niet aanmaken')
      }
    } catch {
      toast.error('Fout bij aanmaken')
    } finally {
      setCreating(false)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sollicitaties</h1>
          <p className="text-white/40 text-sm mt-1">Beheer sollicitanten, CV's en gesprekken</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all border border-workx-lime/20"
        >
          <Icons.userPlus size={16} />
          Nieuwe sollicitant
        </button>
      </div>

      {/* New applicant form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-6 space-y-4">
              <h3 className="text-white font-semibold">Nieuwe sollicitant</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Naam *</label>
                  <input
                    value={newNaam}
                    onChange={e => setNewNaam(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                    placeholder="Volledige naam"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Email</label>
                  <input
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                    placeholder="email@voorbeeld.nl"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Telefoon</label>
                  <input
                    value={newTelefoon}
                    onChange={e => setNewTelefoon(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                    placeholder="06-12345678"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Huidige functie</label>
                  <input
                    value={newFunctie}
                    onChange={e => setNewFunctie(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                    placeholder="Functie"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Huidige werkgever</label>
                  <input
                    value={newWerkgever}
                    onChange={e => setNewWerkgever(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                    placeholder="Werkgever"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
                >
                  {creating ? (
                    <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                  ) : (
                    <Icons.check size={14} />
                  )}
                  Aanmaken
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/5">
        {([
          { key: 'alle', label: 'Alle', count: applicants.length },
          { key: 'nieuw', label: 'Nieuw', count: applicants.filter(a => a.status === 'nieuw').length },
          { key: 'in_gesprek', label: 'In gesprek', count: applicants.filter(a => a.status === 'in_gesprek').length },
          { key: 'aangenomen', label: 'Aangenomen', count: applicants.filter(a => a.status === 'aangenomen').length },
          { key: 'afgewezen', label: 'Afgewezen', count: applicants.filter(a => a.status === 'afgewezen').length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
              statusFilter === tab.key
                ? 'bg-workx-lime/10 text-workx-lime font-medium'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.key ? 'bg-workx-lime/20' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Left: Applicant cards */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-8 text-center">
              <Icons.users size={32} className="mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm">Geen sollicitanten gevonden</p>
            </div>
          )}
          <AnimatePresence>
            {filtered.map((applicant, index) => (
              <motion.button
                key={applicant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedId(applicant.id === selectedId ? null : applicant.id)}
                className={`w-full text-left bg-workx-dark/40 rounded-2xl border p-4 transition-all ${
                  selectedId === applicant.id
                    ? 'border-workx-lime/30 bg-workx-lime/5'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  {applicant.photoUrl ? (
                    <img
                      src={applicant.photoUrl}
                      alt={applicant.naam}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-workx-lime/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-workx-lime/10 flex items-center justify-center text-workx-lime font-bold">
                      {applicant.naam.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{applicant.naam}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_CONFIG[applicant.status]?.bg || 'bg-white/10 text-white/40'}`}>
                        {STATUS_CONFIG[applicant.status]?.label || applicant.status}
                      </span>
                    </div>
                    {applicant.huidigeFunctie && (
                      <p className="text-xs text-white/40 truncate mt-0.5">
                        {applicant.huidigeFunctie}
                        {applicant.huidigeWerkgever && ` bij ${applicant.huidigeWerkgever}`}
                      </p>
                    )}
                  </div>
                  <Icons.arrowRight size={14} className={`text-white/20 transition-transform ${selectedId === applicant.id ? 'rotate-90' : ''}`} />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Right: Detail view */}
        <div>
          {selectedApplicant ? (
            <ApplicantDetail
              applicant={selectedApplicant}
              onRefresh={fetchApplicants}
            />
          ) : (
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-12 text-center">
              <Icons.userPlus size={40} className="mx-auto mb-4 text-white/10" />
              <p className="text-white/30 text-sm">Selecteer een sollicitant om details te bekijken</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Applicant Detail Component ───────────────────────────────────────────

function ApplicantDetail({ applicant, onRefresh }: { applicant: Applicant; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'profiel' | 'documenten' | 'gesprekken' | 'notities'>('profiel')
  const [status, setStatus] = useState(applicant.status)
  const [notities, setNotities] = useState(applicant.notities || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Reset when applicant changes
  useEffect(() => {
    setStatus(applicant.status)
    setNotities(applicant.notities || '')
    setActiveTab('profiel')
  }, [applicant.id, applicant.status, applicant.notities])

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    try {
      await fetch(`/api/sollicitaties/${applicant.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success('Status bijgewerkt')
      onRefresh()
    } catch {
      toast.error('Kon status niet bijwerken')
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await fetch(`/api/sollicitaties/${applicant.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notities }),
      })
      toast.success('Notities opgeslagen')
      onRefresh()
    } catch {
      toast.error('Kon notities niet opslaan')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je deze sollicitant wilt verwijderen?')) return
    setDeleting(true)
    try {
      await fetch(`/api/sollicitaties/${applicant.id}`, { method: 'DELETE' })
      toast.success('Sollicitant verwijderd')
      onRefresh()
    } catch {
      toast.error('Kon sollicitant niet verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-start gap-4">
          {applicant.photoUrl ? (
            <img
              src={applicant.photoUrl}
              alt={applicant.naam}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-workx-lime/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-workx-lime/10 flex items-center justify-center text-workx-lime text-xl font-bold">
              {applicant.naam.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{applicant.naam}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-white/40">
              {applicant.email && (
                <span className="flex items-center gap-1">
                  <Icons.mail size={12} />
                  {applicant.email}
                </span>
              )}
              {applicant.telefoon && (
                <span className="flex items-center gap-1">
                  <Icons.phone size={12} />
                  {applicant.telefoon}
                </span>
              )}
            </div>
            {applicant.huidigeFunctie && (
              <p className="text-sm text-white/50 mt-1">
                {applicant.huidigeFunctie}
                {applicant.huidigeWerkgever && ` bij ${applicant.huidigeWerkgever}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-workx-lime/30 cursor-pointer"
            >
              <option value="nieuw">Nieuw</option>
              <option value="in_gesprek">In gesprek</option>
              <option value="aangenomen">Aangenomen</option>
              <option value="afgewezen">Afgewezen</option>
            </select>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Verwijderen"
            >
              <Icons.trash size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {([
          { key: 'profiel', label: 'Profiel' },
          { key: 'documenten', label: 'Documenten', count: applicant.documents.length },
          { key: 'gesprekken', label: 'Gesprekken', count: applicant.interviews.length },
          { key: 'notities', label: 'Notities' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-workx-lime text-workx-lime'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'profiel' && <ProfielTab applicant={applicant} />}
        {activeTab === 'documenten' && <DocumentenTab applicant={applicant} onRefresh={onRefresh} />}
        {activeTab === 'gesprekken' && <GesprekkenTab applicant={applicant} onRefresh={onRefresh} />}
        {activeTab === 'notities' && (
          <div className="space-y-4">
            <textarea
              value={notities}
              onChange={e => setNotities(e.target.value)}
              className="w-full h-48 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-workx-lime/30 resize-none"
              placeholder="Notities over deze sollicitant..."
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes || notities === (applicant.notities || '')}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
              >
                {savingNotes ? (
                  <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                ) : (
                  <Icons.check size={14} />
                )}
                Opslaan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Profiel Tab ──────────────────────────────────────────────────────────

function ProfielTab({ applicant }: { applicant: Applicant }) {
  if (!applicant.cvSummary && !applicant.opleiding && !applicant.ervaring && !applicant.vaardigheden && !applicant.talen) {
    return (
      <div className="text-center py-8">
        <Icons.fileText size={32} className="mx-auto mb-3 text-white/10" />
        <p className="text-white/30 text-sm">Nog geen profielgegevens geëxtraheerd</p>
        <p className="text-white/20 text-xs mt-1">Upload een CV bij Documenten en klik op &quot;Gegevens extraheren&quot;</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {applicant.cvSummary && (
        <div>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Samenvatting</h4>
          <p className="text-sm text-white/70 leading-relaxed">{applicant.cvSummary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {applicant.opleiding && (
          <div>
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Opleiding</h4>
            <p className="text-sm text-white/70 whitespace-pre-line">{applicant.opleiding}</p>
          </div>
        )}
        {applicant.ervaring && (
          <div>
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Werkervaring</h4>
            <p className="text-sm text-white/70 whitespace-pre-line">{applicant.ervaring}</p>
          </div>
        )}
        {applicant.vaardigheden && (
          <div>
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Vaardigheden</h4>
            <div className="flex flex-wrap gap-1.5">
              {applicant.vaardigheden.split(',').map((v, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-workx-lime/10 text-workx-lime text-xs">
                  {v.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
        {applicant.talen && (
          <div>
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Talen</h4>
            <div className="flex flex-wrap gap-1.5">
              {applicant.talen.split(',').map((t, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                  {t.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {(applicant.geboortedatum || applicant.adres) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          {applicant.geboortedatum && (
            <div>
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-1">Geboortedatum</h4>
              <p className="text-sm text-white/70">{applicant.geboortedatum}</p>
            </div>
          )}
          {applicant.adres && (
            <div>
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-1">Adres</h4>
              <p className="text-sm text-white/70">{applicant.adres}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Documenten Tab ───────────────────────────────────────────────────────

function DocumentenTab({ applicant, onRefresh }: { applicant: Applicant; onRefresh: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState<'cv' | 'brief' | 'overig'>('cv')
  const [extracting, setExtracting] = useState(false)
  const [extractedText, setExtractedText] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Upload to Vercel Blob
      const result = await uploadToBlob(`sollicitaties/${applicant.id}/${file.name}`, file)

      // Save document metadata
      const res = await fetch(`/api/sollicitaties/${applicant.id}/documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: docType,
          naam: file.name,
          fileUrl: result.url,
          fileSize: file.size,
        }),
      })

      if (res.ok) {
        toast.success('Document geüpload')

        // If it's a CV or brief, also extract text for later AI extraction
        if (docType === 'cv' || docType === 'brief') {
          const text = await extractTextFromFile(file)
          if (text) {
            setExtractedText(text)
          }
        }

        onRefresh()
      } else {
        toast.error('Kon document niet opslaan')
      }
    } catch (err) {
      console.error('Upload failed:', err)
      toast.error('Upload mislukt')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExtract = async () => {
    if (!extractedText) {
      toast.error('Upload eerst een CV om gegevens te extraheren')
      return
    }
    setExtracting(true)
    try {
      const res = await fetch(`/api/sollicitaties/${applicant.id}/extract`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: extractedText }),
      })
      if (res.ok) {
        toast.success('Gegevens geëxtraheerd uit CV')
        setExtractedText(null)
        onRefresh()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Extractie mislukt')
      }
    } catch {
      toast.error('Extractie mislukt')
    } finally {
      setExtracting(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      await fetch(`/api/sollicitaties/${applicant.id}/documents/${docId}`, { method: 'DELETE' })
      toast.success('Document verwijderd')
      onRefresh()
    } catch {
      toast.error('Kon document niet verwijderen')
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="flex items-center gap-3">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value as 'cv' | 'brief' | 'overig')}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
        >
          <option value="cv">CV</option>
          <option value="brief">Motivatiebrief</option>
          <option value="overig">Overig</option>
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-sm transition-all disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Icons.upload size={14} />
          )}
          {uploading ? 'Uploaden...' : 'Bestand kiezen'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleUpload}
          className="hidden"
        />
        {extractedText && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 text-sm font-medium transition-all disabled:opacity-50 border border-workx-lime/20"
          >
            {extracting ? (
              <div className="w-4 h-4 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
            ) : (
              <Icons.sparkles size={14} />
            )}
            {extracting ? 'Extraheren...' : 'Gegevens extraheren'}
          </button>
        )}
      </div>

      {/* Document list */}
      {applicant.documents.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
          <Icons.upload size={24} className="mx-auto mb-2 text-white/20" />
          <p className="text-white/30 text-sm">Nog geen documenten geüpload</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applicant.documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-all">
              <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                <Icons.fileText size={14} className="text-workx-lime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{doc.naam}</p>
                <p className="text-xs text-white/30">
                  {doc.type === 'cv' ? 'CV' : doc.type === 'brief' ? 'Motivatiebrief' : 'Overig'}
                  {doc.fileSize && ` • ${(doc.fileSize / 1024).toFixed(0)} KB`}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                title="Downloaden"
              >
                <Icons.download size={14} />
              </a>
              <button
                onClick={() => handleDeleteDoc(doc.id)}
                className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Verwijderen"
              >
                <Icons.trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Gesprekken Tab ───────────────────────────────────────────────────────

function GesprekkenTab({ applicant, onRefresh }: { applicant: Applicant; onRefresh: () => void }) {
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [datum, setDatum] = useState('')
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>([])
  const [planning, setPlanning] = useState(false)

  // Feedback/aandachtspunten editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFeedback, setEditFeedback] = useState('')
  const [editAandachtspunten, setEditAandachtspunten] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleInterviewer = (name: string) => {
    setSelectedInterviewers(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  const handlePlan = async () => {
    if (!datum) { toast.error('Kies een datum'); return }
    if (selectedInterviewers.length === 0) { toast.error('Selecteer minimaal één interviewer'); return }

    setPlanning(true)
    try {
      const res = await fetch(`/api/sollicitaties/${applicant.id}/interviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datum,
          interviewerNames: selectedInterviewers.join(', '),
        }),
      })
      if (res.ok) {
        toast.success('Gesprek gepland')
        setShowPlanForm(false)
        setDatum('')
        setSelectedInterviewers([])
        onRefresh()
      }
    } catch {
      toast.error('Kon gesprek niet plannen')
    } finally {
      setPlanning(false)
    }
  }

  const handleSaveFeedback = async (interviewId: string) => {
    setSaving(true)
    try {
      await fetch(`/api/sollicitaties/${applicant.id}/interviews/${interviewId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          feedback: editFeedback,
          aandachtspunten: editAandachtspunten,
          status: 'afgerond',
        }),
      })
      toast.success('Feedback opgeslagen')
      setEditingId(null)
      onRefresh()
    } catch {
      toast.error('Kon feedback niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteInterview = async (interviewId: string) => {
    try {
      await fetch(`/api/sollicitaties/${applicant.id}/interviews/${interviewId}`, { method: 'DELETE' })
      toast.success('Gesprek verwijderd')
      onRefresh()
    } catch {
      toast.error('Kon gesprek niet verwijderen')
    }
  }

  const handleCancelInterview = async (interviewId: string) => {
    try {
      await fetch(`/api/sollicitaties/${applicant.id}/interviews/${interviewId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'geannuleerd' }),
      })
      toast.success('Gesprek geannuleerd')
      onRefresh()
    } catch {
      toast.error('Kon gesprek niet annuleren')
    }
  }

  return (
    <div className="space-y-4">
      {/* Plan button */}
      <button
        onClick={() => setShowPlanForm(!showPlanForm)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 text-sm font-medium transition-all border border-workx-lime/20"
      >
        <Icons.plus size={14} />
        Gesprek plannen
      </button>

      {/* Plan form */}
      <AnimatePresence>
        {showPlanForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1">Datum en tijd</label>
                <input
                  type="datetime-local"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">Interviewers</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_TEAM_MEMBERS.map(name => {
                    const photo = getPhotoUrl(name)
                    const isSelected = selectedInterviewers.includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => toggleInterviewer(name)}
                        className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs transition-all ${
                          isSelected
                            ? 'bg-workx-lime/10 border border-workx-lime/30 text-workx-lime'
                            : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {photo ? (
                          <img src={photo} alt={name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                            {name.charAt(0)}
                          </div>
                        )}
                        {name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowPlanForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-sm transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={handlePlan}
                  disabled={planning}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
                >
                  {planning ? (
                    <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                  ) : (
                    <Icons.calendar size={14} />
                  )}
                  Inplannen
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interview list */}
      {applicant.interviews.length === 0 ? (
        <div className="text-center py-8">
          <Icons.calendar size={24} className="mx-auto mb-2 text-white/20" />
          <p className="text-white/30 text-sm">Nog geen gesprekken gepland</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applicant.interviews.map(interview => {
            const interviewers = interview.interviewerNames?.split(', ').filter(Boolean) || []
            const isEditing = editingId === interview.id
            const interviewDate = new Date(interview.datum)

            return (
              <div key={interview.id} className="bg-white/[0.02] rounded-xl border border-white/5 p-4 space-y-3">
                {/* Interview header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      interview.status === 'gepland' ? 'bg-blue-400' :
                      interview.status === 'afgerond' ? 'bg-green-400' :
                      'bg-red-400'
                    }`} />
                    <span className="text-sm text-white font-medium">
                      {interviewDate.toLocaleDateString('nl-NL', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                      })}
                      {' om '}
                      {interviewDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      interview.status === 'gepland' ? 'bg-blue-500/20 text-blue-400' :
                      interview.status === 'afgerond' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {interview.status === 'gepland' ? 'Gepland' :
                       interview.status === 'afgerond' ? 'Afgerond' : 'Geannuleerd'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {interview.status === 'gepland' && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(interview.id)
                            setEditFeedback(interview.feedback || '')
                            setEditAandachtspunten(interview.aandachtspunten || '')
                          }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                          title="Feedback toevoegen"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => handleCancelInterview(interview.id)}
                          className="p-1.5 rounded-lg text-yellow-400/30 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                          title="Annuleren"
                        >
                          <Icons.x size={14} />
                        </button>
                      </>
                    )}
                    {interview.status === 'afgerond' && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(interview.id)
                          setEditFeedback(interview.feedback || '')
                          setEditAandachtspunten(interview.aandachtspunten || '')
                        }}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                        title="Feedback bewerken"
                      >
                        <Icons.edit size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteInterview(interview.id)}
                      className="p-1.5 rounded-lg text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Verwijderen"
                    >
                      <Icons.trash size={14} />
                    </button>
                  </div>
                </div>

                {/* Interviewers with photos */}
                {interviewers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">Interviewers:</span>
                    <div className="flex items-center gap-1.5">
                      {interviewers.map(name => {
                        const photo = getPhotoUrl(name)
                        return (
                          <div key={name} className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-white/5" title={name}>
                            {photo ? (
                              <img src={photo} alt={name} className="w-5 h-5 rounded-full object-cover ring-1 ring-workx-lime/20" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-workx-lime/10 flex items-center justify-center text-workx-lime text-[10px] font-bold">
                                {name.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs text-white/60">{name.split(' ')[0]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback display (when not editing) */}
                {!isEditing && interview.feedback && (
                  <div className="mt-2">
                    <h5 className="text-xs text-white/40 uppercase tracking-wider mb-1">Feedback</h5>
                    <p className="text-sm text-white/70 whitespace-pre-line">{interview.feedback}</p>
                  </div>
                )}

                {/* Aandachtspunten display (when not editing) */}
                {!isEditing && interview.aandachtspunten && (
                  <div className="mt-2 bg-amber-500/10 border-l-4 border-amber-500/60 rounded-r-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icons.alertTriangle size={14} className="text-amber-400" />
                      <h5 className="text-xs text-amber-400 uppercase tracking-wider font-medium">Aandachtspunten</h5>
                    </div>
                    <p className="text-sm text-amber-200/80 whitespace-pre-line">{interview.aandachtspunten}</p>
                  </div>
                )}

                {/* Editing feedback/aandachtspunten */}
                {isEditing && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Feedback</label>
                      <textarea
                        value={editFeedback}
                        onChange={e => setEditFeedback(e.target.value)}
                        className="w-full h-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30 resize-none"
                        placeholder="Hoe verliep het gesprek?"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                        <Icons.alertTriangle size={12} />
                        Aandachtspunten
                      </label>
                      <textarea
                        value={editAandachtspunten}
                        onChange={e => setEditAandachtspunten(e.target.value)}
                        className="w-full h-20 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 resize-none"
                        placeholder="Belangrijke aandachtspunten of zorgen..."
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-sm transition-all"
                      >
                        Annuleren
                      </button>
                      <button
                        onClick={() => handleSaveFeedback(interview.id)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                        ) : (
                          <Icons.check size={14} />
                        )}
                        Opslaan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
