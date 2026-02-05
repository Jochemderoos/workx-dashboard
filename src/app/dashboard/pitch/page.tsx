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
  isManager?: boolean
  usingDatabase?: boolean
}

interface PitchDocument {
  id: string
  type: 'cv' | 'intro' | 'bijlage'
  name: string
  label: string
  description?: string
  teamMemberName?: string
  sourceType: 'base' | 'upload'
  basePages?: string
  uploadUrl?: string
  sortOrder: number
  isActive: boolean
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
  const [activeTab, setActiveTab] = useState<'select' | 'preview' | 'images' | 'admin'>('select')
  const [isManager, setIsManager] = useState(false)
  const [usingDatabase, setUsingDatabase] = useState(false)
  const [documents, setDocuments] = useState<PitchDocument[]>([])
  const [isSeeding, setIsSeeding] = useState(false)
  const [editingDoc, setEditingDoc] = useState<PitchDocument | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDocType, setNewDocType] = useState<'cv' | 'intro' | 'bijlage'>('cv')

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
        setIsManager(data.isManager || false)
        setUsingDatabase(data.usingDatabase || false)
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

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/pitch/documents?includeInactive=true')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const seedDocuments = async () => {
    setIsSeeding(true)
    try {
      const res = await fetch('/api/pitch/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message)
        fetchDocuments()
        fetchPitchInfo()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kon documenten niet migreren')
      }
    } catch (error) {
      toast.error('Kon documenten niet migreren')
    } finally {
      setIsSeeding(false)
    }
  }

  const updateDocument = async (id: string, updates: Partial<PitchDocument>) => {
    try {
      const res = await fetch(`/api/pitch/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        toast.success('Document bijgewerkt')
        fetchDocuments()
        fetchPitchInfo()
        setEditingDoc(null)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kon document niet bijwerken')
      }
    } catch (error) {
      toast.error('Kon document niet bijwerken')
    }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit document wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/pitch/documents/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Document verwijderd')
        fetchDocuments()
        fetchPitchInfo()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kon document niet verwijderen')
      }
    } catch (error) {
      toast.error('Kon document niet verwijderen')
    }
  }

  const createDocument = async (doc: Omit<PitchDocument, 'id'>) => {
    try {
      const res = await fetch('/api/pitch/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
      if (res.ok) {
        toast.success('Document toegevoegd')
        fetchDocuments()
        fetchPitchInfo()
        setShowAddForm(false)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kon document niet toevoegen')
      }
    } catch (error) {
      toast.error('Kon document niet toevoegen')
    }
  }

  // Load documents when switching to admin tab
  useEffect(() => {
    if (activeTab === 'admin' && isManager) {
      fetchDocuments()
    }
  }, [activeTab, isManager])

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

        {/* Admin tab - only for managers */}
        {isManager && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icons.settings size={16} />
            Beheer
          </button>
        )}

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
        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Main selection area - 3 columns */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
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

          {/* Live Preview sidebar - 1 column */}
          <div className="lg:col-span-1">
            <div className="card p-4 sticky top-4">
              <h2 className="font-medium text-white mb-4 flex items-center gap-2">
                <Icons.eye size={16} className="text-workx-lime" />
                Live Preview
              </h2>

              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                {/* Intro sections preview */}
                {pitchInfo?.introSections.filter(s => selectedIntro.has(s.key)).map((section, idx) => (
                  <div key={section.key} className="space-y-1">
                    {idx === 0 && (
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Intro & Diensten</p>
                    )}
                    <div
                      className="relative rounded-lg overflow-hidden shadow-md"
                      style={{ aspectRatio: '297/210', background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)' }}
                    >
                      {/* Workx style header */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-workx-lime" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <p className="text-[9px] text-white/80 font-medium text-center line-clamp-2">{section.label}</p>
                        <p className="text-[7px] text-white/50 mt-1">{section.pageCount} pagina{section.pageCount > 1 ? "'s" : ""}</p>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600/80 p-1">
                        <p className="text-[7px] text-white text-center">Intro</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Team CVs preview */}
                {Array.from(selectedTeam).length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-white/10">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Team CV's ({selectedTeam.size})</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from(selectedTeam).map((name) => (
                        <div
                          key={name}
                          className="relative rounded-lg overflow-hidden shadow-md"
                          style={{ aspectRatio: '297/210', background: 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)' }}
                        >
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-workx-lime" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mb-1">
                              <Icons.user size={10} className="text-white/70" />
                            </div>
                            <p className="text-[7px] text-white/90 font-medium text-center line-clamp-2 px-1">{name}</p>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-green-600/80 p-0.5">
                            <p className="text-[6px] text-white text-center">CV</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bijlagen preview */}
                {pitchInfo?.bijlagenSections.filter(s => selectedBijlagen.has(s.key)).length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-white/10">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Bijlagen</p>
                    {pitchInfo?.bijlagenSections.filter(s => selectedBijlagen.has(s.key)).map((section) => (
                      <div
                        key={section.key}
                        className="relative rounded-lg overflow-hidden shadow-md"
                        style={{ aspectRatio: '297/210', background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)' }}
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-workx-lime" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                          <p className="text-[9px] text-white/80 font-medium text-center line-clamp-2">{section.label}</p>
                          <p className="text-[7px] text-white/50 mt-1">{section.pageCount} pagina{section.pageCount > 1 ? "'s" : ""}</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 p-1">
                          <p className="text-[7px] text-white text-center">Bijlage</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {selectedIntro.size === 0 && selectedTeam.size === 0 && selectedBijlagen.size === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                    <Icons.eye className="mx-auto mb-2 text-gray-600" size={24} />
                    <p className="text-xs text-gray-500">Selecteer onderdelen<br />om preview te zien</p>
                  </div>
                )}

                {/* Client logo indicator */}
                {clientLogo && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center overflow-hidden">
                        <img src={clientLogo.dataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-orange-400 font-medium">Klant logo</p>
                        <p className="text-[8px] text-gray-500 truncate">{logoPresets[logoPosition.preset]?.label || 'Aangepast'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Intro pagina's:</span>
                    <span className="text-blue-400 font-medium">{pageStats.intro}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Team CV's:</span>
                    <span className="text-green-400 font-medium">{pageStats.team}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Bijlagen:</span>
                    <span className="text-purple-400 font-medium">{pageStats.bijlagen}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white mt-2 pt-2 border-t border-white/10">
                    <span className="font-medium">Totaal:</span>
                    <span className="font-semibold text-workx-lime">{pageStats.total} pagina's</span>
                  </div>
                </div>
              </div>
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

      {/* Admin tab */}
      {activeTab === 'admin' && isManager && (
        <div className="space-y-6">
          {/* Migration banner */}
          {!usingDatabase && (
            <div className="card p-4 border-orange-500/30 bg-orange-500/10">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Icons.info className="text-orange-400" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white mb-1">Documenten migreren naar database</h3>
                  <p className="text-sm text-gray-400 mb-3">
                    De pitch documenten worden momenteel uit hardcoded waarden geladen.
                    Klik op de knop om ze naar de database te migreren, zodat je ze via deze interface kunt beheren.
                  </p>
                  <button
                    onClick={seedDocuments}
                    disabled={isSeeding}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50"
                  >
                    {isSeeding ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Migreren...
                      </>
                    ) : (
                      <>
                        <Icons.database size={16} />
                        Migreer naar database
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Document sections */}
          {usingDatabase && (
            <div className="space-y-6">
              {/* CVs */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Icons.users className="text-green-400" size={14} />
                    </div>
                    <h2 className="font-medium text-white">Team CV's</h2>
                    <span className="text-xs text-gray-500">({documents.filter(d => d.type === 'cv').length})</span>
                  </div>
                  <button
                    onClick={() => { setNewDocType('cv'); setShowAddForm(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20"
                  >
                    <Icons.plus size={14} />
                    CV Toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  {documents.filter(d => d.type === 'cv').map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        doc.isActive ? 'border-white/10 bg-white/5' : 'border-red-500/30 bg-red-500/5 opacity-50'
                      }`}
                    >
                      <span className="text-sm text-white flex-1">{doc.label}</span>
                      <span className="text-xs text-gray-500">Pagina {doc.basePages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateDocument(doc.id, { isActive: !doc.isActive })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            doc.isActive ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-white/10'
                          }`}
                          title={doc.isActive ? 'Deactiveren' : 'Activeren'}
                        >
                          {doc.isActive ? <Icons.check size={14} /> : <Icons.x size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingDoc(doc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intro sections */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Icons.file className="text-blue-400" size={14} />
                    </div>
                    <h2 className="font-medium text-white">Intro Secties</h2>
                    <span className="text-xs text-gray-500">({documents.filter(d => d.type === 'intro').length})</span>
                  </div>
                  <button
                    onClick={() => { setNewDocType('intro'); setShowAddForm(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20"
                  >
                    <Icons.plus size={14} />
                    Sectie Toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  {documents.filter(d => d.type === 'intro').map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        doc.isActive ? 'border-white/10 bg-white/5' : 'border-red-500/30 bg-red-500/5 opacity-50'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="text-sm text-white">{doc.label}</span>
                        {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                      </div>
                      <span className="text-xs text-gray-500">Pagina's {doc.basePages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateDocument(doc.id, { isActive: !doc.isActive })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            doc.isActive ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-white/10'
                          }`}
                        >
                          {doc.isActive ? <Icons.check size={14} /> : <Icons.x size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingDoc(doc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bijlagen sections */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Icons.file className="text-purple-400" size={14} />
                    </div>
                    <h2 className="font-medium text-white">Bijlagen</h2>
                    <span className="text-xs text-gray-500">({documents.filter(d => d.type === 'bijlage').length})</span>
                  </div>
                  <button
                    onClick={() => { setNewDocType('bijlage'); setShowAddForm(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-sm hover:bg-purple-500/20"
                  >
                    <Icons.plus size={14} />
                    Bijlage Toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  {documents.filter(d => d.type === 'bijlage').map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        doc.isActive ? 'border-white/10 bg-white/5' : 'border-red-500/30 bg-red-500/5 opacity-50'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="text-sm text-white">{doc.label}</span>
                        {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                      </div>
                      <span className="text-xs text-gray-500">Pagina's {doc.basePages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateDocument(doc.id, { isActive: !doc.isActive })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            doc.isActive ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-white/10'
                          }`}
                        >
                          {doc.isActive ? <Icons.check size={14} /> : <Icons.x size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingDoc(doc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Help info */}
              <div className="card p-4 border-blue-500/20 bg-blue-500/5">
                <div className="flex items-start gap-3">
                  <Icons.info className="text-blue-400 mt-0.5" size={18} />
                  <div>
                    <h3 className="font-medium text-white mb-1">Hoe werkt dit?</h3>
                    <p className="text-sm text-gray-400">
                      De Pitch Document Maker extraheert pagina's uit de base PDF (pitch-base-nl.pdf in /data/pitch/).
                      Elke entry hierboven verwijst naar specifieke paginanummers in die PDF.
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Om een nieuw CV of bijlage toe te voegen: voeg eerst de pagina toe aan de base PDF,
                      en maak dan hier een entry met het juiste paginanummer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit modal */}
          {editingDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="card p-6 max-w-md w-full">
                <h3 className="text-lg font-medium text-white mb-4">Document Bewerken</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Label (naam)</label>
                    <input
                      type="text"
                      value={editingDoc.label}
                      onChange={(e) => setEditingDoc({ ...editingDoc, label: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                    />
                  </div>
                  {editingDoc.type === 'cv' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Team Member Naam</label>
                      <input
                        type="text"
                        value={editingDoc.teamMemberName || ''}
                        onChange={(e) => setEditingDoc({ ...editingDoc, teamMemberName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Beschrijving (optioneel)</label>
                    <input
                      type="text"
                      value={editingDoc.description || ''}
                      onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Pagina nummer(s)</label>
                    <input
                      type="text"
                      value={editingDoc.basePages || ''}
                      onChange={(e) => setEditingDoc({ ...editingDoc, basePages: e.target.value })}
                      placeholder="bijv. 13 of 2,3"
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Eén nummer of meerdere gescheiden door komma's</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Volgorde</label>
                    <input
                      type="number"
                      value={editingDoc.sortOrder}
                      onChange={(e) => setEditingDoc({ ...editingDoc, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setEditingDoc(null)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => updateDocument(editingDoc.id, {
                      label: editingDoc.label,
                      description: editingDoc.description,
                      teamMemberName: editingDoc.teamMemberName,
                      basePages: editingDoc.basePages,
                      sortOrder: editingDoc.sortOrder,
                    })}
                    className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add modal */}
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="card p-6 max-w-md w-full">
                <h3 className="text-lg font-medium text-white mb-4">
                  {newDocType === 'cv' ? 'Nieuw CV' : newDocType === 'intro' ? 'Nieuwe Intro Sectie' : 'Nieuwe Bijlage'} Toevoegen
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const formData = new FormData(form)
                    const label = formData.get('label') as string
                    const name = label.toLowerCase().replace(/\s+/g, '-')
                    createDocument({
                      type: newDocType,
                      name,
                      label,
                      description: formData.get('description') as string || undefined,
                      teamMemberName: newDocType === 'cv' ? label : undefined,
                      sourceType: 'base',
                      basePages: formData.get('basePages') as string,
                      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
                      isActive: true,
                    })
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      {newDocType === 'cv' ? 'Naam teamlid' : 'Label'}
                    </label>
                    <input
                      type="text"
                      name="label"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                      placeholder={newDocType === 'cv' ? 'bijv. Jan Janssen' : 'bijv. Over Workx'}
                    />
                  </div>
                  {newDocType !== 'cv' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Beschrijving (optioneel)</label>
                      <input
                        type="text"
                        name="description"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Pagina nummer(s) in base PDF</label>
                    <input
                      type="text"
                      name="basePages"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                      placeholder="bijv. 28 of 28,29"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paginanummer(s) in pitch-base-nl.pdf
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Volgorde</label>
                    <input
                      type="number"
                      name="sortOrder"
                      defaultValue={documents.filter(d => d.type === newDocType).length}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15"
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
                    >
                      Toevoegen
                    </button>
                  </div>
                </form>
              </div>
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
