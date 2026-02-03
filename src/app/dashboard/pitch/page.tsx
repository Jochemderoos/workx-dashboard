'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'

// Dynamically import PDF editor to avoid SSR issues
const PdfEditor = dynamic(() => import('@/components/pitch/PdfEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <span className="w-6 h-6 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface Section {
  key: string
  label: string
  description: string
  pageCount: number
  pages: number[]
}

interface PitchInfo {
  teamMembers: string[]
  totalTeamMembers: number
  introSections: Section[]
  bijlagenSections: Section[]
  availableLanguages: string[]
}

interface PagePreview {
  originalPage: number
  type: 'intro' | 'cv' | 'bijlage'
  label: string
  section?: string
}

interface WhiteoutOverlay {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  color?: string
}

interface TextOverlay {
  id: string
  pageNumber: number
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  whiteout?: {
    width: number
    height: number
    padding?: number
  }
}

interface ImageOverlay {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  imageData: string
  imageType: 'png' | 'jpg'
  whiteout?: boolean
  previewUrl?: string
}

// CV page mapping (same as backend)
const TEAM_CV_PAGES: Record<string, number> = {
  'Bas den Ridder': 13,
  'Jochem de Roos': 14,
  'Maaike de Jong': 15,
  'Marnix Ritmeester': 16,
  'Juliette Niersman': 17,
  'Barbara Rip': 18,
  'Marlieke Schipper': 19,
  'Kay Maes': 20,
  'Justine Schellekens': 21,
  'Wies van Pesch': 22,
  'Emma van der Vos': 23,
  'Alain Heunen': 24,
  'Erika van Zadelhof': 25,
  'Heleen Pesser': 26,
  'Julia Groen': 27,
}

export default function PitchPage() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [pitchInfo, setPitchInfo] = useState<PitchInfo | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorMode, setEditorMode] = useState<'view' | 'text' | 'whiteout'>('view')
  const [currentEditorPage, setCurrentEditorPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'select' | 'preview' | 'images'>('select')

  // Selection state
  const [selectedIntro, setSelectedIntro] = useState<Set<string>>(new Set())
  const [selectedTeam, setSelectedTeam] = useState<Set<string>>(new Set())
  const [selectedBijlagen, setSelectedBijlagen] = useState<Set<string>>(new Set())

  // Language and preview state
  const [language, setLanguage] = useState<'nl' | 'en'>('nl')
  const [previewPages, setPreviewPages] = useState<PagePreview[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Client logo state
  const [clientLogo, setClientLogo] = useState<{ dataUrl: string; name: string } | null>(null)
  const [logoPosition, setLogoPosition] = useState<{ preset: string; x: number; y: number }>({
    preset: 'bottom-left',  // Default: links onder
    x: 15,   // mm from left
    y: 125,  // mm from top (A5 landscape is ~148mm high, so 125mm is near bottom)
  })

  // Logo position presets (A5 landscape: ~210mm x 148mm)
  const logoPresets: Record<string, { x: number; y: number; label: string }> = {
    'top-left': { x: 15, y: 15, label: 'Linksboven' },
    'top-right': { x: 145, y: 15, label: 'Rechtsboven' },
    'bottom-left': { x: 15, y: 115, label: 'Linksonder' },
    'bottom-right': { x: 145, y: 115, label: 'Rechtsonder' },
    'custom': { x: logoPosition.x, y: logoPosition.y, label: 'Aangepast' },
  }

  // Overlays state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([])
  const [editingOverlay, setEditingOverlay] = useState<string | null>(null)

  // Fetch pitch info
  useEffect(() => {
    fetchPitchInfo()
  }, [])

  const fetchPitchInfo = async () => {
    try {
      const res = await fetch('/api/pitch')
      if (res.ok) {
        const data: PitchInfo = await res.json()
        setPitchInfo(data)
        // Default: select all intro sections
        setSelectedIntro(new Set(data.introSections.map(s => s.key)))
      } else {
        toast.error('Kon pitch info niet laden')
      }
    } catch (error) {
      console.error('Error fetching pitch info:', error)
      toast.error('Kon pitch info niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle functions
  const toggleIntro = (key: string) => {
    setSelectedIntro(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleTeam = (name: string) => {
    setSelectedTeam(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleBijlagen = (key: string) => {
    setSelectedBijlagen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Select all/none functions
  const selectAllIntro = () => {
    if (pitchInfo) setSelectedIntro(new Set(pitchInfo.introSections.map(s => s.key)))
  }
  const selectNoneIntro = () => setSelectedIntro(new Set())

  const selectAllTeam = () => {
    if (pitchInfo) setSelectedTeam(new Set(pitchInfo.teamMembers))
  }
  const selectNoneTeam = () => setSelectedTeam(new Set())

  const selectAllBijlagen = () => {
    if (pitchInfo) setSelectedBijlagen(new Set(pitchInfo.bijlagenSections.map(s => s.key)))
  }
  const selectNoneBijlagen = () => setSelectedBijlagen(new Set())

  // Fetch page preview for arrange tab
  const fetchPagePreview = async () => {
    try {
      const res = await fetch('/api/pitch/preview-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedTeamMembers: Array.from(selectedTeam),
          selectedIntroSections: Array.from(selectedIntro),
          selectedBijlagenSections: Array.from(selectedBijlagen),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewPages(data.pages)
      }
    } catch (error) {
      console.error('Error fetching page preview:', error)
    }
  }

  // Load preview when switching to preview tab
  useEffect(() => {
    if (activeTab === 'preview' && selectedTeam.size > 0) {
      fetchPagePreview()
    }
  }, [activeTab, selectedTeam, selectedIntro, selectedBijlagen])

  // Drag and drop handlers for reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newPages = [...previewPages]
    const draggedPage = newPages[draggedIndex]
    newPages.splice(draggedIndex, 1)
    newPages.splice(index, 0, draggedPage)
    setPreviewPages(newPages)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const removePage = (index: number) => {
    setPreviewPages(prev => prev.filter((_, i) => i !== index))
  }

  const movePageUp = (index: number) => {
    if (index === 0) return
    const newPages = [...previewPages]
    ;[newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]]
    setPreviewPages(newPages)
  }

  const movePageDown = (index: number) => {
    if (index === previewPages.length - 1) return
    const newPages = [...previewPages]
    ;[newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]]
    setPreviewPages(newPages)
  }

  // Calculate selected pages (1-indexed)
  const selectedPages = useMemo(() => {
    if (!pitchInfo) return []

    const pages: number[] = []

    // Add intro pages
    for (const section of pitchInfo.introSections) {
      if (selectedIntro.has(section.key)) {
        pages.push(...section.pages)
      }
    }

    // Add team CV pages
    for (const name of Array.from(selectedTeam)) {
      const pageNum = TEAM_CV_PAGES[name]
      if (pageNum) pages.push(pageNum)
    }

    // Sort CV pages
    const introPagesEnd = pages.filter(p => p <= 12).length
    const cvPages = pages.filter(p => p >= 13 && p <= 27).sort((a, b) => a - b)

    // Add bijlagen pages
    for (const section of pitchInfo.bijlagenSections) {
      if (selectedBijlagen.has(section.key)) {
        pages.push(...section.pages)
      }
    }

    // Reconstruct with sorted CVs
    const introPages = pages.filter(p => p <= 12)
    const bijlagenPages = pages.filter(p => p >= 28)

    return [...introPages, ...cvPages, ...bijlagenPages]
  }, [pitchInfo, selectedIntro, selectedTeam, selectedBijlagen])

  // Calculate page counts
  const pageStats = useMemo(() => {
    if (!pitchInfo) return { intro: 0, team: 0, bijlagen: 0, total: 0 }

    const intro = pitchInfo.introSections
      .filter(s => selectedIntro.has(s.key))
      .reduce((sum, s) => sum + s.pageCount, 0)

    const team = selectedTeam.size

    const bijlagen = pitchInfo.bijlagenSections
      .filter(s => selectedBijlagen.has(s.key))
      .reduce((sum, s) => sum + s.pageCount, 0)

    return { intro, team, bijlagen, total: intro + team + bijlagen }
  }, [pitchInfo, selectedIntro, selectedTeam, selectedBijlagen])

  // Add text overlay - can be called from editor with specific position
  const addTextOverlay = (overlayData?: Omit<TextOverlay, 'id'>) => {
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      pageNumber: overlayData?.pageNumber || currentEditorPage || 1,
      x: overlayData?.x ?? 50,
      y: overlayData?.y ?? 50,
      text: overlayData?.text || 'Nieuwe tekst',
      fontSize: overlayData?.fontSize || 12,
      color: overlayData?.color || '#000000',
      whiteout: overlayData?.whiteout,
    }
    setTextOverlays(prev => [...prev, newOverlay])
    setEditingOverlay(newOverlay.id)
  }

  const updateOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
  }

  const deleteOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id))
    if (editingOverlay === id) setEditingOverlay(null)
  }

  // Add image overlay
  const addImageOverlay = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const imageType = file.type === 'image/png' ? 'png' : 'jpg'

      const newOverlay: ImageOverlay = {
        id: `img-${Date.now()}`,
        pageNumber: 1,
        x: 50,
        y: 50,
        width: 50,
        height: 50,
        imageData: dataUrl,
        imageType,
        whiteout: true,
        previewUrl: dataUrl,
      }
      setImageOverlays(prev => [...prev, newOverlay])
    }
    reader.readAsDataURL(file)
  }

  const updateImageOverlay = (id: string, updates: Partial<ImageOverlay>) => {
    setImageOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
  }

  const deleteImageOverlay = (id: string) => {
    setImageOverlays(prev => prev.filter(o => o.id !== id))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      addImageOverlay(file)
    } else {
      toast.error('Alleen PNG en JPG bestanden toegestaan')
    }
    e.target.value = '' // Reset input
  }

  // Handle client logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'image/png') {
      const reader = new FileReader()
      reader.onload = (event) => {
        setClientLogo({
          dataUrl: event.target?.result as string,
          name: file.name
        })
        toast.success('Logo toegevoegd')
      }
      reader.readAsDataURL(file)
    } else {
      toast.error('Alleen PNG bestanden toegestaan voor logo')
    }
    e.target.value = ''
  }

  const handleGenerate = async () => {
    // Check if we have pages (either from preview or from selections)
    const hasPages = previewPages.length > 0 || selectedTeam.size > 0

    if (!hasPages) {
      toast.error('Selecteer minimaal 1 teamlid')
      return
    }

    setIsGenerating(true)

    try {
      // Use custom page order if we have preview pages arranged
      const customPageOrder = previewPages.length > 0
        ? previewPages.map(p => p.originalPage)
        : undefined

      const res = await fetch('/api/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedTeamMembers: Array.from(selectedTeam),
          selectedIntroSections: Array.from(selectedIntro),
          selectedBijlagenSections: Array.from(selectedBijlagen),
          textOverlays: textOverlays.length > 0 ? textOverlays : undefined,
          imageOverlays: imageOverlays.length > 0 ? imageOverlays.map(({ previewUrl, ...rest }) => rest) : undefined,
          language,
          customPageOrder,
          clientLogo: clientLogo ? {
            dataUrl: clientLogo.dataUrl,
            x: logoPosition.x,
            y: logoPosition.y,
          } : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      // Get filename from header or create default
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename = `Workx-Pitch-${new Date().toISOString().split('T')[0]}.pdf`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`PDF gegenereerd: ${pageStats.total} pagina's`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(error instanceof Error ? error.message : 'Kon PDF niet genereren')
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center">
              <Icons.file className="text-workx-lime" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Pitch Document Maker</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">
            Stel een aangepaste pitch PDF samen
          </p>
        </div>

        {/* Action buttons */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Language selector */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => setLanguage('nl')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                language === 'nl'
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              NL
            </button>
            <button
              onClick={() => setLanguage('en')}
              disabled={!pitchInfo?.availableLanguages?.includes('en')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                language === 'en'
                  ? 'bg-white/20 text-white'
                  : pitchInfo?.availableLanguages?.includes('en')
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 cursor-not-allowed'
              }`}
              title={!pitchInfo?.availableLanguages?.includes('en') ? 'Upload pitch-base-en.pdf to enable' : ''}
            >
              EN
            </button>
          </div>
          <button
            onClick={() => setShowEditor(!showEditor)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              showEditor
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            <Icons.eye size={16} />
            {showEditor ? 'Sluit Preview' : 'Bekijk PDF'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || (selectedTeam.size === 0 && previewPages.length === 0)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              selectedTeam.size > 0 || previewPages.length > 0
                ? 'bg-workx-lime text-workx-dark hover:bg-workx-lime/90'
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <Icons.download size={16} />
                Download ({previewPages.length > 0 ? previewPages.length : pageStats.total} pag.)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-semibold text-blue-400">{pageStats.intro}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">Intro</p>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-semibold text-workx-lime">{pageStats.team}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">CV's</p>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-semibold text-purple-400">{pageStats.bijlagen}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">Bijlagen</p>
        </div>
        <div className="card p-3 sm:p-4 text-center bg-white/10">
          <p className="text-lg sm:text-2xl font-semibold text-white">{pageStats.total}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">Totaal</p>
        </div>
      </div>

      {/* Simple PDF Preview */}
      {showEditor && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <span className="text-sm text-white font-medium">PDF Preview</span>
            <button
              onClick={() => setShowEditor(false)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <Icons.x size={18} />
            </button>
          </div>
          <iframe
            src={`/api/pitch/preview#toolbar=1&navpanes=0`}
            className="w-full border-0"
            style={{ height: '60vh' }}
            title="PDF Preview"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('select')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'select'
              ? 'bg-workx-lime/20 text-workx-lime border-b-2 border-workx-lime'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icons.check size={16} />
          1. Selecteren
        </button>
        <button
          onClick={() => {
            if (selectedTeam.size > 0) {
              setActiveTab('preview')
              fetchPagePreview()
            }
          }}
          disabled={selectedTeam.size === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${
            activeTab === 'preview'
              ? 'bg-workx-lime/20 text-workx-lime border-b-2 border-workx-lime'
              : selectedTeam.size > 0
                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Icons.layers size={16} />
          2. Volgorde & Download
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Go to Volgorde button - visible when on select tab and team selected */}
        {activeTab === 'select' && selectedTeam.size > 0 && (
          <button
            onClick={() => {
              setActiveTab('preview')
              fetchPagePreview()
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-all whitespace-nowrap"
          >
            <Icons.arrowRight size={16} />
            Ga naar Volgorde ({pageStats.total} pag.)
          </button>
        )}
      </div>

      {/* Selection tab */}
      {activeTab === 'select' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Client Logo Upload */}
          <div className="card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Logo upload section */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Icons.image className="text-orange-400" size={14} />
                </div>
                <div>
                  <h2 className="font-medium text-white">Klant Logo</h2>
                  <p className="text-xs text-gray-500">Optioneel op cover</p>
                </div>
              </div>

              {/* Logo preview & upload */}
              <div className="flex items-center gap-3">
                {clientLogo ? (
                  <>
                    <div className="relative w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                      <img src={clientLogo.dataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <span className="text-sm text-gray-400 truncate max-w-[100px]">{clientLogo.name}</span>
                    <button
                      onClick={() => setClientLogo(null)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Icons.x size={16} />
                    </button>
                  </>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/20 cursor-pointer transition-colors">
                    <Icons.upload size={16} />
                    Upload PNG
                    <input
                      type="file"
                      accept=".png,image/png"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Position controls - only show when logo is uploaded */}
              {clientLogo && (
                <>
                  <div className="h-8 w-px bg-white/10 hidden sm:block" />

                  {/* Position presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Positie:</span>
                    {Object.entries(logoPresets).filter(([key]) => key !== 'custom').map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => setLogoPosition({ preset: key, x: preset.x, y: preset.y })}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          logoPosition.preset === key
                            ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                            : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setLogoPosition(prev => ({ ...prev, preset: 'custom' }))}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        logoPosition.preset === 'custom'
                          ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                          : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      Aangepast
                    </button>
                  </div>

                  {/* Custom position sliders */}
                  {logoPosition.preset === 'custom' && (
                    <div className="flex items-center gap-4 ml-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-6">X:</span>
                        <input
                          type="range"
                          min="5"
                          max="160"
                          value={logoPosition.x}
                          onChange={(e) => setLogoPosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                          className="w-20 accent-orange-500"
                        />
                        <span className="text-xs text-gray-400 w-10">{logoPosition.x}mm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-6">Y:</span>
                        <input
                          type="range"
                          min="5"
                          max="130"
                          value={logoPosition.y}
                          onChange={(e) => setLogoPosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                          className="w-20 accent-orange-500"
                        />
                        <span className="text-xs text-gray-400 w-10">{logoPosition.y}mm</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Intro sections */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Icons.file className="text-blue-400" size={14} />
                </div>
                <h2 className="font-medium text-white">Intro & Diensten</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAllIntro} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Alles
                </button>
                <button onClick={selectNoneIntro} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Niets
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {pitchInfo?.introSections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => toggleIntro(section.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedIntro.has(section.key)
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    selectedIntro.has(section.key) ? 'bg-blue-500' : 'border-2 border-white/30'
                  }`}>
                    {selectedIntro.has(section.key) && <Icons.check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedIntro.has(section.key) ? 'text-white' : 'text-gray-300'}`}>
                      {section.label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{section.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">{section.pageCount}p</span>
                </button>
              ))}
            </div>
          </div>

          {/* Team members */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-workx-lime/20 flex items-center justify-center">
                  <Icons.users className="text-workx-lime" size={14} />
                </div>
                <h2 className="font-medium text-white">Team CV's</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAllTeam} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Alles
                </button>
                <button onClick={selectNoneTeam} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Niets
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {pitchInfo?.teamMembers.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleTeam(name)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                    selectedTeam.has(name)
                      ? 'border-workx-lime/50 bg-workx-lime/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                    selectedTeam.has(name) ? 'bg-workx-lime' : 'border-2 border-white/30'
                  }`}>
                    {selectedTeam.has(name) && <Icons.check size={10} className="text-workx-dark" />}
                  </div>
                  <span className={`text-sm truncate ${selectedTeam.has(name) ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {name}
                  </span>
                </button>
              ))}
            </div>

            {selectedTeam.size === 0 && (
              <p className="text-center text-xs text-amber-400 mt-3">Selecteer minimaal 1 teamlid</p>
            )}
          </div>

          {/* Bijlagen sections */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Icons.file className="text-purple-400" size={14} />
                </div>
                <h2 className="font-medium text-white">Bijlagen</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAllBijlagen} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Alles
                </button>
                <button onClick={selectNoneBijlagen} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                  Niets
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {pitchInfo?.bijlagenSections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => toggleBijlagen(section.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedBijlagen.has(section.key)
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    selectedBijlagen.has(section.key) ? 'bg-purple-500' : 'border-2 border-white/30'
                  }`}>
                    {selectedBijlagen.has(section.key) && <Icons.check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedBijlagen.has(section.key) ? 'text-white' : 'text-gray-300'}`}>
                      {section.label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{section.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">{section.pageCount}p</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">Bijlagen zijn optioneel</p>
          </div>
        </div>
        </div>
      )}

      {/* Preview/Arrange tab */}
      {activeTab === 'preview' && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-medium text-white">Pagina Volgorde</h2>
              <p className="text-xs text-gray-400 mt-1">
                Sleep om te herordenen, of gebruik de pijltjes. Klik op X om te verwijderen.
              </p>
            </div>
            <button
              onClick={fetchPagePreview}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 text-sm"
            >
              <Icons.refresh size={14} />
              Reset
            </button>
          </div>

          {previewPages.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
              <Icons.layers className="mx-auto mb-3 text-gray-600" size={32} />
              <p className="text-gray-400 mb-2">Selecteer eerst pagina's in stap 1</p>
              <button
                onClick={() => setActiveTab('select')}
                className="text-workx-lime hover:underline text-sm"
              >
                Ga naar selecteren
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {previewPages.map((page, index) => (
                <div
                  key={`${page.originalPage}-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    draggedIndex === index
                      ? 'border-workx-lime bg-workx-lime/10'
                      : page.type === 'intro'
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : page.type === 'cv'
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-purple-500/30 bg-purple-500/5'
                  } cursor-grab active:cursor-grabbing`}
                >
                  {/* Drag handle */}
                  <div className="text-gray-500">
                    <Icons.gripVertical size={16} />
                  </div>

                  {/* Page number */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    page.type === 'intro'
                      ? 'bg-blue-500/20 text-blue-400'
                      : page.type === 'cv'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Page info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{page.label}</p>
                    <p className="text-xs text-gray-500">
                      {page.type === 'intro' ? 'Intro' : page.type === 'cv' ? 'CV' : 'Bijlage'} • Pagina {page.originalPage}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePageUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Icons.chevronUp size={14} />
                    </button>
                    <button
                      onClick={() => movePageDown(index)}
                      disabled={index === previewPages.length - 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Icons.chevronDown size={14} />
                    </button>
                    <button
                      onClick={() => removePage(index)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Icons.x size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {previewPages.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-workx-lime/10 border border-workx-lime/20 flex items-center justify-between">
              <div>
                <p className="text-sm text-workx-lime font-medium">{previewPages.length} pagina's geselecteerd</p>
                <p className="text-xs text-gray-400">Klaar om te genereren</p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Icons.download size={14} />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile fixed bottom button */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-workx-dark/95 backdrop-blur border-t border-white/10 flex gap-2">
        <button
          onClick={() => setShowEditor(!showEditor)}
          className={`flex items-center justify-center gap-2 p-4 rounded-xl font-medium transition-all flex-1 ${
            showEditor ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-300'
          }`}
        >
          <Icons.edit size={18} />
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedTeam.size === 0}
          className={`flex items-center justify-center gap-2 p-4 rounded-xl font-medium transition-all flex-[3] ${
            selectedTeam.size > 0
              ? 'bg-workx-lime text-workx-dark'
              : 'bg-white/10 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-5 h-5 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
              Genereren...
            </>
          ) : (
            <>
              <Icons.download size={18} />
              Download ({pageStats.total} pag.)
            </>
          )}
        </button>
      </div>

      {/* Spacer for mobile fixed button */}
      <div className="sm:hidden h-20" />

      {/* Info */}
      <div className="card p-4 sm:p-5 border-workx-lime/20 bg-gradient-to-br from-workx-lime/5 to-transparent">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center flex-shrink-0">
            <Icons.info className="text-workx-lime" size={16} />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">100% originele kwaliteit</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Pagina's worden geëxtraheerd zonder modificatie. Tekst overlays worden er bovenop geplaatst
              zodat de originele kwaliteit behouden blijft.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
