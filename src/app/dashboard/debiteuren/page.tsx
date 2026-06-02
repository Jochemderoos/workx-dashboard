'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface InvoiceLine {
  id: string
  attorneyName: string
  hours: number
  hourlyRate: number
  amount: number
  userId: string | null
  user: { id: string; name: string; avatarUrl: string | null } | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  bookYear: number
  bookPeriod: number
  projectCode: string | null
  projectName: string | null
  clientName: string | null
  issueDate: string | null
  dueDate: string | null
  totalExcl: number
  totalIncl: number
  totalBtw: number
  primaryUserId: string | null
  primaryUser: { id: string; name: string; avatarUrl: string | null } | null
  reminderSentAt: string | null
  importedAt: string
  lines: InvoiceLine[]
}

const MONTHS = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// Corporate kantoren waarvoor we openstaande facturen samenvouwen — anders
// wordt de lijst onleesbaar (Stek heeft typisch 5+ facturen tegelijk open).
const CORPORATE_FIRMS: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'stek', label: 'Stek Advocaten', match: /\bstek\b/i },
  { key: 'debrij', label: 'DeBrij', match: /de\s*brij/i },
  { key: 'vancampenliem', label: 'VanCampen Liem', match: /van\s*campen/i },
  { key: 'jblaw', label: 'JB Law', match: /\bjb\s*law\b/i },
]

function firmKeyFor(inv: { clientName: string | null; projectName: string | null }): string | null {
  const haystack = `${inv.clientName || ''} ${inv.projectName || ''}`
  for (const f of CORPORATE_FIRMS) if (f.match.test(haystack)) return f.key
  return null
}

// Vanaf hoeveel dagen na de vervaltermijn de advocaat aan zet is.
// Daarvoor (dag 0-14) ligt het bij de admin (zie proces-timeline bovenaan).
const ACTION_THRESHOLD_DAYS = 15

function formatEUR(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function periodLabel(year: number, period: number) {
  return `${MONTHS[period] || '?'} ${year}`
}

// Dagen te laat — wanneer dueDate beschikbaar (uit BaseNet Word-export),
// gebruik die exact. Anders fallback op einde boekperiode + 30 dagen.
function daysOverdue(invoice: { dueDate: string | null; bookYear: number; bookPeriod: number }) {
  if (invoice.dueDate) {
    const due = new Date(invoice.dueDate)
    due.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - due.getTime()) / 86400000)
  }
  const periodEnd = new Date(invoice.bookYear, invoice.bookPeriod, 0)
  const diff = (Date.now() - periodEnd.getTime()) / 86400000 - 30
  return Math.floor(diff)
}

function isReminderDue(reminderSentAt: string | null): boolean {
  // Aangeschreven blijft geldig tot volgende PDF-upload. Bij upload wordt
  // reminderSentAt op de server gereset naar null als de factuur nog
  // steeds open staat. Een lokale klik op 'Aangeschreven' verbergt de
  // call-to-action dus tot dan.
  return !reminderSentAt
}

// Factuur is "actief" (oranje, vraagt om actie van advocaat) zodra:
//  - factuur 15+ dagen te laat is, EN
//  - er nog niet is aangeschreven sinds de laatste upload.
// In de eerste 14 dagen ligt het bij de admin → factuur staat grijs.
// Na klik op 'Aangeschreven' → ook grijs. Bij nieuwe upload reset de
// server reminderSentAt → factuur staat weer "aan".
function needsAction(invoice: { dueDate: string | null; bookYear: number; bookPeriod: number; reminderSentAt: string | null }): boolean {
  return daysOverdue(invoice) >= ACTION_THRESHOLD_DAYS && !invoice.reminderSentAt
}

export default function DebiteurenPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const role = (session?.user as { role?: string })?.role
  const isManager = role === 'PARTNER' || role === 'ADMIN'

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'mine' | string>(currentUserId ? 'mine' : 'all')
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ total: number; upserted: number; removed: number; matchedDates?: number; unmatchedAttorneys: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const wordRef = useRef<HTMLInputElement>(null)
  const [pendingPdf, setPendingPdf] = useState<File | null>(null)
  const [pendingWord, setPendingWord] = useState<File | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; avatarUrl: string | null }>>([])
  const [assignMenuId, setAssignMenuId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Externe kantoren waarvoor we facturen samen-vouwen — voorkomt dat
  // bv. 20 Stek-zaken het overzicht vervuilen. Aanschrijven is bij deze
  // partijen niet relevant (loopt via onderling kanaal).
  const COLLAPSIBLE_CLIENTS: { id: string; label: string; patterns: RegExp[] }[] = [
    { id: 'stek', label: 'Stek Advocaten', patterns: [
      /\bstek\b/i,
      /stek[\s-]*advocaten/i,
    ] },
    { id: 'debrij', label: 'DeBrij', patterns: [
      /\bde\s*brij\b/i,
      /\bdebrij\b/i,
    ] },
    { id: 'jblaw', label: 'JB Law', patterns: [
      /\bjb[\s-]*law\b/i,
      /\bjblaw\b/i,
    ] },
    { id: 'vcl', label: 'Van Campen Liem', patterns: [
      /van\s*campen\s*liem/i,
      /\bcampen\s*liem\b/i,
      /\bvancampenliem\b/i,
      /\bvcl\b/i,
    ] },
  ]
  const matchCollapsible = (inv: { clientName?: string | null; projectName?: string | null }) => {
    const hay = `${inv.clientName || ''} ${inv.projectName || ''}`
    return COLLAPSIBLE_CLIENTS.find(c => c.patterns.some(p => p.test(hay))) || null
  }
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const fetchData = useCallback(async () => {
    try {
      const [invRes, teamRes] = await Promise.all([
        fetch('/api/open-invoices'),
        fetch('/api/responsibilities'),
      ])
      if (invRes.ok) setInvoices(await invRes.json())
      if (teamRes.ok) {
        const data = await teamRes.json()
        setTeamMembers(data.teamMembers || [])
      }
    } catch {
      toast.error('Kon facturen niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  const assignPrimary = async (invoiceId: string, userId: string | null) => {
    setInvoices(prev => prev.map(i => {
      if (i.id !== invoiceId) return i
      const u = userId ? teamMembers.find(m => m.id === userId) : null
      return { ...i, primaryUserId: userId, primaryUser: u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl } : null }
    }))
    setAssignMenuId(null)
    try {
      await fetch(`/api/open-invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUserId: userId }),
      })
    } catch {
      toast.error('Kon niet toewijzen')
      fetchData()
    }
  }

  useEffect(() => { fetchData() }, [fetchData])

  // Toon alleen facturen die de betalingstermijn voorbij zijn. Facturen
  // binnen termijn zijn (nog) geen actiepunt en horen niet in dit overzicht.
  const overdueInvoices = useMemo(
    () => invoices.filter(i => daysOverdue(i) >= 0),
    [invoices]
  )

  // Voor het filter-overzicht: lijst van advocaten die als primair gekoppeld zijn
  const attorneys = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl: string | null; count: number; total: number }>()
    for (const inv of overdueInvoices) {
      if (!inv.primaryUser) continue
      const u = inv.primaryUser
      const entry = map.get(u.id) || { id: u.id, name: u.name, avatarUrl: u.avatarUrl, count: 0, total: 0 }
      entry.count++
      entry.total += inv.totalIncl
      map.set(u.id, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [overdueInvoices])

  const filtered = useMemo(() => {
    if (filter === 'all') return overdueInvoices
    if (filter === 'mine') return overdueInvoices.filter(i => i.primaryUserId === currentUserId)
    if (filter === 'unassigned') return overdueInvoices.filter(i => !i.primaryUserId)
    return overdueInvoices.filter(i => i.primaryUserId === filter)
  }, [overdueInvoices, filter, currentUserId])

  // Splits `filtered` in firm-groepen (≥2 facturen per kantoor) + losse facturen.
  // De volgorde van de groepen volgt CORPORATE_FIRMS en komt boven de losse lijst.
  const grouped = useMemo(() => {
    const byKey = new Map<string, Invoice[]>()
    const loose: Invoice[] = []
    for (const inv of filtered) {
      const key = firmKeyFor(inv)
      if (!key) { loose.push(inv); continue }
      const arr = byKey.get(key) || []
      arr.push(inv)
      byKey.set(key, arr)
    }
    const firmGroups: Array<{ key: string; label: string; invoices: Invoice[] }> = []
    for (const firm of CORPORATE_FIRMS) {
      const list = byKey.get(firm.key) || []
      if (list.length >= 2) {
        firmGroups.push({ key: firm.key, label: firm.label, invoices: list })
      } else {
        // <2 → toon individueel als losse factuur
        loose.push(...list)
      }
    }
    return { firmGroups, loose }
  }, [filtered])

  const totals = useMemo(() => {
    const total = filtered.reduce((s, i) => s + i.totalIncl, 0)
    const dueReminder = filtered.filter(needsAction).length
    return { total, count: filtered.length, dueReminder }
  }, [filtered])

  const markReminded = async (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, reminderSentAt: new Date().toISOString() } : i))
    try {
      await fetch(`/api/open-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-reminded' }),
      })
    } catch {
      toast.error('Kon niet markeren')
      fetchData()
    }
  }

  const resetReminder = async (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, reminderSentAt: null } : i))
    try {
      await fetch(`/api/open-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-reminder' }),
      })
    } catch {
      toast.error('Kon niet wijzigen')
      fetchData()
    }
  }

  const removeInvoice = async (id: string) => {
    if (!confirm('Factuur uit overzicht verwijderen?')) return
    try {
      await fetch(`/api/open-invoices/${id}`, { method: 'DELETE' })
      setInvoices(prev => prev.filter(i => i.id !== id))
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const handleImport = async (pdfFile: File, wordFile?: File | null) => {
    setImporting(true)
    setImportResult(null)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const buf = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(it => ('str' in it ? it.str : '')).join('\n') + '\n'
      }
      pdf.destroy()

      // Optioneel: parse de Word met mammoth (client-side via dynamic import)
      let wordText = ''
      if (wordFile) {
        // @ts-expect-error — mammoth.browser heeft geen .d.ts maar werkt prima
        const mammoth = await import('mammoth/mammoth.browser')
        const wbuf = await wordFile.arrayBuffer()
        const out = await mammoth.extractRawText({ arrayBuffer: wbuf })
        wordText = out.value
      }

      const res = await fetch('/api/open-invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, wordText }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Import mislukt')
        return
      }
      setImportResult(data)
      await fetchData()
      toast.success(`${data.upserted} facturen bijgewerkt${data.removed > 0 ? `, ${data.removed} betaald (weg)` : ''}`)
    } catch (err) {
      console.error('Import error:', err)
      const msg = err instanceof Error ? err.message : 'onbekende fout'
      toast.error(`Import mislukt: ${msg}`, { duration: 8000 })
    } finally {
      setImporting(false)
    }
  }

  if (!session) return null

  return (
    <div className="min-h-screen relative">
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-6 relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.euro size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Openstaande debiteuren</h1>
            <p className="text-sm text-white/40">Uit BaseNet · gekoppeld aan advocaat met meeste uren · upload PDF opnieuw om bij te werken</p>
          </div>
        </div>
        {isManager && (
          <div className="relative">
            <button
              onClick={() => { setShowImport(v => !v); if (!showImport) setImportResult(null) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime text-sm font-medium border border-workx-lime/30 hover:bg-workx-lime/20 transition-colors"
            >
              <Icons.upload size={14} />
              Importeer BaseNet rapporten
            </button>
            {showImport && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { if (!importing) setShowImport(false) }} />
                <div className="absolute right-0 top-full mt-2 w-[min(420px,calc(100vw-2rem))] z-40 bg-workx-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">BaseNet rapporten importeren</h2>
                      <p className="text-[11px] text-gray-400 mt-0.5">Overzicht Openstaande debiteuren</p>
                    </div>
                    <button onClick={() => { if (!importing) setShowImport(false) }} className="p-1 rounded text-gray-500 hover:text-white">
                      <Icons.x size={14} />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* PDF input */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-500">PDF — 'Overzicht openstaande debiteuren'</label>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => setPendingPdf(e.target.files?.[0] || null)}
                        disabled={importing}
                        className="block w-full text-xs text-gray-400 file:mr-2 file:px-3 file:py-1 file:rounded-lg file:border-0 file:bg-workx-lime/10 file:text-workx-lime file:text-xs file:font-medium hover:file:bg-workx-lime/20 file:cursor-pointer"
                      />
                    </div>
                    {/* Word input (optioneel — voor exacte data) */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-gray-500">
                        Word — overzicht met data <span className="text-gray-600 normal-case">(optioneel, voor exacte vervaldatum)</span>
                      </label>
                      <input
                        ref={wordRef}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => setPendingWord(e.target.files?.[0] || null)}
                        disabled={importing}
                        className="block w-full text-xs text-gray-400 file:mr-2 file:px-3 file:py-1 file:rounded-lg file:border-0 file:bg-white/10 file:text-gray-300 file:text-xs file:font-medium hover:file:bg-white/20 file:cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => { if (pendingPdf) handleImport(pendingPdf, pendingWord) }}
                      disabled={!pendingPdf || importing}
                      className="w-full px-3 py-2 rounded-lg bg-workx-lime text-workx-dark text-xs font-medium hover:bg-workx-lime/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {importing && <div className="w-3 h-3 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />}
                      {importing ? 'Verwerken…' : 'Importeren'}
                    </button>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Volledige sync: facturen die niet meer in de PDF staan worden weggehaald (presumed betaald). Reminder-status blijft behouden. Met Word erbij wordt de exacte vervaldatum gebruikt voor "dagen te laat".
                    </p>
                    {importResult && (
                      <div className="bg-workx-lime/10 border border-workx-lime/30 rounded-lg p-2 text-[11px]">
                        <p className="text-workx-lime font-medium">
                          {importResult.upserted} bijgewerkt · {importResult.removed} weggehaald
                          {typeof importResult.matchedDates === 'number' && importResult.matchedDates > 0 && (
                            <> · {importResult.matchedDates} exacte vervaldatums gekoppeld</>
                          )}
                        </p>
                        {importResult.unmatchedAttorneys.length > 0 && (
                          <p className="text-orange-300 mt-1">
                            Niet gekoppeld: {importResult.unmatchedAttorneys.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Debiteurenproces - strakke timeline */}
      <div className="mb-6 relative bg-gradient-to-br from-workx-lime/5 via-workx-dark/40 to-workx-dark/40 border border-workx-lime/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-workx-lime/20 flex items-center justify-center">
            <Icons.activity size={16} className="text-workx-lime" />
          </div>
          <h2 className="text-base font-semibold text-white">Het debiteurenproces</h2>
          <span className="ml-2 text-xs text-gray-500">Wie doet wat, wanneer</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-2 relative">
          {/* Stap 1 */}
          <div className="relative bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-workx-lime text-workx-dark text-sm font-bold mb-3 relative z-10 mx-auto md:mx-0">
              0
            </div>
            <p className="text-[10px] uppercase tracking-wider text-workx-lime/80 font-medium mb-1 text-center md:text-left">Dag 0</p>
            <p className="text-sm font-semibold text-white mb-1 text-center md:text-left">Termijn verloopt</p>
            <p className="text-xs text-white/60 leading-relaxed text-center md:text-left">
              De betalingstermijn op de factuur is verstreken. Vanaf nu loopt de teller.
            </p>
          </div>

          {/* Stap 2 */}
          <div className="relative bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-sm font-bold mb-3 relative z-10 mx-auto md:mx-0">
              +5
            </div>
            <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-medium mb-1 text-center md:text-left">+5 dagen</p>
            <p className="text-sm font-semibold text-white mb-1 text-center md:text-left">Admin: 1ᵉ reminder</p>
            <p className="text-xs text-white/60 leading-relaxed text-center md:text-left">
              Admin stuurt eerste reminder met de <span className="text-cyan-300 font-medium">advocaat in CC</span>.
            </p>
          </div>

          {/* Stap 3 */}
          <div className="relative bg-white/[0.03] border border-orange-400/30 rounded-xl p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/30 border border-orange-400/50 text-orange-300 text-sm font-bold mb-3 relative z-10 mx-auto md:mx-0">
              +15
            </div>
            <p className="text-[10px] uppercase tracking-wider text-orange-300/80 font-medium mb-1 text-center md:text-left">+15 dagen</p>
            <p className="text-sm font-semibold text-white mb-1 text-center md:text-left">Advocaat: afstemmen</p>
            <p className="text-xs text-white/60 leading-relaxed text-center md:text-left">
              Staat factuur nog op <span className="text-red-300 font-medium">NIET VOLDAAN</span>? Advocaat checkt stand met admin. <span className="text-workx-lime font-medium">Uitgangspunt: advocaat neemt over.</span>
            </p>
          </div>

          {/* Stap 4 */}
          <div className="relative bg-workx-lime/10 border border-workx-lime/40 rounded-xl p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-workx-lime text-workx-dark text-sm font-bold mb-3 relative z-10 mx-auto md:mx-0">
              <Icons.user size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-workx-lime font-medium mb-1 text-center md:text-left">Vanaf dan</p>
            <p className="text-sm font-semibold text-white mb-1 text-center md:text-left">Advocaat aan zet</p>
            <p className="text-xs text-white/60 leading-relaxed text-center md:text-left">
              Bal ligt nu bij de advocaat. Verantwoordelijk voor verdere reminders en escalatie.
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-gray-500 italic flex items-start gap-2">
          <Icons.info size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Pas als de advocaat afstemt en aangeeft dat admin het nog even oppakt blijft het bij admin — anders is uitgangspunt dat advocaat het overneemt.
          </span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl py-16 text-center">
          <Icons.fileText size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">Nog geen facturen geïmporteerd.</p>
          {isManager && (
            <button
              onClick={() => setShowImport(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90"
            >
              Upload BaseNet rapporten
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mijn debiteuren — persoonlijk overzicht voor ingelogde gebruiker */}
          {(() => {
            const mine = overdueInvoices.filter(i => i.primaryUserId === currentUserId)
            if (mine.length === 0) return null
            // Sorteer oudste eerst
            const sorted = [...mine].sort((a, b) => daysOverdue(b) - daysOverdue(a))
            // Leeftijds-buckets — alleen te-late facturen, 'binnen termijn' is uitgefilterd
            const buckets = [
              { key: '0-30', label: '< 30 dgn te laat', max: 30, color: 'text-yellow-300', bg: 'bg-yellow-500/5 border-yellow-500/20' },
              { key: '30-60', label: '30–60 dgn te laat', max: 60, color: 'text-orange-300', bg: 'bg-orange-500/5 border-orange-500/20' },
              { key: '60-90', label: '60–90 dgn te laat', max: 90, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
              { key: '90-180', label: '90–180 dgn te laat', max: 180, color: 'text-red-300', bg: 'bg-red-500/5 border-red-500/20' },
              { key: '180+', label: '180+ dgn te laat', max: Infinity, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
            ] as const
            const bucketOf = (age: number) => {
              for (const b of buckets) if (age < b.max) return b
              return buckets[buckets.length - 1]
            }
            const totals = buckets.map(b => {
              const items = sorted.filter(i => bucketOf(daysOverdue(i)).key === b.key)
              return { ...b, count: items.length, sum: items.reduce((s, i) => s + i.totalIncl, 0) }
            })
            const totalMine = mine.reduce((s, i) => s + i.totalIncl, 0)
            const dueMine = mine.filter(needsAction).length

            return (
              <div className="mb-6 bg-gradient-to-br from-workx-lime/10 via-workx-lime/5 to-transparent border border-workx-lime/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-workx-lime/20 flex items-center justify-center">
                      <Icons.user size={14} className="text-workx-lime" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Mijn openstaande debiteuren</h2>
                      <p className="text-[10px] text-gray-500">
                        {mine.length} factu(u)r(en) · {formatEUR(totalMine)}
                        {dueMine > 0 && <span className="text-orange-400 ml-2">· {dueMine} reminder nodig</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aging buckets */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  {totals.map(b => (
                    <div key={b.key} className={`rounded-xl p-2.5 border ${b.bg}`}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{b.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${b.color}`}>{b.count}</p>
                      {b.count > 0 && <p className="text-[10px] text-gray-500 tabular-nums">{formatEUR(b.sum)}</p>}
                    </div>
                  ))}
                </div>

                {/* Lijst — oudste eerst, met collapsing voor Stek/DeBrij/JB Law/Van Campen Liem */}
                {(() => {
                  const renderInvRow = (inv: Invoice) => {
                    const age = daysOverdue(inv)
                    const b = bucketOf(age)
                    const isActive = needsAction(inv)
                    const inAdminWindow = age < ACTION_THRESHOLD_DAYS && !inv.reminderSentAt
                    const barPct = age > 0 ? Math.min(100, Math.round((age / 200) * 100)) : 0
                    return (
                      <div key={inv.id} className={`relative rounded-xl border ${b.bg} hover:bg-white/[0.04] transition-colors overflow-hidden ${!isActive ? 'opacity-50' : ''}`}>
                        <div className={`absolute inset-y-0 left-0 ${b.color.replace('text-', 'bg-').replace('-300', '-500/10').replace('-400', '-500/15')}`} style={{ width: `${barPct}%` }} />
                        <div className="relative flex items-center gap-3 px-3 py-2">
                          <span className={`text-[10px] font-medium tabular-nums w-20 shrink-0 ${b.color}`}>
                            {age < 0 ? 'binnen termijn' : age === 0 ? 'vandaag' : `${age} dgn te laat`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${!isActive ? 'text-gray-400' : 'text-white'}`}>
                              {inv.projectName || inv.clientName || `#${inv.invoiceNumber}`}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              #{inv.invoiceNumber} · {MONTHS[inv.bookPeriod]} {inv.bookYear}
                              {inv.reminderSentAt && (
                                <span className="ml-2 text-gray-600">
                                  · aangeschreven {new Date(inv.reminderSentAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {inAdminWindow && (
                                <span className="ml-2 text-cyan-400/70" title="Eerste 14 dagen — admin handelt af">
                                  · bij admin
                                </span>
                              )}
                            </p>
                          </div>
                          <span className={`text-sm font-medium tabular-nums shrink-0 ${!isActive ? 'text-gray-500' : 'text-workx-lime'}`}>{formatEUR(inv.totalIncl)}</span>
                          {isActive ? (
                            <button
                              onClick={() => markReminded(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 text-[11px] font-medium hover:bg-orange-500/30 transition-colors shrink-0"
                              title="Markeer als aangeschreven — blijft uit tot volgende PDF-upload"
                            >
                              Aanschrijven
                            </button>
                          ) : inv.reminderSentAt ? (
                            <button
                              onClick={() => resetReminder(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[11px] font-medium hover:bg-orange-500/15 hover:text-orange-300 transition-colors shrink-0"
                              title="Klik om reminder weer aan te zetten"
                            >
                              ✓ Aangeschreven
                            </button>
                          ) : (
                            <span
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400/70 text-[11px] font-medium shrink-0"
                              title={`Eerste 14 dagen na vervaltermijn — admin handelt af. Wordt actief vanaf dag ${ACTION_THRESHOLD_DAYS}.`}
                            >
                              Bij admin
                            </span>
                          )}
                          {isManager && (
                            <button
                              onClick={async () => { if (confirm('Factuur op betaald zetten? Wordt uit het overzicht verwijderd.')) await removeInvoice(inv.id) }}
                              className="px-2.5 py-1 rounded-lg bg-green-500/15 text-green-300 text-[11px] font-medium hover:bg-green-500/25 transition-colors shrink-0"
                              title="Markeer als betaald — verwijdert uit overzicht (geschiedenis blijft tot volgende PDF-upload)"
                            >
                              Betaald
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // Splits in: reguliere + groepen voor specifieke externe kantoren
                  const groupedMap = new Map<string, Invoice[]>()
                  COLLAPSIBLE_CLIENTS.forEach(c => groupedMap.set(c.id, []))
                  const ungrouped: Invoice[] = []
                  for (const inv of sorted) {
                    const m = matchCollapsible(inv)
                    if (m) groupedMap.get(m.id)!.push(inv)
                    else ungrouped.push(inv)
                  }

                  return (
                    <div className="space-y-1.5">
                      {ungrouped.map(renderInvRow)}
                      {COLLAPSIBLE_CLIENTS.map(c => {
                        const items = groupedMap.get(c.id) || []
                        if (items.length === 0) return null
                        const expanded = expandedGroups.has(c.id)
                        const sum = items.reduce((s, i) => s + i.totalIncl, 0)
                        const overdueItems = items.filter(i => daysOverdue(i) > 0)
                        // Periode: oudste t/m nieuwste due-date (val. terug op issueDate)
                        const dates = items
                          .map(i => i.dueDate || i.issueDate)
                          .filter((d): d is string => !!d)
                          .map(d => new Date(d))
                          .sort((a, b) => a.getTime() - b.getTime())
                        const fmtShort = (d: Date) =>
                          d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })
                        const period = dates.length > 0
                          ? dates.length === 1
                            ? fmtShort(dates[0])
                            : `${fmtShort(dates[0])} — ${fmtShort(dates[dates.length - 1])}`
                          : null
                        return (
                          <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                            <button
                              onClick={() => toggleGroup(c.id)}
                              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                              title={`${c.label} — niet zelf aanschrijven`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Icons.chevronRight
                                  size={14}
                                  className={`text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-white">{c.label}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {overdueItems.length} te laat van {items.length} openstaand
                                    {period && <> · {period}</>}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm tabular-nums text-gray-400 shrink-0">{formatEUR(sum)}</span>
                            </button>
                            {expanded && (
                              <div className="space-y-1.5 px-2 pb-2 pt-1">
                                {items.map(renderInvRow)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Totaal openstaand</p>
              <p className="text-2xl font-bold text-workx-lime">{formatEUR(totals.total)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Aantal facturen</p>
              <p className="text-2xl font-bold text-white">{totals.count}</p>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4">
              <p className="text-xs text-orange-300/70 mb-1">Reminder nodig</p>
              <p className="text-2xl font-bold text-orange-400">{totals.dueReminder}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Unieke advocaten</p>
              <p className="text-2xl font-bold text-white">{attorneys.length}</p>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilter('mine')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === 'mine' ? 'bg-workx-lime text-workx-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Mijn facturen
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === 'all' ? 'bg-workx-lime text-workx-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Alle ({overdueInvoices.length})
            </button>
            <button
              onClick={() => setFilter('unassigned')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === 'unassigned' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Niet toegewezen
            </button>
            <span className="text-xs text-gray-700 mx-1">·</span>
            {attorneys.map(a => (
              <button
                key={a.id}
                onClick={() => setFilter(a.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
                  filter === a.id ? 'bg-workx-lime/15 text-workx-lime border border-workx-lime/40' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                }`}
                title={`${a.count} factu(u)r(en), ${formatEUR(a.total)}`}
              >
                {getPhotoUrl(a.name) ? (
                  <img loading="lazy" src={getPhotoUrl(a.name)!} alt={a.name} className="w-4 h-4 rounded object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold">{a.name.charAt(0)}</div>
                )}
                <span>{a.name.split(' ')[0]}</span>
                <span className="text-gray-500">·{a.count}</span>
              </button>
            ))}
          </div>

          {/* Invoice list */}
          <div className="space-y-2">
            {(() => {
              const renderInvoiceCard = (inv: Invoice) => {
              const age = daysOverdue(inv)
              const isActive = needsAction(inv)
              const inAdminWindow = age < ACTION_THRESHOLD_DAYS && !inv.reminderSentAt
              return (
                <div key={inv.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden transition-opacity ${
                  isActive ? 'border-orange-500/30' : 'border-white/10 opacity-60'
                }`}>
                  {/* Hoofdrij */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">#{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className="text-[10px] text-gray-500">{periodLabel(inv.bookYear, inv.bookPeriod)}</span>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className={`text-[10px] ${age > 180 ? 'text-red-400' : age > 90 ? 'text-orange-400' : age > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {age < 0 ? 'binnen termijn' : age === 0 ? 'vandaag verlopen' : `${age} dgn te laat`}
                        </span>
                        {isActive ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">
                            AANSCHRIJVEN
                          </span>
                        ) : inv.reminderSentAt ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 font-medium">
                            ✓ AANGESCHREVEN {new Date(inv.reminderSentAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : inAdminWindow ? (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300/80 font-medium"
                            title={`Eerste 14 dagen — admin stuurt 1ᵉ reminder. Wordt actief vanaf dag ${ACTION_THRESHOLD_DAYS}.`}
                          >
                            BIJ ADMIN
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white font-medium truncate mt-0.5">
                        {inv.projectName || inv.invoiceNumber} {inv.projectCode && <span className="text-[10px] text-gray-500">· {inv.projectCode}</span>}
                      </p>
                      {inv.clientName && <p className="text-xs text-gray-500 truncate">{inv.clientName}</p>}
                    </div>

                    {/* Primary attorney — klikbaar om te wijzigen (managers) */}
                    <div className="relative">
                      <button
                        onClick={() => isManager && setAssignMenuId(assignMenuId === inv.id ? null : inv.id)}
                        disabled={!isManager}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors ${
                          inv.primaryUser
                            ? 'bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20'
                            : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-dashed border-orange-500/30'
                        } ${!isManager && 'cursor-default'}`}
                        title={isManager ? 'Klik om advocaat te wijzigen' : ''}
                      >
                        {inv.primaryUser ? (
                          <>
                            {getPhotoUrl(inv.primaryUser.name) ? (
                              <img loading="lazy" src={getPhotoUrl(inv.primaryUser.name)!} alt={inv.primaryUser.name} className="w-5 h-5 rounded object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded bg-workx-lime/20 flex items-center justify-center text-[10px] font-bold">{inv.primaryUser.name.charAt(0)}</div>
                            )}
                            <span>{inv.primaryUser.name.split(' ')[0]}</span>
                          </>
                        ) : (
                          <>
                            <Icons.userPlus size={10} />
                            <span>Niet gekoppeld</span>
                          </>
                        )}
                        {isManager && <Icons.chevronDown size={10} className="opacity-60" />}
                      </button>
                      {assignMenuId === inv.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setAssignMenuId(null)} />
                          <div className="absolute right-0 mt-1 w-56 max-h-72 overflow-y-auto bg-workx-dark border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                              Wijs advocaat toe
                            </div>
                            {inv.primaryUserId && (
                              <button
                                onClick={() => assignPrimary(inv.id, null)}
                                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
                              >
                                <Icons.x size={12} />
                                Loskoppelen
                              </button>
                            )}
                            {teamMembers.map(m => (
                              <button
                                key={m.id}
                                onClick={() => assignPrimary(inv.id, m.id)}
                                className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2 ${
                                  m.id === inv.primaryUserId ? 'bg-workx-lime/10 text-workx-lime' : 'text-white'
                                }`}
                              >
                                {getPhotoUrl(m.name) ? (
                                  <img loading="lazy" src={getPhotoUrl(m.name)!} alt={m.name} className="w-5 h-5 rounded object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">{m.name.charAt(0)}</div>
                                )}
                                <span className="flex-1">{m.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-workx-lime tabular-nums">{formatEUR(inv.totalIncl)}</p>
                      <p className="text-[10px] text-gray-500">excl. BTW {formatEUR(inv.totalExcl)}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive ? (
                        <button
                          onClick={() => markReminded(inv.id)}
                          className="px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-300 text-xs font-medium hover:bg-orange-500/25 transition-colors"
                          title="Markeer als aangeschreven — blijft grijs tot volgende PDF-upload"
                        >
                          Aanschrijven
                        </button>
                      ) : inv.reminderSentAt ? (
                        <button
                          onClick={() => resetReminder(inv.id)}
                          className="px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-orange-400 transition-colors"
                          title="Toch nog niet aangeschreven? Klik om weer in alarm te zetten"
                        >
                          Reset
                        </button>
                      ) : null}
                      {isManager && (
                        <button
                          onClick={async () => { if (confirm('Factuur op betaald zetten? Wordt uit het overzicht verwijderd.')) await removeInvoice(inv.id) }}
                          className="px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-300 text-xs font-medium hover:bg-green-500/25 transition-colors"
                          title="Markeer als betaald — verwijdert uit overzicht"
                        >
                          Betaald
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Uitklapbare uitsplitsing per advocaat — voor afstemming met collega's */}
                  {inv.lines.length > 1 && (
                    <details className="border-t border-white/5 group">
                      <summary className="px-4 py-2 text-[11px] text-gray-500 cursor-pointer hover:text-white transition-colors select-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                        Wie heeft op deze factuur gewerkt? ({inv.lines.length} advocaten)
                      </summary>
                      <div className="px-4 pb-3">
                        <table className="w-full text-xs">
                          <tbody>
                            {inv.lines.map(l => {
                              const isPrimary = l.userId && l.userId === inv.primaryUserId
                              return (
                                <tr key={l.id} className={`border-t border-white/5 ${isPrimary ? 'bg-workx-lime/5' : ''}`}>
                                  <td className="py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      {l.user && getPhotoUrl(l.user.name) ? (
                                        <img loading="lazy" src={getPhotoUrl(l.user.name)!} alt={l.user.name} className="w-4 h-4 rounded object-cover" />
                                      ) : (
                                        <div className="w-4 h-4 rounded bg-white/10" />
                                      )}
                                      <span className={isPrimary ? 'text-workx-lime font-medium' : 'text-white/80'}>
                                        {l.user?.name || l.attorneyName}
                                      </span>
                                      {isPrimary && <span className="text-[9px] text-workx-lime/70 uppercase">primair</span>}
                                    </div>
                                  </td>
                                  <td className="py-1.5 text-right text-gray-400 tabular-nums">{l.hours.toFixed(1)} u</td>
                                  <td className="py-1.5 text-right text-gray-500 tabular-nums">×{formatEUR(l.hourlyRate)}</td>
                                  <td className="py-1.5 text-right text-workx-lime/80 tabular-nums">{formatEUR(l.amount)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              )
              }

              return (
                <>
                  {/* Gegroepeerde corporate kantoren — samengevouwen totdat je klikt */}
                  {grouped.firmGroups.map(group => {
                    const ages = group.invoices.map(daysOverdue)
                    const minAge = Math.min(...ages)
                    const maxAge = Math.max(...ages)
                    const totalAmount = group.invoices.reduce((s, i) => s + i.totalIncl, 0)
                    const actionCount = group.invoices.filter(needsAction).length
                    const ageLabel = minAge === maxAge ? `${minAge} dgn te laat` : `${minAge}–${maxAge} dgn te laat`
                    const ageColor = maxAge > 180 ? 'text-red-400' : maxAge > 90 ? 'text-orange-400' : 'text-yellow-400'
                    return (
                      <details
                        key={`group-${group.key}`}
                        className={`bg-white/[0.03] border rounded-2xl overflow-hidden group ${
                          actionCount > 0 ? 'border-orange-500/30' : 'border-white/10'
                        }`}
                      >
                        <summary className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none flex items-center gap-3 list-none">
                          <span className="group-open:rotate-90 transition-transform inline-block text-gray-500">›</span>
                          <div className="w-9 h-9 rounded-xl bg-workx-lime/10 text-workx-lime flex items-center justify-center font-bold text-sm shrink-0">
                            {group.label.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{group.label}</span>
                              <span className="text-[11px] text-gray-500">
                                {group.invoices.length} facturen
                              </span>
                              <span className="text-[10px] text-gray-600">·</span>
                              <span className={`text-[11px] ${ageColor}`}>{ageLabel}</span>
                              {actionCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">
                                  {actionCount} AANSCHRIJVEN
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">Klik om individuele facturen te zien</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-workx-lime tabular-nums">{formatEUR(totalAmount)}</p>
                            <p className="text-[10px] text-gray-500">totaal openstaand</p>
                          </div>
                        </summary>
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
                          {group.invoices.map(renderInvoiceCard)}
                        </div>
                      </details>
                    )
                  })}

                  {/* Losse facturen — alles wat niet onder een corporate kantoor valt */}
                  {grouped.loose.map(renderInvoiceCard)}
                </>
              )
            })()}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-500">Geen facturen in dit filter.</div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
