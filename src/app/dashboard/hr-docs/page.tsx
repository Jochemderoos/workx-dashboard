'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import { DOCUMENTS as BASE_DOCUMENTS, Chapter, Document } from './documents'
import { KNOWHOW_OFFICEMANAGEMENT } from './knowhow-document'

// Combine all documents
const ALL_DOCUMENTS: Document[] = [...BASE_DOCUMENTS, KNOWHOW_OFFICEMANAGEMENT]

// Helper function to convert HTML to clean text for editing
function htmlToCleanText(html: string): string {
  // Remove extra whitespace and newlines from the beginning
  let text = html.trim()

  // Convert common HTML elements to readable format
  text = text.replace(/<h3[^>]*>/gi, '\n### ')
  text = text.replace(/<\/h3>/gi, '\n')
  text = text.replace(/<h4[^>]*>/gi, '\n#### ')
  text = text.replace(/<\/h4>/gi, '\n')
  text = text.replace(/<p[^>]*>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<li[^>]*>/gi, '\n• ')
  text = text.replace(/<\/li>/gi, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<strong>/gi, '**')
  text = text.replace(/<\/strong>/gi, '**')
  text = text.replace(/<em>/gi, '_')
  text = text.replace(/<\/em>/gi, '_')

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()

  return text
}

// Helper function to convert clean text back to HTML
function cleanTextToHtml(text: string): string {
  let html = text

  // Convert markdown-style formatting back to HTML
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-white font-semibold mt-4 mb-2">$1</h4>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')

  // Convert bullet points to list items
  const lines = html.split('\n')
  let inList = false
  let result: string[] = []

  for (const line of lines) {
    if (line.startsWith('• ')) {
      if (!inList) {
        result.push('<ul class="list-disc list-inside text-white/70 mb-4 space-y-1">')
        inList = true
      }
      result.push('<li>' + line.substring(2) + '</li>')
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (line.trim() && !line.startsWith('<h') && !line.startsWith('</')) {
        result.push('<p class="text-white/70 mb-4">' + line + '</p>')
      } else {
        result.push(line)
      }
    }
  }
  if (inList) {
    result.push('</ul>')
  }

  return result.join('\n')
}

// Export types for external use
export type { Chapter, Document }

// All available documents
const DOCUMENTS: Document[] = ALL_DOCUMENTS

// Icon mapping for documents
const documentIcons: Record<string, typeof Icons.home> = {
  'the-way-it-workx': Icons.books,
  'kantoorhandboek': Icons.fileText,
  'klachtenregeling': Icons.shield,
  'bevriende-kantoren': Icons.users,
  'knowhow-officemanagement': Icons.briefcase,
}

// Icon mapping for chapters
const chapterIcons: Record<string, typeof Icons.home> = {
  '👋': Icons.smile,
  '📋': Icons.fileText,
  '💼': Icons.briefcase,
  '🏖️': Icons.sun,
  '💰': Icons.euro,
  '🏥': Icons.heart,
  '📚': Icons.fileText,
  '🔒': Icons.lock,
  '⚖️': Icons.shield,
  '🎯': Icons.target,
  '🤝': Icons.users,
  '📝': Icons.fileText,
  '🚀': Icons.zap,
  '💡': Icons.sparkles,
  '🎉': Icons.star,
  '🍽️': Icons.coffee,
  '🛡️': Icons.shield,
  '🔄': Icons.refresh,
  '📊': Icons.chart,
  '💎': Icons.award,
  '📎': Icons.paperclip,
  '📖': Icons.fileText,
  '🎓': Icons.award,
  '🏢': Icons.briefcase,
  '🏦': Icons.euro,
  '✅': Icons.check,
  'ℹ️': Icons.info,
  '📑': Icons.fileText,
  '👥': Icons.users,
  '💶': Icons.euro,
  '🏛️': Icons.shield,
  '🌍': Icons.globe,
  '🏠': Icons.home,
  '👨‍👩‍👧': Icons.users,
  '📞': Icons.phone,
  '🔐': Icons.lock,
  '📱': Icons.phone,
  '🖨️': Icons.fileText,
  '💻': Icons.fileText,
  '📄': Icons.fileText,
  '📁': Icons.folder,
  '🎤': Icons.chat,
  '🌐': Icons.globe,
}

export default function HRDocsPage() {
  const { data: session } = useSession()
  const [activeDoc, setActiveDoc] = useState<string>(DOCUMENTS[0].id)
  const [activeChapter, setActiveChapter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileToc, setShowMobileToc] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const isManualScrolling = useRef(false)

  // Edit state
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [savedChapters, setSavedChapters] = useState<Record<string, Chapter>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [modalClickY, setModalClickY] = useState<number | undefined>(undefined)

  // Check if user can edit (Partner or Admin/Head of Office)
  const canEdit = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

  // Fetch saved chapters from API
  useEffect(() => {
    const fetchSavedChapters = async () => {
      try {
        const res = await fetch(`/api/hr-docs?documentId=${activeDoc}`)
        if (res.ok) {
          const chapters = await res.json()
          const chaptersMap: Record<string, Chapter> = {}
          chapters.forEach((ch: any) => {
            chaptersMap[ch.chapterId] = {
              id: ch.chapterId,
              title: ch.title,
              icon: ch.icon,
              content: ch.content,
            }
          })
          setSavedChapters(chaptersMap)
        }
      } catch (error) {
        console.error('Error fetching saved chapters:', error)
      }
    }
    fetchSavedChapters()
  }, [activeDoc])

  // Get current document with saved edits applied
  const currentDoc = useMemo(() => {
    const doc = DOCUMENTS.find(d => d.id === activeDoc) || DOCUMENTS[0]
    // Apply saved edits to chapters
    const chaptersWithEdits = doc.chapters.map(chapter => {
      if (savedChapters[chapter.id]) {
        return savedChapters[chapter.id]
      }
      return chapter
    })
    return { ...doc, chapters: chaptersWithEdits }
  }, [activeDoc, savedChapters])

  // Open edit modal
  const openEditModal = (chapter: Chapter, e?: React.MouseEvent) => {
    if (e) setModalClickY(e.clientY)
    setEditingChapter(chapter)
    setEditTitle(chapter.title)
    setEditContent(htmlToCleanText(chapter.content))
    setEditIcon(chapter.icon)
  }

  // Save chapter edits to API
  const saveChapterEdit = async () => {
    if (!editingChapter) return

    setIsSaving(true)
    // Convert clean text back to HTML
    const htmlContent = cleanTextToHtml(editContent)

    try {
      const res = await fetch('/api/hr-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc,
          chapterId: editingChapter.id,
          title: editTitle,
          icon: editIcon,
          content: htmlContent,
        }),
      })

      if (!res.ok) {
        throw new Error('Kon niet opslaan')
      }

      // Update local state
      setSavedChapters(prev => ({
        ...prev,
        [editingChapter.id]: {
          id: editingChapter.id,
          title: editTitle,
          icon: editIcon,
          content: htmlContent,
        }
      }))

      toast.success('Hoofdstuk opgeslagen')
      setEditingChapter(null)
    } catch (error) {
      toast.error('Kon hoofdstuk niet opslaan')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingChapter(null)
    setEditTitle('')
    setEditContent('')
    setEditIcon('')
  }

  // Set initial active chapter
  useEffect(() => {
    if (currentDoc.chapters.length > 0 && !activeChapter) {
      setActiveChapter(currentDoc.chapters[0].id)
    }
  }, [currentDoc, activeChapter])

  // Track which chapter is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Don't update if user is manually scrolling via click
        if (isManualScrolling.current) return

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chapterId = entry.target.id.replace('chapter-', '')
            setActiveChapter(chapterId)
          }
        })
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )

    currentDoc.chapters.forEach((chapter) => {
      const element = document.getElementById(`chapter-${chapter.id}`)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [currentDoc.chapters])

  // Scroll mobile nav to show active chapter (without affecting page scroll)
  useEffect(() => {
    if (mobileNavRef.current && activeChapter) {
      const activeButton = mobileNavRef.current.querySelector(`[data-chapter="${activeChapter}"]`) as HTMLElement
      if (activeButton) {
        // Use scrollLeft instead of scrollIntoView to avoid affecting page scroll
        const container = mobileNavRef.current
        const buttonLeft = activeButton.offsetLeft
        const buttonWidth = activeButton.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2)
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [activeChapter])

  // Filter chapters based on search
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return currentDoc.chapters
    const query = searchQuery.toLowerCase()
    return currentDoc.chapters.filter(chapter =>
      chapter.title.toLowerCase().includes(query) ||
      chapter.content.toLowerCase().includes(query)
    )
  }, [currentDoc.chapters, searchQuery])

  // Get current chapter
  const currentChapter = useMemo(() => {
    return currentDoc.chapters.find(c => c.id === activeChapter)
  }, [currentDoc.chapters, activeChapter])

  // Scroll to chapter - uses scrollIntoView which works with any scroll container
  const scrollToChapter = (chapterId: string) => {
    // Prevent IntersectionObserver from overriding while scrolling
    isManualScrolling.current = true
    setActiveChapter(chapterId)
    setShowMobileToc(false)

    // Find the element and scroll to it
    const element = document.getElementById(`chapter-${chapterId}`)
    if (element) {
      // scrollIntoView works with any scrollable ancestor
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Re-enable observer after scroll completes
    setTimeout(() => {
      isManualScrolling.current = false
    }, 1500)
  }

  // Highlight search matches in content
  const highlightContent = (content: string) => {
    if (!searchQuery.trim()) return content
    const regex = new RegExp(`(${searchQuery})`, 'gi')
    return content.replace(regex, '<mark class="bg-workx-lime/30 text-white px-1 rounded">$1</mark>')
  }

  return (
    <div className="fade-in pb-8 hr-docs-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
            <Icons.books className="text-blue-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">The Way it Workx</h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Het personeelshandboek van Workx Advocaten</p>
      </div>

      {/* Document Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DOCUMENTS.map((doc) => {
          const DocIcon = documentIcons[doc.id] || Icons.fileText
          return (
            <button
              key={doc.id}
              onClick={() => {
                setActiveDoc(doc.id)
                setActiveChapter('')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeDoc === doc.id
                  ? 'bg-workx-lime text-workx-dark'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              <DocIcon size={18} />
              <span>{doc.title}</span>
            </button>
          )
        })}

        {canEdit && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-dashed border-white/10 transition-all"
          >
            <Icons.plus size={16} />
            <span>Document toevoegen</span>
          </button>
        )}
      </div>

      {/* Mobile Chapter Navigation - Sticky on mobile */}
      <div className="lg:hidden sticky top-0 z-40 -mx-4 px-4 pt-2 pb-4 bg-workx-dark/95 backdrop-blur-sm">
        <div className="card p-3" style={{ overflow: 'visible' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Hoofdstukken</p>
            <button
              onClick={() => setShowMobileToc(true)}
              className="text-xs text-workx-lime flex items-center gap-1"
            >
              <Icons.list size={14} />
              Alle hoofdstukken
            </button>
          </div>
          <div ref={mobileNavRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {currentDoc.chapters.map((chapter) => (
              <div
                key={chapter.id}
                role="button"
                tabIndex={0}
                data-chapter={chapter.id}
                onClick={() => scrollToChapter(chapter.id)}
                onKeyDown={(e) => e.key === 'Enter' && scrollToChapter(chapter.id)}
                className={`chapter-btn flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer select-none touch-manipulation ${
                  activeChapter === chapter.id
                    ? 'bg-workx-lime text-workx-dark font-medium'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white active:bg-white/20'
                }`}
              >
                <span className="chapter-emoji text-base">{chapter.icon}</span>
                <span className="whitespace-nowrap">{chapter.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6 relative">
        {/* Sidebar - Table of Contents */}
        <aside className="hidden lg:block w-72 flex-shrink-0 self-start sticky top-2">
          <div className="card p-4 max-h-[calc(100vh-6rem)] hr-docs-sidebar">
            {/* Search */}
            <div className="relative mb-4">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                placeholder="Zoeken in document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 text-sm"
              />
            </div>

            {/* Document Info */}
            <div className="mb-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
                  {(() => {
                    const DocIcon = documentIcons[currentDoc.id] || Icons.fileText
                    return <DocIcon className="text-blue-400" size={22} />
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{currentDoc.title}</h3>
                  <p className="text-xs text-gray-400">{currentDoc.description}</p>
                </div>
              </div>
              {currentDoc.lastUpdated && (
                <p className="text-xs text-white/30 mt-2">Laatst bijgewerkt: {currentDoc.lastUpdated}</p>
              )}
            </div>

            {/* Chapters */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-2 px-2">
                Inhoudsopgave
              </p>
              {filteredChapters.map((chapter, index) => {
                const IconComponent = chapterIcons[chapter.icon] || Icons.fileText
                const isActive = activeChapter === chapter.id
                return (
                  <div
                    key={chapter.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollToChapter(chapter.id)}
                    onKeyDown={(e) => e.key === 'Enter' && scrollToChapter(chapter.id)}
                    className={`chapter-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all cursor-pointer select-none touch-manipulation ${
                      isActive
                        ? 'bg-workx-lime/10 text-workx-lime border border-workx-lime/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10'
                    }`}
                  >
                    <span className="chapter-emoji text-lg flex-shrink-0">{chapter.icon}</span>
                    <span className="flex-1 truncate">{chapter.title}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-workx-lime" />}
                  </div>
                )
              })}
            </div>

            {filteredChapters.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Icons.search size={24} className="mx-auto mb-2 opacity-50" />
                <p>Geen resultaten voor "{searchQuery}"</p>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile TOC Drawer */}
        {showMobileToc && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileToc(false)}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-workx-gray border-l border-white/10 p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Inhoudsopgave</h3>
                <button onClick={() => setShowMobileToc(false)} className="p-2 text-gray-400 hover:text-white">
                  <Icons.x size={20} />
                </button>
              </div>

              {/* Mobile Search */}
              <div className="relative mb-4">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="text"
                  placeholder="Zoeken..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 text-sm"
                />
              </div>

              {/* Mobile Chapters */}
              <div className="space-y-1">
                {filteredChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollToChapter(chapter.id)}
                    onKeyDown={(e) => e.key === 'Enter' && scrollToChapter(chapter.id)}
                    className={`chapter-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all cursor-pointer select-none touch-manipulation ${
                      activeChapter === chapter.id
                        ? 'bg-workx-lime/10 text-workx-lime'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10'
                    }`}
                  >
                    <span className="chapter-emoji text-lg">{chapter.icon}</span>
                    <span className="flex-1">{chapter.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0" ref={contentRef}>
          {currentDoc.chapters.map((chapter) => (
            <section
              key={chapter.id}
              id={`chapter-${chapter.id}`}
              className="card p-6 sm:p-8 mb-6"
            >
              {/* Chapter Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center text-2xl">
                  {chapter.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white">{chapter.title}</h2>
                  {chapter.subsections && chapter.subsections.length > 0 && (
                    <p className="text-sm text-gray-400">{chapter.subsections.length} onderdelen</p>
                  )}
                </div>
                {canEdit && (
                  <Popover.Root
                    open={editingChapter?.id === chapter.id}
                    onOpenChange={(open) => { if (!open) cancelEdit(); else openEditModal(chapter) }}
                  >
                    <Popover.Trigger asChild>
                      <button
                        className="ml-auto p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        title="Hoofdstuk bewerken"
                      >
                        <Icons.edit size={16} />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="w-[90vw] max-w-3xl bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                        sideOffset={8}
                        collisionPadding={16}
                        side="bottom"
                        align="end"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
                              <Icons.edit className="text-blue-400" size={18} />
                            </div>
                            <h2 className="font-semibold text-white text-lg">Hoofdstuk bewerken</h2>
                          </div>
                          <Popover.Close className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            <Icons.x size={18} />
                          </Popover.Close>
                        </div>

                        {/* Title Input */}
                        <div className="mb-4">
                          <label className="block text-sm text-gray-400 mb-2">Titel</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="input-field"
                            placeholder="Hoofdstuk titel..."
                          />
                        </div>

                        {/* Icon Input */}
                        <div className="mb-4">
                          <label className="block text-sm text-gray-400 mb-2">Icoon (emoji)</label>
                          <input
                            type="text"
                            value={editIcon}
                            onChange={e => setEditIcon(e.target.value)}
                            className="input-field w-20 text-center text-xl"
                            placeholder="📄"
                            maxLength={2}
                          />
                        </div>

                        {/* Content Textarea */}
                        <div className="mb-4">
                          <label className="block text-sm text-gray-400 mb-2">Inhoud</label>
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            className="input-field min-h-[200px] font-mono text-sm resize-y"
                            placeholder="Schrijf hier de inhoud..."
                          />
                          <div className="mt-2 p-3 rounded-lg bg-white/5 text-xs text-gray-400 space-y-1">
                            <p className="font-medium text-gray-300">Opmaak tips:</p>
                            <div><code className="text-workx-lime">## Titel</code> Subkop</div>
                            <div><code className="text-workx-lime">**tekst**</code> Vetgedrukt</div>
                            <div><code className="text-workx-lime">• </code> Opsomming</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-white/5">
                          <Popover.Close className="flex-1 btn-secondary">
                            Annuleren
                          </Popover.Close>
                          <button
                            onClick={saveChapterEdit}
                            disabled={isSaving}
                            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Icons.check size={16} />
                                Opslaan
                              </>
                            )}
                          </button>
                        </div>
                        <Popover.Arrow className="fill-workx-gray" />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </div>

              {/* Chapter Content */}
              <div
                className="prose prose-invert prose-sm max-w-none
                  prose-headings:text-white prose-headings:font-semibold
                  prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                  prose-h4:text-base prose-h4:mt-4 prose-h4:mb-2
                  prose-p:text-white/70 prose-p:leading-relaxed
                  prose-li:text-white/70 prose-li:marker:text-workx-lime
                  prose-strong:text-white prose-strong:font-semibold
                  prose-a:text-workx-lime prose-a:no-underline hover:prose-a:underline
                  prose-ul:my-4 prose-ol:my-4
                  prose-blockquote:border-l-workx-lime prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                "
                dangerouslySetInnerHTML={{
                  __html: highlightContent(chapter.content)
                }}
              />
            </section>
          ))}

          {/* Empty state */}
          {currentDoc.chapters.length === 0 && (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icons.fileText className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Nog geen inhoud</h3>
              <p className="text-gray-400 text-sm mb-4">Dit document heeft nog geen hoofdstukken.</p>
              {canEdit && (
                <button className="btn-primary">
                  <Icons.plus size={16} />
                  <span>Hoofdstuk toevoegen</span>
                </button>
              )}
            </div>
          )}
        </main>
      </div>

    </div>
  )
}
