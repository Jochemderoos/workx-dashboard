'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { getPhotoUrl, ALL_TEAM_MEMBERS } from '@/lib/team-photos'
import { uploadToBlob } from '@/lib/blob-upload'
import SollicitatiebeleidSection from '@/components/sollicitaties/SollicitatiebeleidSection'

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
  const [newCvFile, setNewCvFile] = useState<File | null>(null)
  const [newBriefFile, setNewBriefFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createProgress, setCreateProgress] = useState('')
  const cvInputRef = useRef<HTMLInputElement>(null)
  const briefInputRef = useRef<HTMLInputElement>(null)

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

  const resetForm = () => {
    setNewNaam('')
    setNewCvFile(null)
    setNewBriefFile(null)
    setCreateProgress('')
    if (cvInputRef.current) cvInputRef.current.value = ''
    if (briefInputRef.current) briefInputRef.current.value = ''
  }

  // Create new applicant with CV upload + auto-extraction
  const handleCreate = async () => {
    if (!newNaam.trim() && !newCvFile) {
      toast.error('Vul een naam in of upload een CV')
      return
    }

    setCreating(true)
    try {
      // Step 1: Create applicant (with name or placeholder)
      setCreateProgress('Sollicitant aanmaken...')
      const res = await fetch('/api/sollicitaties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          naam: newNaam.trim() || 'Nieuwe sollicitant',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Kon sollicitant niet aanmaken')
        return
      }
      const applicant = await res.json()

      // Step 2: Upload CV if provided
      let cvText = ''
      if (newCvFile) {
        setCreateProgress('CV uploaden...')
        try {
          const cvResult = await uploadToBlob(
            `sollicitaties/${applicant.id}/${newCvFile.name}`,
            newCvFile
          )
          await fetch(`/api/sollicitaties/${applicant.id}/documents`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              type: 'cv',
              naam: newCvFile.name,
              fileUrl: cvResult.url,
              fileSize: newCvFile.size,
            }),
          })
          // Extract text for AI
          setCreateProgress('CV tekst extraheren...')
          cvText = await extractTextFromFile(newCvFile)
        } catch {
          console.error('CV upload failed')
        }
      }

      // Step 3: Upload brief if provided
      let briefText = ''
      if (newBriefFile) {
        setCreateProgress('Motivatiebrief uploaden...')
        try {
          const briefResult = await uploadToBlob(
            `sollicitaties/${applicant.id}/${newBriefFile.name}`,
            newBriefFile
          )
          await fetch(`/api/sollicitaties/${applicant.id}/documents`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              type: 'brief',
              naam: newBriefFile.name,
              fileUrl: briefResult.url,
              fileSize: newBriefFile.size,
            }),
          })
          // Extract text
          briefText = await extractTextFromFile(newBriefFile)
        } catch {
          console.error('Brief upload failed')
        }
      }

      // Step 4: Auto-extract profile data from CV/brief text via AI
      const combinedText = [cvText, briefText].filter(Boolean).join('\n\n---\n\n')
      if (combinedText.trim()) {
        setCreateProgress('Kerngegevens extraheren met AI...')
        try {
          await fetch(`/api/sollicitaties/${applicant.id}/extract`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: combinedText }),
          })
        } catch {
          console.error('AI extraction failed')
        }
      }

      toast.success(combinedText ? 'Sollicitant aangemaakt en gegevens geëxtraheerd' : 'Sollicitant aangemaakt')
      setShowNewForm(false)
      resetForm()
      await fetchApplicants()
      setSelectedId(applicant.id)
    } catch {
      toast.error('Fout bij aanmaken')
    } finally {
      setCreating(false)
      setCreateProgress('')
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

      {/* Sollicitatiebeleid — bovenaan, met visuele timeline en PDF-download */}
      <SollicitatiebeleidSection />

      {/* Overview dashboard */}
      {applicants.length > 0 && (() => {
        const actief = applicants.filter(a => a.status === 'nieuw' || a.status === 'in_gesprek')
        const allInterviews = applicants.flatMap(a =>
          a.interviews.map(i => ({ ...i, applicantNaam: a.naam, applicantId: a.id }))
        )
        const now = new Date()
        const gepland = allInterviews
          .filter(i => i.status === 'gepland' && new Date(i.datum) >= now)
          .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
        const afgerond = allInterviews
          .filter(i => i.status === 'afgerond')
          .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
          .slice(0, 5)

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Actieve sollicitanten */}
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Icons.users size={12} className="text-blue-400" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Actief</span>
                <span className="text-xs text-white/20 ml-auto">{actief.length}</span>
              </div>
              {actief.length === 0 ? (
                <p className="text-xs text-white/20">Geen actieve sollicitanten</p>
              ) : (
                <div className="space-y-1.5">
                  {actief.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className="w-full flex items-center gap-2 text-left hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all"
                    >
                      <div className="w-6 h-6 rounded-full bg-workx-lime/10 flex items-center justify-center text-workx-lime text-[10px] font-bold flex-shrink-0">
                        {a.naam.charAt(0)}
                      </div>
                      <span className="text-xs text-white/70 truncate flex-1">{a.naam}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[a.status]?.bg || ''}`}>
                        {STATUS_CONFIG[a.status]?.label || a.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Geplande gesprekken */}
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.calendar size={12} className="text-workx-lime" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Gepland</span>
                <span className="text-xs text-white/20 ml-auto">{gepland.length}</span>
              </div>
              {gepland.length === 0 ? (
                <p className="text-xs text-white/20">Geen geplande gesprekken</p>
              ) : (
                <div className="space-y-1.5">
                  {gepland.slice(0, 5).map(i => {
                    const d = new Date(i.datum)
                    const interviewers = i.interviewerNames?.split(', ').filter(Boolean) || []
                    return (
                      <button
                        key={i.id}
                        onClick={() => setSelectedId(i.applicantId)}
                        className="w-full flex items-center gap-2 text-left hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all"
                      >
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">{i.applicantNaam}</p>
                          <p className="text-[10px] text-white/30">
                            {d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' '}
                            {d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex -space-x-1.5">
                          {interviewers.slice(0, 3).map(name => {
                            const photo = getPhotoUrl(name)
                            return photo ? (
                              <img key={name} src={photo} alt={name} className="w-5 h-5 rounded-full object-cover ring-1 ring-workx-dark" title={name} />
                            ) : (
                              <div key={name} className="w-5 h-5 rounded-full bg-white/10 ring-1 ring-workx-dark flex items-center justify-center text-[8px] text-white/50" title={name}>
                                {name.charAt(0)}
                              </div>
                            )
                          })}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Afgeronde gesprekken */}
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Icons.check size={12} className="text-green-400" />
                </div>
                <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Afgerond</span>
                <span className="text-xs text-white/20 ml-auto">{allInterviews.filter(i => i.status === 'afgerond').length}</span>
              </div>
              {afgerond.length === 0 ? (
                <p className="text-xs text-white/20">Nog geen gesprekken afgerond</p>
              ) : (
                <div className="space-y-1.5">
                  {afgerond.map(i => {
                    const d = new Date(i.datum)
                    const hasAandachtspunten = !!i.aandachtspunten
                    return (
                      <button
                        key={i.id}
                        onClick={() => setSelectedId(i.applicantId)}
                        className="w-full flex items-center gap-2 text-left hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">{i.applicantNaam}</p>
                          <p className="text-[10px] text-white/30">
                            {d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        {hasAandachtspunten && (
                          <span title="Heeft aandachtspunten">
                            <Icons.alertTriangle size={12} className="text-amber-400/60 flex-shrink-0" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* New applicant form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 p-6 space-y-5">
              <div>
                <h3 className="text-white font-semibold">Nieuwe sollicitant</h3>
                <p className="text-white/30 text-xs mt-1">Upload een CV en/of brief — kerngegevens worden automatisch geëxtraheerd</p>
              </div>

              {/* File uploads - prominent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">CV (PDF, DOCX)</label>
                  <button
                    onClick={() => cvInputRef.current?.click()}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all text-left ${
                      newCvFile
                        ? 'border-workx-lime/30 bg-workx-lime/5'
                        : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      newCvFile ? 'bg-workx-lime/10' : 'bg-white/5'
                    }`}>
                      {newCvFile ? (
                        <Icons.check size={18} className="text-workx-lime" />
                      ) : (
                        <Icons.upload size={18} className="text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {newCvFile ? (
                        <>
                          <p className="text-sm text-workx-lime font-medium truncate">{newCvFile.name}</p>
                          <p className="text-xs text-white/30">{(newCvFile.size / 1024).toFixed(0)} KB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-white/60">CV uploaden</p>
                          <p className="text-xs text-white/20">Klik om bestand te kiezen</p>
                        </>
                      )}
                    </div>
                    {newCvFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setNewCvFile(null); if (cvInputRef.current) cvInputRef.current.value = '' }}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                      >
                        <Icons.x size={14} />
                      </button>
                    )}
                  </button>
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={e => { if (e.target.files?.[0]) setNewCvFile(e.target.files[0]) }}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Motivatiebrief (optioneel)</label>
                  <button
                    onClick={() => briefInputRef.current?.click()}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all text-left ${
                      newBriefFile
                        ? 'border-workx-lime/30 bg-workx-lime/5'
                        : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      newBriefFile ? 'bg-workx-lime/10' : 'bg-white/5'
                    }`}>
                      {newBriefFile ? (
                        <Icons.check size={18} className="text-workx-lime" />
                      ) : (
                        <Icons.upload size={18} className="text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {newBriefFile ? (
                        <>
                          <p className="text-sm text-workx-lime font-medium truncate">{newBriefFile.name}</p>
                          <p className="text-xs text-white/30">{(newBriefFile.size / 1024).toFixed(0)} KB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-white/60">Brief uploaden</p>
                          <p className="text-xs text-white/20">Klik om bestand te kiezen</p>
                        </>
                      )}
                    </div>
                    {newBriefFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setNewBriefFile(null); if (briefInputRef.current) briefInputRef.current.value = '' }}
                        className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                      >
                        <Icons.x size={14} />
                      </button>
                    )}
                  </button>
                  <input
                    ref={briefInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={e => { if (e.target.files?.[0]) setNewBriefFile(e.target.files[0]) }}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Name fallback */}
              <div>
                <label className="block text-xs text-white/40 mb-1">Naam {!newCvFile && '*'}</label>
                <input
                  value={newNaam}
                  onChange={e => setNewNaam(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30"
                  placeholder={newCvFile ? 'Wordt automatisch ingevuld uit CV' : 'Volledige naam'}
                />
                {newCvFile && (
                  <p className="text-[10px] text-workx-lime/50 mt-1">Naam wordt automatisch uit het CV gehaald</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 justify-between">
                {creating && createProgress && (
                  <div className="flex items-center gap-2 text-xs text-workx-lime/70">
                    <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                    {createProgress}
                  </div>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => { setShowNewForm(false); resetForm() }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50 border border-workx-lime/20"
                >
                  {creating ? (
                    <div className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                  ) : (
                    <Icons.sparkles size={14} />
                  )}
                  {newCvFile ? 'Aanmaken & extraheren' : 'Aanmaken'}
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
  const [extracting, setExtracting] = useState(false)
  const [extractedText, setExtractedText] = useState<string | null>(null)

  // Auto-detect document type from filename
  function detectDocType(filename: string): 'cv' | 'brief' | 'overig' {
    const lower = filename.toLowerCase()
    if (lower.includes('cv') || lower.includes('curriculum') || lower.includes('resume')) return 'cv'
    if (lower.includes('brief') || lower.includes('motivatie') || lower.includes('letter')) return 'brief'
    return 'overig'
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const detectedType = detectDocType(file.name)
    setUploading(true)
    try {
      const result = await uploadToBlob(`sollicitaties/${applicant.id}/${file.name}`, file)

      const res = await fetch(`/api/sollicitaties/${applicant.id}/documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: detectedType,
          naam: file.name,
          fileUrl: result.url,
          fileSize: file.size,
        }),
      })

      if (res.ok) {
        toast.success('Document geüpload')

        // If it's a CV or brief, extract text for AI extraction
        if (detectedType === 'cv' || detectedType === 'brief') {
          const text = await extractTextFromFile(file)
          if (text) setExtractedText(text)
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
      {/* Upload + extract actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-sm transition-all disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Icons.plus size={14} />
          )}
          {uploading ? 'Uploaden...' : 'Document toevoegen'}
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 text-sm font-medium transition-all disabled:opacity-50 border border-workx-lime/20"
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

// Shared interviewer picker used by both new and edit forms
function InterviewerPicker({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_TEAM_MEMBERS.map(name => {
        const photo = getPhotoUrl(name)
        const isSelected = selected.includes(name)
        return (
          <button
            key={name}
            onClick={() => onToggle(name)}
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
  )
}

function GesprekkenTab({ applicant, onRefresh }: { applicant: Applicant; onRefresh: () => void }) {
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planDatum, setPlanDatum] = useState<Date | null>(null)
  const [planInterviewers, setPlanInterviewers] = useState<string[]>([])
  const [planning, setPlanning] = useState(false)

  // Edit state — covers date, interviewers, feedback, aandachtspunten
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDatum, setEditDatum] = useState<Date | null>(null)
  const [editInterviewers, setEditInterviewers] = useState<string[]>([])
  const [editFeedback, setEditFeedback] = useState('')
  const [editAandachtspunten, setEditAandachtspunten] = useState('')
  const [saving, setSaving] = useState(false)

  const togglePlanInterviewer = (name: string) => {
    setPlanInterviewers(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const toggleEditInterviewer = (name: string) => {
    setEditInterviewers(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const startEditing = (interview: ApplicantInterview) => {
    setEditingId(interview.id)
    setEditDatum(new Date(interview.datum))
    setEditInterviewers(interview.interviewerNames?.split(', ').filter(Boolean) || [])
    setEditFeedback(interview.feedback || '')
    setEditAandachtspunten(interview.aandachtspunten || '')
  }

  const handlePlan = async () => {
    if (!planDatum) { toast.error('Kies een datum'); return }
    if (planInterviewers.length === 0) { toast.error('Selecteer minimaal één interviewer'); return }

    setPlanning(true)
    try {
      const res = await fetch(`/api/sollicitaties/${applicant.id}/interviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datum: planDatum.toISOString(),
          interviewerNames: planInterviewers.join(', '),
        }),
      })
      if (res.ok) {
        toast.success('Gesprek gepland')
        setShowPlanForm(false)
        setPlanDatum(null)
        setPlanInterviewers([])
        onRefresh()
      }
    } catch {
      toast.error('Kon gesprek niet plannen')
    } finally {
      setPlanning(false)
    }
  }

  const handleSaveEdit = async (interviewId: string) => {
    setSaving(true)
    try {
      await fetch(`/api/sollicitaties/${applicant.id}/interviews/${interviewId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datum: editDatum?.toISOString(),
          interviewerNames: editInterviewers.join(', '),
          feedback: editFeedback,
          aandachtspunten: editAandachtspunten,
          ...(editFeedback.trim() && { status: 'afgerond' }),
        }),
      })
      toast.success('Gesprek bijgewerkt')
      setEditingId(null)
      onRefresh()
    } catch {
      toast.error('Kon gesprek niet bijwerken')
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
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 text-sm font-medium transition-all border border-workx-lime/20"
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
                <label className="block text-xs text-white/40 mb-2">Datum en tijd</label>
                <DatePicker
                  selected={planDatum}
                  onChange={setPlanDatum}
                  showTimeSelect
                  placeholder="Selecteer datum en tijd..."
                  minDate={new Date()}
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">Interviewers</label>
                <InterviewerPicker selected={planInterviewers} onToggle={togglePlanInterviewer} />
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowPlanForm(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-sm transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={handlePlan}
                  disabled={planning}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
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
                {!isEditing ? (
                  <>
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
                        {interview.status !== 'geannuleerd' && (
                          <button
                            onClick={() => startEditing(interview)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                            title="Bewerken"
                          >
                            <Icons.edit size={14} />
                          </button>
                        )}
                        {interview.status === 'gepland' && (
                          <button
                            onClick={() => handleCancelInterview(interview.id)}
                            className="p-1.5 rounded-lg text-yellow-400/30 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                            title="Annuleren"
                          >
                            <Icons.x size={14} />
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

                    {/* Feedback display */}
                    {interview.feedback && (
                      <div className="mt-2">
                        <h5 className="text-xs text-white/40 uppercase tracking-wider mb-1">Feedback</h5>
                        <p className="text-sm text-white/70 whitespace-pre-line">{interview.feedback}</p>
                      </div>
                    )}

                    {/* Aandachtspunten display */}
                    {interview.aandachtspunten && (
                      <div className="mt-2 bg-amber-500/10 border-l-4 border-amber-500/60 rounded-r-lg px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Icons.alertTriangle size={14} className="text-amber-400" />
                          <h5 className="text-xs text-amber-400 uppercase tracking-wider font-medium">Aandachtspunten</h5>
                        </div>
                        <p className="text-sm text-amber-200/80 whitespace-pre-line">{interview.aandachtspunten}</p>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Inline edit form ── */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm text-white font-medium">Gesprek bewerken</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        interview.status === 'gepland' ? 'bg-blue-500/20 text-blue-400' :
                        interview.status === 'afgerond' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {interview.status === 'gepland' ? 'Gepland' :
                         interview.status === 'afgerond' ? 'Afgerond' : 'Geannuleerd'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-2">Datum en tijd</label>
                      <DatePicker
                        selected={editDatum}
                        onChange={setEditDatum}
                        showTimeSelect
                        placeholder="Selecteer datum en tijd..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-2">Interviewers</label>
                      <InterviewerPicker selected={editInterviewers} onToggle={toggleEditInterviewer} />
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-1">Feedback</label>
                      <textarea
                        value={editFeedback}
                        onChange={e => setEditFeedback(e.target.value)}
                        className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/30 resize-none"
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
                        className="w-full h-20 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 resize-none"
                        placeholder="Belangrijke aandachtspunten of zorgen..."
                      />
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-sm transition-all"
                      >
                        Annuleren
                      </button>
                      <button
                        onClick={() => handleSaveEdit(interview.id)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 font-medium text-sm transition-all disabled:opacity-50"
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
