'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/ui/Icons'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

interface Source {
  id: string
  name: string
  type: string
  description: string | null
  url: string | null
  category: string
  isActive: boolean
  isProcessed: boolean
  lastSynced: string | null
  processedAt: string | null
  pagesCrawled: number
  hasCredentials: boolean
  createdAt: string
}

const CATEGORIES = [
  { value: 'arbeidsrecht', label: 'Arbeidsrecht' },
  { value: 'civielrecht', label: 'Civiel recht' },
  { value: 'procesrecht', label: 'Procesrecht' },
  { value: 'sociaalzekerheid', label: 'Sociale zekerheid' },
  { value: 'cao', label: 'CAO / collectief' },
  { value: 'rechtspraak', label: 'Rechtspraak' },
  { value: 'overig', label: 'Overig' },
]

const SOURCE_PRESETS = [
  {
    name: 'VAAN AR Updates',
    type: 'website',
    url: 'https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus',
    category: 'rechtspraak',
    description: 'Recente arbeidsrechtelijke uitspraken via de Vereniging Arbeidsrecht Advocaten Nederland',
    requiresLogin: true,
  },
  {
    name: 'UWV Werkgevers',
    type: 'website',
    url: 'https://www.uwv.nl/werkgevers',
    category: 'sociaalzekerheid',
    description: 'UWV informatie voor werkgevers over ontslag, ziekte en uitkeringen',
    requiresLogin: false,
  },
  {
    name: 'SDU Arbeidsrecht',
    type: 'website',
    url: 'https://www.sdu.nl/arbeidsrecht',
    category: 'arbeidsrecht',
    description: 'Vakliteratuur en commentaren arbeidsrecht',
    requiresLogin: true,
  },
  {
    name: 'Kantonrechter.nl',
    type: 'website',
    url: 'https://www.kantonrechter.nl/',
    category: 'rechtspraak',
    description: 'Arbeidsrechtzaken en kantonrechterbeschikkingen',
    requiresLogin: false,
  },
  {
    name: 'InView — Tijdschrift Arbeidsrecht',
    type: 'website',
    url: 'https://www.inview.nl/tijdschriften/tijdschrift-voor-arbeidsrecht',
    category: 'arbeidsrecht',
    description: 'Wetenschappelijke artikelen en annotaties over arbeidsrecht via InView (Wolters Kluwer)',
    requiresLogin: true,
  },
  {
    name: 'InView — RAR',
    type: 'website',
    url: 'https://www.inview.nl/tijdschriften/rechtspraak-arbeidsrecht',
    category: 'rechtspraak',
    description: 'Rechtspraak Arbeidsrecht (RAR) — systematische selectie en annotaties van arbeidsrechtelijke uitspraken',
    requiresLogin: true,
  },
  {
    name: 'InView — JAR',
    type: 'website',
    url: 'https://www.inview.nl/tijdschriften/jurisprudentie-arbeidsrecht',
    category: 'rechtspraak',
    description: 'Jurisprudentie Arbeidsrecht (JAR) — belangrijkste arbeidsrechtelijke jurisprudentie met annotaties',
    requiresLogin: true,
  },
]

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']
const MAX_SIZE = 25 * 1024 * 1024 // 25MB for sources

export default function SourcesManager() {
  const [sources, setSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [addMode, setAddMode] = useState<'website' | 'document'>('website')
  const [isSaving, setIsSaving] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { confirm, ConfirmDialogComponent } = useConfirm()

  const [formData, setFormData] = useState({
    name: '',
    type: 'website',
    description: '',
    url: '',
    category: 'arbeidsrecht',
    hasCredentials: false,
    credentialEmail: '',
    credentialPassword: '',
    credentialCookie: '',
    credentialToken: '',
  })

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/claude/sources')
      if (res.ok) {
        const data = await res.json()
        setSources(data)

        // Auto-process unprocessed sources with content
        const hasUnprocessed = data.some((s: Source) => s.isActive && !s.isProcessed)
        if (hasUnprocessed) {
          autoProcessSources()
        }
      }
    } catch {
      toast.error('Kon bronnen niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const autoProcessSources = async () => {
    try {
      const res = await fetch('/api/claude/sources/auto-process', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.processed > 0) {
          toast.success(`${data.processed} bron${data.processed !== 1 ? 'nen' : ''} automatisch verwerkt!`)
          // Refresh source list to show updated status
          const sourcesRes = await fetch('/api/claude/sources')
          if (sourcesRes.ok) {
            setSources(await sourcesRes.json())
          }
        }
      }
    } catch {
      // Silent fail for auto-processing
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'website',
      description: '',
      url: '',
      category: 'arbeidsrecht',
      hasCredentials: false,
      credentialEmail: '',
      credentialPassword: '',
      credentialCookie: '',
      credentialToken: '',
    })
    setShowAddForm(false)
    setShowPresets(false)
  }

  const applyPreset = (preset: typeof SOURCE_PRESETS[0]) => {
    setFormData({
      ...formData,
      name: preset.name,
      type: preset.type,
      url: preset.url,
      category: preset.category,
      description: preset.description,
      hasCredentials: preset.requiresLogin,
    })
    setAddMode('website')
    setShowPresets(false)
    setShowAddForm(true)
  }

  const addWebsiteSource = async () => {
    if (!formData.name.trim()) {
      toast.error('Vul een naam in')
      return
    }

    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        type: 'website',
        description: formData.description || null,
        url: formData.url || null,
        category: formData.category,
      }

      if (formData.hasCredentials) {
        body.credentials = {
          email: formData.credentialEmail || undefined,
          password: formData.credentialPassword || undefined,
          cookie: formData.credentialCookie || undefined,
          token: formData.credentialToken || undefined,
        }
      }

      const res = await fetch('/api/claude/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kon bron niet toevoegen')
      }

      const source = await res.json()
      setSources([source, ...sources])
      resetForm()
      toast.success(`${formData.name} toegevoegd!`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kon bron niet toevoegen'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const uploadDocumentSource = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Bestandstype .${ext} niet ondersteund. Toegestaan: ${ALLOWED_EXTENSIONS.join(', ')}`)
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('Bestand is te groot (max 25MB)')
      return
    }

    setIsSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', formData.name.trim() || file.name.replace(/\.[^.]+$/, ''))
      if (formData.description) fd.append('description', formData.description)
      fd.append('category', formData.category)

      const res = await fetch('/api/claude/sources', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload mislukt')
      }

      const source = await res.json()
      setSources([source, ...sources])
      resetForm()
      toast.success(`${file.name} toegevoegd als bron!`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload mislukt'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const syncSource = async (id: string) => {
    setSyncingId(id)
    try {
      const res = await fetch(`/api/claude/sources/${id}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Synchronisatie mislukt')
      }

      // Update source in list
      setSources(sources.map(s =>
        s.id === id
          ? { ...s, lastSynced: data.lastSynced }
          : s
      ))
      toast.success(`Bron gesynchroniseerd (${data.contentLength} tekens)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Synchronisatie mislukt'
      toast.error(message)
    } finally {
      setSyncingId(null)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/claude/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (res.ok) {
        setSources(sources.map(s =>
          s.id === id ? { ...s, isActive: !isActive } : s
        ))
      }
    } catch {
      toast.error('Kon status niet wijzigen')
    }
  }

  const deleteSource = async (id: string) => {
    const source = sources.find(s => s.id === id)
    const confirmed = await confirm({
      title: 'Bron verwijderen',
      message: `Weet je zeker dat je "${source?.name || 'deze bron'}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
      confirmText: 'Verwijderen',
      type: 'danger',
    })
    if (!confirmed) return
    try {
      await fetch(`/api/claude/sources/${id}`, { method: 'DELETE' })
      setSources(sources.filter(s => s.id !== id))
      toast.success('Bron verwijderd')
    } catch {
      toast.error('Kon bron niet verwijderen')
    }
  }

  const processSource = async (id: string, deepCrawl: boolean = false) => {
    setProcessingId(id)
    const source = sources.find(s => s.id === id)
    setProcessingStatus(`${deepCrawl ? 'Pagina\'s crawlen' : 'Content analyseren'}...`)

    try {
      // Step 1: Sync first if website
      if (source?.type === 'website' && source.url && !deepCrawl) {
        setProcessingStatus('Content ophalen...')
        await fetch(`/api/claude/sources/${id}`, { method: 'POST' })
      }

      // Step 2: Process with Claude
      setProcessingStatus(deepCrawl ? 'Website crawlen en verwerken...' : 'Claude analyseert de bron...')
      const res = await fetch(`/api/claude/sources/${id}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepCrawl }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verwerking mislukt')

      setProcessingStatus('Kennis opgeslagen!')

      // Update source in list
      setSources(sources.map(s =>
        s.id === id
          ? {
              ...s,
              isProcessed: true,
              processedAt: data.processedAt,
              pagesCrawled: data.pagesCrawled || s.pagesCrawled,
            }
          : s
      ))

      toast.success(
        `Bron verwerkt! ${data.summaryLength} tekens kennissamenvatting gemaakt` +
        (data.pagesCrawled > 1 ? ` (${data.pagesCrawled} pagina's gecrawld)` : '')
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verwerking mislukt'
      toast.error(message)
    } finally {
      setProcessingId(null)
      setProcessingStatus(null)
    }
  }

  const runCrawlAgent = async (id: string, mode: 'full' | 'recent' = 'full', useBrowser: boolean = false) => {
    setProcessingId(id)
    setProcessingStatus(useBrowser ? 'Browser agent starten...' : 'Crawl agent starten...')

    try {
      // Use browser agent for sources with credentials (InView, VAAN)
      const endpoint = useBrowser
        ? '/api/claude/sources/browser-agent'
        : '/api/claude/sources/crawl-agent'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: id, mode, maxArticles: 20 }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Agent mislukt')
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: status')) {
              // Next line is data
            } else if (line.startsWith('data: ') && !line.startsWith('data: {')) {
              setProcessingStatus(line.slice(6))
            } else if (line.startsWith('event: error')) {
              // Next data line is the error
            } else if (line.startsWith('event: done')) {
              // Refresh sources
              fetchSources()
            } else if (line.startsWith('data: {')) {
              try {
                const result = JSON.parse(line.slice(6))
                toast.success(
                  `Agent voltooid! ${result.pagesProcessed} pagina's verwerkt, ${result.summaryLength} tekens kennis opgeslagen.`
                )
              } catch {
                // Not JSON
              }
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent mislukt'
      toast.error(message)
    } finally {
      setProcessingId(null)
      setProcessingStatus(null)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'website': return Icons.globe
      case 'document': return Icons.fileText
      case 'api': return Icons.database
      default: return Icons.file
    }
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      arbeidsrecht: '#f9ff85',
      civielrecht: '#60a5fa',
      procesrecht: '#f472b6',
      sociaalzekerheid: '#34d399',
      cao: '#a78bfa',
      rechtspraak: '#fbbf24',
      overig: '#94a3b8',
    }
    return colors[cat] || '#94a3b8'
  }

  const activeSources = sources.filter(s => s.isActive)
  const inactiveSources = sources.filter(s => !s.isActive)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60">Juridische Bronnen</p>
          <p className="text-xs text-white/30">
            {activeSources.length} actieve bron{activeSources.length !== 1 ? 'nen' : ''} —
            Claude gebruikt deze kennis bij het beantwoorden van vragen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icons.zap size={14} />
            Snelle toevoegen
          </button>
          <button
            onClick={() => { setShowAddForm(true); setShowPresets(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
          >
            <Icons.plus size={16} />
            Bron toevoegen
          </button>
        </div>
      </div>

      {/* Presets Quick-Add */}
      {showPresets && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Veelgebruikte juridische bronnen</h3>
            <button onClick={() => setShowPresets(false)} className="p-1 text-white/30 hover:text-white">
              <Icons.x size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {SOURCE_PRESETS.map((preset) => {
              const alreadyAdded = sources.some(s => s.url === preset.url)
              return (
                <button
                  key={preset.name}
                  onClick={() => !alreadyAdded && applyPreset(preset)}
                  disabled={alreadyAdded}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    alreadyAdded
                      ? 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(preset.category) }} />
                    <span className="text-xs font-medium text-white/80">{preset.name}</span>
                    {preset.requiresLogin && <Icons.lock size={10} className="text-white/30" />}
                    {alreadyAdded && <span className="text-[10px] text-workx-lime ml-auto">Toegevoegd</span>}
                  </div>
                  <p className="text-[11px] text-white/30 line-clamp-2">{preset.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Source Form */}
      {showAddForm && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Nieuwe bron toevoegen</h3>
            <button onClick={resetForm} className="p-1 text-white/30 hover:text-white">
              <Icons.x size={14} />
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 w-fit">
            <button
              onClick={() => setAddMode('website')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                addMode === 'website' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              <Icons.globe size={12} />
              Website / URL
            </button>
            <button
              onClick={() => setAddMode('document')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                addMode === 'document' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              <Icons.fileText size={12} />
              Document uploaden
            </button>
          </div>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Naam</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="bijv. VAAN AR Updates"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Categorie</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-workx-lime/40"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-workx-dark">{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-white/40 block mb-1">Beschrijving (optioneel)</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Korte beschrijving van de bron..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
            />
          </div>

          {/* Website-specific fields */}
          {addMode === 'website' && (
            <>
              <div>
                <label className="text-[11px] text-white/40 block mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
                />
              </div>

              {/* Credentials section */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasCredentials}
                    onChange={(e) => setFormData({ ...formData, hasCredentials: e.target.checked })}
                    className="rounded border-white/20 bg-white/5"
                  />
                  <span className="text-xs text-white/50">Deze bron vereist inloggegevens</span>
                  <Icons.lock size={11} className="text-white/30" />
                </label>

                {formData.hasCredentials && (
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
                    <p className="text-[10px] text-white/30">
                      Inloggegevens worden veilig opgeslagen en alleen server-side gebruikt.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/40 block mb-1">E-mail</label>
                        <input
                          type="email"
                          value={formData.credentialEmail}
                          onChange={(e) => setFormData({ ...formData, credentialEmail: e.target.value })}
                          placeholder="gebruiker@voorbeeld.nl"
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-workx-lime/40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-1">Wachtwoord</label>
                        <input
                          type="password"
                          value={formData.credentialPassword}
                          onChange={(e) => setFormData({ ...formData, credentialPassword: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-workx-lime/40"
                        />
                      </div>
                    </div>
                    <details className="text-[10px]">
                      <summary className="text-white/30 cursor-pointer hover:text-white/50">Geavanceerd (cookie/token)</summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="text-white/30 block mb-0.5">Cookie header</label>
                          <input
                            type="text"
                            value={formData.credentialCookie}
                            onChange={(e) => setFormData({ ...formData, credentialCookie: e.target.value })}
                            placeholder="session=abc123..."
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-workx-lime/40"
                          />
                        </div>
                        <div>
                          <label className="text-white/30 block mb-0.5">Bearer token</label>
                          <input
                            type="text"
                            value={formData.credentialToken}
                            onChange={(e) => setFormData({ ...formData, credentialToken: e.target.value })}
                            placeholder="eyJhbGciOi..."
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-workx-lime/40"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Document upload */}
          {addMode === 'document' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadDocumentSource(file)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="w-full p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 text-center cursor-pointer transition-all hover:bg-white/[0.02]"
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icons.upload size={20} className="text-white/40" />
                </div>
                <p className="text-sm text-white/50">
                  Klik om een bestand te selecteren
                </p>
                <p className="text-[11px] text-white/25 mt-1">
                  PDF, DOCX, TXT, MD — max 25MB
                </p>
              </button>
            </div>
          )}

          {/* Submit buttons */}
          {addMode === 'website' && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={addWebsiteSource}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="animate-spin"><Icons.refresh size={14} /></div>
                ) : (
                  <Icons.plus size={14} />
                )}
                {isSaving ? 'Toevoegen...' : 'Bron toevoegen'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                Annuleren
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sources list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/10 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <Icons.database size={24} className="text-white/20" />
          </div>
          <p className="text-sm text-white/40 mb-1">Nog geen bronnen</p>
          <p className="text-xs text-white/25 max-w-md mx-auto">
            Voeg juridische bronnen toe om Claude slimmer te maken over Nederlands arbeidsrecht.
            Websites, vakliteratuur, interne documenten — alles wat Claude kan gebruiken bij het beantwoorden van vragen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active sources */}
          {activeSources.map((source) => {
            const TypeIcon = getTypeIcon(source.type)
            const isBeingProcessed = processingId === source.id
            return (
              <div
                key={source.id}
                className={`rounded-xl border transition-colors group ${
                  isBeingProcessed
                    ? 'bg-workx-lime/5 border-workx-lime/20'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${getCategoryColor(source.category)}15` }}
                  >
                    <TypeIcon size={16} style={{ color: getCategoryColor(source.category) }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white/80 truncate">{source.name}</p>
                      <div
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0"
                        style={{
                          backgroundColor: `${getCategoryColor(source.category)}20`,
                          color: getCategoryColor(source.category),
                        }}
                      >
                        {CATEGORIES.find(c => c.value === source.category)?.label || source.category}
                      </div>
                      {source.isProcessed && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-[9px] text-green-400 font-medium shrink-0">
                          <Icons.checkCircle size={9} />
                          Verwerkt
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/30">
                      {source.description && <span className="truncate max-w-[200px]">{source.description}</span>}
                    </div>
                    {/* Quality indicator bar */}
                    <div className="flex items-center gap-2 mt-1">
                      {source.isProcessed ? (() => {
                        const daysSinceProcess = source.processedAt
                          ? Math.floor((Date.now() - new Date(source.processedAt).getTime()) / (1000 * 60 * 60 * 24))
                          : 999
                        const isFresh = daysSinceProcess < 14
                        const isStale = daysSinceProcess > 60
                        return (
                          <>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              isFresh ? 'bg-green-500/10 text-green-400' : isStale ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${
                                isFresh ? 'bg-green-400' : isStale ? 'bg-red-400' : 'bg-yellow-400'
                              }`} />
                              {isFresh ? 'Actueel' : isStale ? 'Verouderd' : 'Redelijk actueel'}
                            </span>
                            {source.processedAt && (
                              <span className="text-[10px] text-white/20">
                                {daysSinceProcess === 0 ? 'vandaag' : daysSinceProcess === 1 ? 'gisteren' : `${daysSinceProcess}d geleden`} verwerkt
                              </span>
                            )}
                            {source.pagesCrawled > 0 && (
                              <span className="text-[10px] text-white/20">{source.pagesCrawled} pag.</span>
                            )}
                          </>
                        )
                      })() : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/5 text-white/25">
                          <span className="w-1 h-1 rounded-full bg-white/25" />
                          Niet verwerkt
                        </span>
                      )}
                      {source.lastSynced && (
                        <span className="text-[10px] text-white/15">
                          Sync: {new Date(source.lastSynced).toLocaleDateString('nl-NL')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {/* Single "Verwerk" button — does everything: sync/crawl + Claude processing */}
                    {!source.isProcessed ? (
                      <button
                        onClick={() => {
                          if (source.type === 'website' && source.url) {
                            // Use browser agent for sites with login credentials
                            runCrawlAgent(source.id, 'full', source.hasCredentials)
                          } else {
                            processSource(source.id, false)
                          }
                        }}
                        disabled={isBeingProcessed}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 transition-colors disabled:opacity-50"
                        title={source.hasCredentials ? 'Browser agent: logt in, haalt artikelen op en verwerkt de kennis' : 'Claude leest, analyseert en leert van deze bron'}
                      >
                        <Icons.sparkles size={12} />
                        <span>{source.hasCredentials ? 'Agent starten' : 'Verwerk nu'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (source.type === 'website' && source.url) {
                            runCrawlAgent(source.id, 'full', source.hasCredentials)
                          } else {
                            processSource(source.id, false)
                          }
                        }}
                        disabled={isBeingProcessed}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-workx-lime hover:bg-workx-lime/10 transition-colors disabled:opacity-50"
                        title="Opnieuw verwerken"
                      >
                        <Icons.refresh size={12} />
                        <span>Herverwerk</span>
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive(source.id, source.isActive)}
                      className="p-2 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                      title="Deactiveren"
                    >
                      <Icons.eyeOff size={14} />
                    </button>
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Verwijderen"
                    >
                      <Icons.trash size={14} />
                    </button>
                  </div>
                </div>

                {/* Processing status bar */}
                {isBeingProcessed && processingStatus && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-workx-lime/30 border-t-workx-lime animate-spin" />
                    <span className="text-xs text-workx-lime/80">{processingStatus}</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Inactive sources */}
          {inactiveSources.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-white/20">Gedeactiveerd ({inactiveSources.length})</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              {inactiveSources.map((source) => {
                const TypeIcon = getTypeIcon(source.type)
                return (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.01] border border-white/5 opacity-50 hover:opacity-70 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                      <TypeIcon size={16} className="text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/50 truncate">{source.name}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleActive(source.id, source.isActive)}
                        className="p-2 rounded-lg text-white/30 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                        title="Activeren"
                      >
                        <Icons.eye size={14} />
                      </button>
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Verwijderen"
                      >
                        <Icons.trash size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Knowledge stats */}
      {sources.some(s => s.isProcessed) && (
        <div className="rounded-xl bg-gradient-to-r from-workx-lime/5 to-green-500/5 border border-workx-lime/10 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
              <Icons.sparkles size={18} className="text-workx-lime" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">Claude&apos;s kennisbank</p>
              <p className="text-[11px] text-white/40">
                {sources.filter(s => s.isProcessed).length} verwerkte bron{sources.filter(s => s.isProcessed).length !== 1 ? 'nen' : ''} —
                Claude heeft deze kennis geanalyseerd en kan er direct uit putten
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 p-4">
        <div className="flex gap-3">
          <Icons.info size={16} className="text-workx-lime/60 mt-0.5 shrink-0" />
          <div className="text-[11px] text-white/40 space-y-1.5">
            <p><strong className="text-white/60">Hoe wordt Claude slimmer?</strong></p>
            <p>Wanneer je een bron toevoegt, wordt deze automatisch verwerkt: Claude leest de content, extraheert alle juridische kennis (wetsartikelen, rechtspraak, principes, termijnen) en slaat dit op als gestructureerde samenvatting.</p>
            <p>Bij websites crawlt een agent automatisch meerdere pagina&apos;s. Deze verwerkte kennis wordt bij <strong className="text-white/50">elk gesprek</strong> meegegeven — Claude verwijst in antwoorden naar de specifieke bronnen met artikelnummers en ECLI-nummers.</p>
          </div>
        </div>
      </div>

      <ConfirmDialogComponent />
    </div>
  )
}
