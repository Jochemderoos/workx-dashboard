'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Icons } from '@/components/ui/Icons'
import { renderMarkdown } from '@/lib/markdown'
import toast from 'react-hot-toast'
import LegalQuickActions from './LegalQuickActions'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  hasWebSearch?: boolean
  citations?: Array<{ url: string; title: string }>
  sources?: Array<{ name: string; category: string; url?: string }>
  confidence?: 'hoog' | 'gemiddeld' | 'laag'
  model?: string
  createdAt?: string
  attachments?: Array<{ name: string; fileType: string }>
  thinkingContent?: string
}

interface AttachedDoc {
  id: string
  name: string
  fileType: string
}

interface DocxEditBlock {
  documentId: string
  documentName: string
  edits: Array<{ find: string; replace: string }>
}

interface ClaudeChatProps {
  conversationId?: string | null
  projectId?: string | null
  documentIds?: string[]
  initialMessages?: Message[]
  onConversationCreated?: (id: string) => void
  onNewMessage?: () => void
  onNewChat?: () => void
  onActiveChange?: (active: boolean) => void
  onSaveToProject?: (conversationId: string) => void
  onHelpClick?: () => void
  placeholder?: string
  compact?: boolean
  quickActionPrompt?: string | null
  onQuickActionHandled?: () => void
}

export default function ClaudeChat({
  conversationId: initialConvId,
  projectId,
  documentIds = [],
  initialMessages = [],
  onConversationCreated,
  onNewMessage,
  onNewChat,
  onActiveChange,
  onSaveToProject,
  onHelpClick,
  placeholder,
  compact = false,
  quickActionPrompt,
  onQuickActionHandled,
}: ClaudeChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [convId, setConvId] = useState<string | null>(initialConvId || null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeOptions, setActiveOptions] = useState<Set<string>>(new Set())
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [anonymize, setAnonymize] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'opus'>('sonnet')
  const [useKnowledgeSources, setUseKnowledgeSources] = useState(true)
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set())
  const [annotatingId, setAnnotatingId] = useState<string | null>(null)
  const [annotationText, setAnnotationText] = useState('')
  const [annotationType, setAnnotationType] = useState<'comment' | 'correction' | 'warning'>('comment')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({})
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isThinkingRef = useRef(false) // Tracks thinking state inside streaming closure
  const thinkingTextRef = useRef('') // Tracks accumulated thinking text for saving after stream ends
  const streamBufferRef = useRef('') // Buffered streaming text
  const abortControllerRef = useRef<AbortController | null>(null) // For stop button
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null) // Throttled streaming markdown render
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('') // Throttled streaming text for markdown rendering
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(new Set()) // Per-message thinking expansion

  const RESPONSE_OPTIONS = [
    { id: 'kort', label: 'Kort antwoord', instruction: 'Geef een kort en bondig antwoord, maximaal een paar alinea\'s.' },
    { id: 'uitgebreid', label: 'Uitgebreid + bronnen', instruction: 'Geef een uitgebreid en grondig antwoord met bronvermeldingen (wetsartikelen, jurisprudentie, literatuur) waar mogelijk.' },
    { id: 'nl', label: 'Nederlands', instruction: 'Antwoord in het Nederlands.' },
    { id: 'en', label: 'Engels', instruction: 'Answer in English.' },
    { id: 'word', label: 'Word-format', instruction: 'Structureer het antwoord als een formeel document met kopjes, opsommingen en duidelijke paragrafen, geschikt om te kopiëren naar een Word-bestand.' },
  ] as const

  const toggleOption = (id: string) => {
    setActiveOptions(prev => {
      const next = new Set(prev)
      // Mutual exclusivity: kort <-> uitgebreid, nl <-> en
      if (id === 'kort' && next.has('uitgebreid')) next.delete('uitgebreid')
      if (id === 'uitgebreid' && next.has('kort')) next.delete('kort')
      if (id === 'nl' && next.has('en')) next.delete('en')
      if (id === 'en' && next.has('nl')) next.delete('nl')

      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildInstructions = (): string => {
    const active = RESPONSE_OPTIONS.filter(o => activeOptions.has(o.id))
    if (active.length === 0) return ''
    return active.map(o => o.instruction).join(' ') + '\n\n'
  }

  /**
   * Parse %%DOCX_EDITS%%...%%END_DOCX_EDITS%% block from message content
   */
  const parseDocxEdits = (content: string): DocxEditBlock | null => {
    const match = content.match(/%%DOCX_EDITS%%([\s\S]*?)%%END_DOCX_EDITS%%/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.documentId && parsed.edits?.length) return parsed as DocxEditBlock
    } catch { /* invalid JSON */ }
    return null
  }

  /**
   * Strip the DOCX_EDITS block from display content
   */
  const stripDocxEdits = (content: string): string => {
    return content.replace(/\s*%%DOCX_EDITS%%[\s\S]*?%%END_DOCX_EDITS%%\s*/, '').trim()
  }

  /**
   * Download a modified DOCX by sending edits to the modify endpoint
   */
  const downloadModifiedDocx = async (editBlock: DocxEditBlock) => {
    try {
      const res = await fetch(`/api/claude/documents/${editBlock.documentId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ edits: editBlock.edits }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Download mislukt' }))
        throw new Error(errData.error || `Server fout (${res.status})`)
      }

      // Check edit results from header
      const editResultsHeader = res.headers.get('X-Edit-Results')
      if (editResultsHeader) {
        try {
          const results = JSON.parse(editResultsHeader) as Array<{ find: string; status: string }>
          const notFound = results.filter(r => r.status === 'not_found')
          if (notFound.length > 0) {
            toast(`${notFound.length} van ${results.length} wijziging(en) niet gevonden in het document`, {
              icon: '⚠️',
              duration: 5000,
            })
          }
        } catch { /* ignore parse errors */ }
      }

      // Download the file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const baseName = editBlock.documentName.replace(/\.docx$/i, '')
      a.download = `${baseName}-bewerkt.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Gewijzigd document gedownload')
    } catch (err) {
      console.error('[downloadModifiedDocx] Error:', err)
      toast.error(err instanceof Error ? err.message : 'Download mislukt')
    }
  }

  // Notify parent when chat becomes active/inactive
  const hasMessages = messages.length > 0 || isLoading
  useEffect(() => {
    onActiveChange?.(hasMessages)
  }, [hasMessages])

  const startNewChat = () => {
    if (isLoading) return
    setMessages([])
    setConvId(null)
    setInput('')
    setAttachedDocs([])
    setActiveOptions(new Set())
    setOptionsExpanded(true) // Re-expand options for new chat
    onNewChat?.()
  }

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''

    const filesToUpload = Array.from(files)

    // Validate all files first
    for (const file of filesToUpload) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        toast.error(`Bestandstype .${ext} niet ondersteund. Toegestaan: pdf, docx, txt, md, png, jpg`)
        return
      }
      const maxSize = ext === 'pdf' ? 32 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error(`${file.name} is te groot (max ${ext === 'pdf' ? '32' : '10'}MB)`)
        return
      }
    }

    setIsUploading(true)
    let uploadedCount = 0
    try {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        if (projectId) formData.append('projectId', projectId)

        const res = await fetch('/api/claude/documents', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Upload mislukt: ${file.name}`)
        }
        const doc = await res.json()
        setAttachedDocs(prev => [...prev, { id: doc.id, name: doc.name, fileType: doc.fileType }])
        uploadedCount++
      }
      if (uploadedCount === 1) {
        toast.success(`${filesToUpload[0].name} bijgevoegd`)
      } else {
        toast.success(`${uploadedCount} bestanden bijgevoegd`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setIsUploading(false)
    }
  }

  const removeAttachedDoc = (docId: string) => {
    setAttachedDocs(prev => prev.filter(d => d.id !== docId))
  }

  // Only sync from parent when initialMessages actually has content
  // (prevents wiping local messages when parent re-renders with empty default [])
  const initialMsgCount = initialMessages.length
  useEffect(() => {
    if (initialMsgCount > 0) {
      setMessages(initialMessages)
    }
  }, [initialMsgCount])

  // Sync convId from parent (including reset to null)
  useEffect(() => {
    setConvId(initialConvId || null)
    setActiveOptions(new Set())
    setAttachedDocs([])
  }, [initialConvId])

  // Load messages from API when mounting with an existing conversation ID
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  useEffect(() => {
    if (initialConvId && initialMessages.length === 0) {
      setIsLoadingHistory(true)
      fetch(`/api/claude/conversations/${initialConvId}`)
        .then(r => {
          if (!r.ok) throw new Error('Kon gesprek niet laden')
          return r.json()
        })
        .then(data => {
          if (data.messages?.length > 0) {
            setMessages(data.messages)
          }
        })
        .catch(err => {
          console.error('[ClaudeChat] Failed to load conversation:', err)
        })
        .finally(() => {
          setIsLoadingHistory(false)
        })
    }
  }, [initialConvId])

  const scrollToBottom = useCallback((instant?: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    // During streaming: instant scroll to avoid jittery smooth-scroll conflicts
    scrollToBottom(isLoading)
  }, [messages, scrollToBottom, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Escape key to stop generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        abortControllerRef.current?.abort()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isLoading])

  // Handle quick action prompts from parent
  useEffect(() => {
    if (quickActionPrompt && !isLoading) {
      sendMessage(quickActionPrompt)
      onQuickActionHandled?.()
    }
  }, [quickActionPrompt])

  // Restore pending message after auto-refresh (from stale-version detection)
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('workx-pending-message')
      if (pending) {
        sessionStorage.removeItem('workx-pending-message')
        setInput(pending)
      }
    } catch { /* ignore */ }
  }, [])

  /** Clean renderMarkdown HTML for document export (strip web-only elements) */
  const cleanHtmlForExport = (html: string): string => {
    return html
      .replace(/<button class="code-copy-btn">.*?<\/button>/g, '') // Remove copy buttons
      .replace(/<span style="position:absolute[^"]*">[^<]*<\/span>/g, '') // Remove floating lang labels
      .replace(/ class="code-block"/g, '') // Remove web-specific classes
      .replace(/ class="inline-code"/g, '') // Remove web-specific classes
      .replace(/ class="concept-document"/g, '') // Remove web-specific classes
      .replace(/ class="source-details"/g, '') // Remove web-specific classes
      .replace(/<div class="table-wrapper">/g, '<div>') // Simplify table wrapper
  }

  /** Shared document CSS for both PDF and Word export */
  const getDocumentStyles = () => `
    @page { size: A4; margin: 2.5cm 2.5cm 2cm 2.5cm; }
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; margin: 0; padding: 0; }
    h1 { font-size: 16pt; font-weight: bold; color: #1a3a5c; margin: 20pt 0 10pt 0; border-bottom: 2pt solid #1a3a5c; padding-bottom: 6pt; }
    h2 { font-size: 13pt; font-weight: bold; color: #1a3a5c; margin: 16pt 0 8pt 0; }
    h3 { font-size: 11pt; font-weight: bold; color: #333; margin: 12pt 0 6pt 0; }
    h4, h5, h6 { font-size: 11pt; font-weight: bold; color: #444; margin: 10pt 0 4pt 0; }
    p { margin: 0 0 8pt 0; text-align: justify; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    ul, ol { margin: 6pt 0 10pt 0; padding-left: 28pt; }
    li { margin: 0 0 4pt 0; line-height: 1.5; }
    hr { border: none; border-top: 1pt solid #ddd; margin: 16pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 10pt; }
    td, th { border: 1pt solid #bbb; padding: 6pt 10pt; text-align: left; vertical-align: top; }
    th { background-color: #f0f4f8; font-weight: bold; color: #1a3a5c; }
    blockquote { margin: 12pt 0; padding: 12pt 18pt; border: 1pt solid #d0d5dd; border-left: 3pt solid #1a3a5c; background-color: #f8f9fb; font-style: normal; color: #333; }
    code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9.5pt; background-color: #f4f4f4; padding: 1pt 4pt; border-radius: 2pt; }
    pre { background-color: #f4f4f4; padding: 10pt 14pt; border-radius: 4pt; overflow-x: auto; margin: 8pt 0; font-size: 9pt; line-height: 1.4; }
    pre code { background: none; padding: 0; }
    a { color: #1a3a5c; text-decoration: underline; }
    del { text-decoration: line-through; color: #888; }
    details { margin: 8pt 0; padding: 8pt 12pt; border: 1pt solid #e0e0e0; border-radius: 4pt; background: #fafafa; }
    summary { font-weight: bold; cursor: pointer; color: #1a3a5c; }
    .header { margin-bottom: 20pt; padding-bottom: 10pt; border-bottom: 2.5pt solid #1a3a5c; }
    .header-title { font-size: 9pt; color: #1a3a5c; font-weight: bold; letter-spacing: 0.5pt; text-transform: uppercase; margin: 0; }
    .header-date { font-size: 9pt; color: #888; margin: 3pt 0 0 0; }
    .footer { font-size: 8pt; color: #999; margin-top: 28pt; border-top: 1pt solid #ddd; padding-top: 10pt; }
  `

  /** Generate full HTML document for export */
  const generateExportHtml = (content: string, isWord = false): string => {
    const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    const markdownHtml = cleanHtmlForExport(renderMarkdown(content))
    const wordXml = isWord ? `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DefaultFonts><w:DefaultFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/></w:DefaultFonts></w:WordDocument></xml><![endif]-->` : ''
    const printStyles = !isWord ? `
      @media print {
        body { margin: 0; }
        .no-print { display: none !important; }
        @page { margin: 2cm 2.5cm; }
      }
    ` : ''

    return `<!DOCTYPE html>
<html${isWord ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"' : ''}>
<head>
<meta charset="utf-8">
<title>Workx Advocaten — AI Assistent</title>
${wordXml}
<style>${getDocumentStyles()}${printStyles}</style>
</head>
<body>
<div class="header">
  <p class="header-title">Workx Advocaten</p>
  <p class="header-date">${date}</p>
</div>
${markdownHtml}
<div class="footer">
  <p><em>Dit document is gegenereerd met behulp van AI en vormt geen juridisch advies. Raadpleeg uw advocaat voor een op uw situatie toegespitst advies.</em></p>
</div>
</body>
</html>`
  }

  const exportToDocument = async (content: string, format: 'pdf' | 'docx') => {
    try {
      const exportContent = stripDocxEdits(content)

      if (format === 'pdf') {
        // PDF: open styled HTML in print window — produces high-quality PDF via browser print
        const html = generateExportHtml(exportContent, false)
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
          toast.error('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.')
          return
        }
        printWindow.document.write(html)
        printWindow.document.close()
        // Wait for content to render, then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
          }, 300)
        }
        // Fallback if onload doesn't fire
        setTimeout(() => {
          try { printWindow.print() } catch { /* ignore */ }
        }, 1000)
        toast.success('Print-venster geopend — kies "Opslaan als PDF"')
      } else {
        // Word: download as HTML with .doc extension
        const html = generateExportHtml(exportContent, true)
        const blob = new Blob([html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `workx-ai-${new Date().toISOString().slice(0, 10)}.doc`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Word-document gedownload')
      }
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Export mislukt')
    }
  }

  const toggleFavorite = async (messageId: string) => {
    try {
      const res = await fetch('/api/claude/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      const data = await res.json()
      setFavoritedIds(prev => {
        const next = new Set(prev)
        if (data.favorited) next.add(messageId)
        else next.delete(messageId)
        return next
      })
      toast.success(data.favorited ? 'Opgeslagen als favoriet' : 'Favoriet verwijderd')
    } catch {
      toast.error('Kon favoriet niet opslaan')
    }
  }

  const submitAnnotation = async (messageId: string) => {
    if (!annotationText.trim()) return
    try {
      const res = await fetch('/api/claude/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content: annotationText, type: annotationType }),
      })
      const annotation = await res.json()
      setAnnotations(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), annotation],
      }))
      setAnnotatingId(null)
      setAnnotationText('')
      toast.success('Annotatie geplaatst')
    } catch {
      toast.error('Kon annotatie niet plaatsen')
    }
  }

  // Event delegation for code block copy buttons and details toggle (rendered via dangerouslySetInnerHTML)
  const handleMessagesClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    // Code copy buttons
    const copyBtn = target.closest('.code-copy-btn') as HTMLElement | null
    if (copyBtn) {
      e.preventDefault()
      const codeBlock = copyBtn.parentElement?.querySelector('code')
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent || '')
        const original = copyBtn.textContent
        copyBtn.textContent = 'Gekopieerd!'
        copyBtn.style.color = 'rgba(249,255,133,0.8)'
        setTimeout(() => { copyBtn.textContent = original; copyBtn.style.color = '' }, 2000)
      }
      return
    }

    // Details/summary: let native browser behavior handle the toggle
    // Do NOT preventDefault — that breaks the native <details> open/close
    const summary = target.closest('summary') as HTMLElement | null
    if (summary) {
      return // Let the browser handle it natively
    }
  }, [])

  const copyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  const sendMessage = async (overrideMessage?: string) => {
    const text = overrideMessage || input.trim()
    if (!text || isLoading) return

    // Build the full message with option instructions prepended
    const instructions = buildInstructions()
    const fullMessage = instructions ? instructions + text : text

    // Add user message (show only the user's text, not the instructions)
    const currentAttachments = attachedDocs.length > 0
      ? attachedDocs.map(d => ({ name: d.name, fileType: d.fileType }))
      : undefined
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      attachments: currentAttachments,
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsThinking(false)
    isThinkingRef.current = false
    setThinkingText('')
    thinkingTextRef.current = ''
    setThinkingExpanded(false)
    setStatusText('Verbinden met Claude...')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const assistantMsgId = `assistant-${Date.now()}`

    setLastFailedMessage(null)

    // AbortController for cancellation + timeouts
    const controller = new AbortController()
    abortControllerRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min overall timeout

    try {
      setStatusText('Verzoek versturen...')

      const response = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: convId,
          projectId,
          message: fullMessage,
          documentIds: [...documentIds, ...attachedDocs.map(d => d.id)],
          anonymize,
          model: selectedModel,
          useKnowledgeSources,
        }),
        signal: controller.signal,
      })

      // Stale-version detection: if server build ID differs from client, auto-refresh
      const serverBuildId = response.headers.get('X-Build-Id')
      const clientBuildId = process.env.NEXT_PUBLIC_BUILD_ID
      if (serverBuildId && clientBuildId && serverBuildId !== clientBuildId) {
        console.log(`[ClaudeChat] Build mismatch: client=${clientBuildId} server=${serverBuildId} — refreshing`)
        clearTimeout(timeoutId)
        // Save the user's message so they don't lose it
        try { sessionStorage.setItem('workx-pending-message', text) } catch { /* ignore */ }
        window.location.reload()
        return
      }

      if (!response.ok) {
        clearTimeout(timeoutId)
        const rawText = await response.text()
        let errorMsg = `Server fout (${response.status})`
        try {
          const errData = JSON.parse(rawText)
          if (errData.error) errorMsg = errData.error
        } catch {
          if (rawText.length > 0) errorMsg = rawText.slice(0, 200)
        }
        throw new Error(errorMsg)
      }

      if (!response.body) {
        throw new Error('Server gaf geen stream terug')
      }

      setStatusText('Claude schrijft...')
      setOptionsExpanded(false) // Collapse options to maximize answer space
      setStreamingMsgId(assistantMsgId) // Mark which message is streaming

      // Start throttled markdown rendering interval (80ms — smooth incremental rendering)
      streamBufferRef.current = ''
      setStreamingContent('')
      streamIntervalRef.current = setInterval(() => {
        if (streamBufferRef.current) {
          setStreamingContent(streamBufferRef.current)
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        }
      }, 80)

      // Add empty assistant message placeholder
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
      }])

      // Read SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamedText = ''
      let hasWebSearch = false
      let citations: Array<{ url: string; title: string }> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events from buffer
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Keep incomplete event in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'start' && event.conversationId) {
              if (!convId) {
                setConvId(event.conversationId)
                onConversationCreated?.(event.conversationId)
              }
            } else if (event.type === 'thinking_start') {
              setIsThinking(true)
              isThinkingRef.current = true
              setStatusText('Claude overweegt...')
            } else if (event.type === 'thinking' && event.text) {
              thinkingTextRef.current += event.text
              setThinkingText(prev => prev + event.text)
            } else if (event.type === 'delta' && event.text) {
              // First text delta means thinking is done — auto-collapse
              if (isThinkingRef.current) {
                isThinkingRef.current = false
                setIsThinking(false)
                setThinkingExpanded(false)
                setStatusText('Claude schrijft...')
              }
              streamedText += event.text
              streamBufferRef.current = streamedText
            } else if (event.type === 'status' && event.text) {
              setStatusText(event.text)
            } else if (event.type === 'done') {
              hasWebSearch = event.hasWebSearch || false
              citations = event.citations || []
              const sources = event.sources || []
              const eventModel = event.model || ''
              // Parse confidence from response content
              let confidence: 'hoog' | 'gemiddeld' | 'laag' | undefined
              const confMatch = streamedText.match(/%%CONFIDENCE:(hoog|gemiddeld|laag)%%/)
              if (confMatch) {
                confidence = confMatch[1] as 'hoog' | 'gemiddeld' | 'laag'
                // Strip the confidence tag from displayed text
                streamedText = streamedText.replace(/\s*%%CONFIDENCE:(hoog|gemiddeld|laag)%%\s*$/, '')
              }
              // Final update: flush content into React state + render markdown
              setStreamingMsgId(null)
              if (streamIntervalRef.current) {
                clearInterval(streamIntervalRef.current)
                streamIntervalRef.current = null
              }
              setStreamingContent('')
              // Capture thinking text so it persists after streaming ends
              const savedThinking = thinkingTextRef.current || undefined
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: streamedText, hasWebSearch, citations, sources, confidence, model: eventModel, thinkingContent: savedThinking } : m
              ))
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Onbekende fout')
            }
          } catch (parseErr) {
            // Re-throw application errors (from event.type === 'error')
            if (parseErr instanceof Error && parseErr.message && parseErr.message !== jsonStr) {
              throw parseErr
            }
            // JSON parse errors are just warnings (e.g. incomplete chunk)
            console.warn('[ClaudeChat] SSE parse warning:', jsonStr.slice(0, 100))
          }
        }
      }

      clearTimeout(timeoutId)
      setStreamingMsgId(null)

      // Flush final content into state if not already done by 'done' event
      if (streamedText) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId && !m.content ? { ...m, content: streamedText } : m
        ))
      }

      if (!streamedText) {
        // Remove empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
        throw new Error('Claude gaf een leeg antwoord')
      }

      onNewMessage?.()
      setAttachedDocs([]) // Clear attached docs after successful send
      setStatusText('')

    } catch (error) {
      clearTimeout(timeoutId)
      let errMsg = 'Onbekende fout'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errMsg = 'Generatie gestopt.'
        } else {
          errMsg = error.message
        }
      }

      console.error('[ClaudeChat] Error:', errMsg)
      toast.error(errMsg, { duration: 15000 })
      setStatusText('')
      setStreamingMsgId(null)
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
      setStreamingContent('')
      setLastFailedMessage(text) // Enable retry

      // If we already have streamed content, keep it and add error note
      setMessages(prev => {
        const existing = prev.find(m => m.id === assistantMsgId)
        if (existing && existing.content) {
          return prev // Keep partial response
        }
        // Replace empty assistant msg with error
        return prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `**Fout:** ${errMsg}\n\nProbeer het opnieuw of ververs de pagina (Ctrl+Shift+R).` }
            : m
        ).concat(
          !prev.some(m => m.id === assistantMsgId)
            ? [{
                id: `error-${Date.now()}`,
                role: 'assistant' as const,
                content: `**Fout:** ${errMsg}\n\nProbeer het opnieuw of ververs de pagina (Ctrl+Shift+R).`,
              }]
            : []
        )
      })
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
    }
  }

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
    setStatusText('Gestopt')
  }

  const retryLastMessage = () => {
    if (lastFailedMessage) {
      // Remove the error message from the list
      setMessages(prev => {
        const lastAssistant = [...prev].reverse().find(m => m.role === 'assistant')
        if (lastAssistant?.content?.startsWith('**Fout:**')) {
          return prev.filter(m => m.id !== lastAssistant.id)
        }
        return prev
      })
      // Also remove the last user message (sendMessage will re-add it)
      setMessages(prev => {
        const reversed = [...prev].reverse()
        const lastUser = reversed.find(m => m.role === 'user')
        if (lastUser) return prev.filter(m => m.id !== lastUser.id)
        return prev
      })
      const msg = lastFailedMessage
      setLastFailedMessage(null)
      sendMessage(msg)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-[500px]' : 'h-full'}`}>
      {/* Hidden file input for document attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={handleFileAttach}
        multiple
        className="hidden"
      />

      {/* Top bar with New Chat + Save to Project buttons */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-white/30">
          {convId && messages.length > 0 && (
            <span>{messages.filter(m => m.role === 'user').length} berichten</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save to project — only when conversation exists and is NOT already in a project */}
          {convId && !projectId && onSaveToProject && (
            <button
              onClick={() => onSaveToProject(convId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white/[0.05] border border-white/10 text-white/50 hover:text-blue-400 hover:border-blue-400/30 hover:bg-blue-400/5"
            >
              <Icons.folder size={14} />
              Opslaan in project
            </button>
          )}
          <button
            onClick={startNewChat}
            disabled={isLoading || (messages.length === 0 && !convId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white/[0.05] border border-white/10 text-white/50 hover:text-workx-lime hover:border-workx-lime/30 hover:bg-workx-lime/5 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Icons.plus size={14} />
            Nieuwe chat
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5" onClick={handleMessagesClick}>
        {/* Loading conversation history */}
        {isLoadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-white/40">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-workx-lime/40 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-workx-lime/40 typing-dot" />
                <div className="w-2 h-2 rounded-full bg-workx-lime/40 typing-dot" />
              </div>
              <span className="text-sm">Gesprek laden...</span>
            </div>
          </div>
        )}

        {/* Empty state — personal intro */}
        {messages.length === 0 && !isLoading && !isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full pb-16 relative">
            {/* Subtle ambient glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-workx-lime/[0.03] rounded-full blur-[100px] pointer-events-none" />

            <div className="relative text-center space-y-4 max-w-lg mx-auto">
              <p className="text-[15px] text-white/70 leading-relaxed">
                Ik ben de <span className="text-white font-medium">Workx AI Assistent</span>. Ik help je verder bij al je juridische vragen.
              </p>
              <p className="text-[13px] text-white/35 leading-relaxed">
                Hulp nodig? Klik hieronder en ik vertel je wat ik allemaal kan.
              </p>
              {onHelpClick && (
                <button
                  onClick={onHelpClick}
                  className="mt-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 bg-white/[0.04] border border-white/[0.08] hover:text-workx-lime hover:bg-workx-lime/[0.08] hover:border-workx-lime/25 hover:shadow-[0_0_20px_-5px_rgba(249,255,133,0.15)] transition-all duration-300"
                >
                  Hulp nodig?
                </button>
              )}
              <div className="pt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] text-white/20">
                {['T&C Arbeidsrecht', 'Thematica', 'RAR', 'VAAN', 'Tijdschrift ArbeidsRecht'].map((source, i) => (
                  <span key={source} className="inline-flex items-center">
                    <span className="text-white/25">{source}</span>
                    {i < 4 && <span className="mx-1 text-white/10">&middot;</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, msgIndex) => {
          const isStreaming = streamingMsgId === msg.id

          return (
          <div
            key={msg.id}
            className={`flex message-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`relative group ${msg.role === 'user' ? 'max-w-[80%]' : 'w-full'}`}>
              {/* Assistant message */}
              {msg.role === 'assistant' && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-workx-lime/20 via-workx-lime/10 to-transparent flex items-center justify-center mt-0.5 border border-workx-lime/10">
                    <span className="text-[11px] font-bold text-workx-lime">W</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Saved thinking content (collapsible, persists after streaming) */}
                    {!isStreaming && msg.thinkingContent && (
                      <div className="mb-1.5">
                        <button
                          onClick={() => setExpandedThinkingIds(prev => {
                            const next = new Set(prev)
                            if (next.has(msg.id)) next.delete(msg.id)
                            else next.add(msg.id)
                            return next
                          })}
                          className="flex items-center gap-1.5 py-1 text-[10px] text-white/25 hover:text-white/40 transition-colors"
                        >
                          <Icons.chevronRight size={10} className={`transition-transform duration-200 ${expandedThinkingIds.has(msg.id) ? 'rotate-90' : ''}`} />
                          <span>Overwegingen bekijken</span>
                        </button>
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                          expandedThinkingIds.has(msg.id) ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <div className="rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.04] overflow-y-auto max-h-[180px] mb-2">
                            <p className="text-[11px] text-white/25 leading-relaxed whitespace-pre-wrap">
                              {msg.thinkingContent}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={`assistant-bubble rounded-2xl rounded-tl-md px-5 py-4 ${isStreaming ? 'assistant-bubble-streaming' : ''}`}>
                      {isStreaming ? (
                        // Streaming: throttled markdown rendering (80ms interval)
                        <div
                          className="claude-response text-sm text-white/90"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) + '<span class="streaming-cursor"></span>' }}
                        />
                      ) : (
                        // Completed: full markdown rendering (strip DOCX edit blocks from display)
                        <div
                          className="claude-response text-sm text-white/90"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(stripDocxEdits(msg.content)) }}
                        />
                      )}
                    </div>

                    {/* DOCX Edit download button */}
                    {!isStreaming && msg.content && (() => {
                      const editBlock = parseDocxEdits(msg.content)
                      if (!editBlock) return null
                      return (
                        <div className="mt-2.5 ml-0.5">
                          <button
                            onClick={() => downloadModifiedDocx(editBlock)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/15 hover:border-green-500/40 transition-all text-xs font-medium"
                          >
                            <Icons.download size={14} />
                            <span>Download gewijzigd document ({editBlock.documentName})</span>
                            <span className="text-green-400/50 text-[10px]">
                              {editBlock.edits.length} wijziging{editBlock.edits.length !== 1 ? 'en' : ''}
                            </span>
                          </button>
                        </div>
                      )
                    })()}

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 ml-1">
                        <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5 font-medium">Bronnen</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((citation, idx) => (
                            <a
                              key={idx}
                              href={citation.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/50 hover:text-workx-lime hover:border-workx-lime/30 transition-all"
                              title={citation.url}
                            >
                              <span className="truncate max-w-[200px]">{citation.title || (() => { try { return new URL(citation.url).hostname } catch { return citation.url } })()}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence + Sources + Model metadata */}
                    {(msg.confidence || msg.sources?.length || msg.model) && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 ml-1">
                        {/* Confidence badge */}
                        {msg.confidence && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                            msg.confidence === 'hoog'
                              ? 'bg-green-500/10 border-green-500/20 text-green-400'
                              : msg.confidence === 'gemiddeld'
                              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              msg.confidence === 'hoog' ? 'bg-green-400' : msg.confidence === 'gemiddeld' ? 'bg-yellow-400' : 'bg-red-400'
                            }`} />
                            {msg.confidence === 'hoog' ? 'Hoge betrouwbaarheid' : msg.confidence === 'gemiddeld' ? 'Gemiddelde betrouwbaarheid' : 'Lage betrouwbaarheid — verifieer'}
                          </span>
                        )}
                        {/* Model badge */}
                        {msg.model && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border bg-white/5 border-white/10 text-white/30">
                            {msg.model.includes('opus') ? 'Opus' : 'Sonnet'}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Knowledge sources used */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1.5 ml-1">
                        <p className="text-[10px] uppercase tracking-wider text-white/20 mb-1 font-medium">Kennisbronnen gebruikt</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((source, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/35"
                            >
                              {source.name}
                              <span className="text-white/15">({source.category})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons: Copy, Export, Favorite, Annotate */}
                    {msg.content && !isStreaming && (
                      <div className="flex items-center gap-0.5 mt-2.5 ml-0.5">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            copiedId === msg.id
                              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                              : 'bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.06]'
                          }`}
                        >
                          {copiedId === msg.id ? 'Gekopieerd' : 'Kopieer'}
                        </button>
                        <button
                          onClick={() => exportToDocument(msg.content, 'docx')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.06] transition-all"
                        >
                          Word
                        </button>
                        <button
                          onClick={() => exportToDocument(msg.content, 'pdf')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.06] transition-all"
                        >
                          PDF
                        </button>
                      </div>
                    )}

                    {/* Annotations display */}
                    {annotations[msg.id]?.length > 0 && (
                      <div className="mt-2 ml-1 space-y-1">
                        {annotations[msg.id].map((ann) => (
                          <div
                            key={ann.id}
                            className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                              ann.type === 'correction' ? 'bg-red-500/5 border border-red-500/10' :
                              ann.type === 'warning' ? 'bg-yellow-500/5 border border-yellow-500/10' :
                              'bg-blue-500/5 border border-blue-500/10'
                            }`}
                          >
                            <span className="font-medium text-white/50 shrink-0">{ann.user?.name || 'Collega'}:</span>
                            <span className="text-white/40">{ann.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Annotation form */}
                    {annotatingId === msg.id && (
                      <div className="mt-2 ml-1 p-2.5 rounded-lg bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center gap-1.5">
                          {(['comment', 'correction', 'warning'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setAnnotationType(t)}
                              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                                annotationType === t
                                  ? t === 'correction' ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : t === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                  : 'bg-white/5 border-white/10 text-white/30'
                              }`}
                            >
                              {t === 'comment' ? 'Opmerking' : t === 'correction' ? 'Correctie' : 'Waarschuwing'}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-end gap-2">
                          <input
                            type="text"
                            value={annotationText}
                            onChange={(e) => setAnnotationText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitAnnotation(msg.id)}
                            placeholder="Schrijf een annotatie..."
                            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-400/40"
                            autoFocus
                          />
                          <button
                            onClick={() => submitAnnotation(msg.id)}
                            disabled={!annotationText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-30"
                          >
                            Plaatsen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* User message */}
              {msg.role === 'user' && (
                <div className="user-bubble rounded-2xl rounded-tr-md px-5 py-3.5 text-workx-dark">
                  {/* Attachment indicators */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachments.map((att, idx) => {
                        const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(att.fileType)
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-workx-dark/10 text-[11px] text-workx-dark/80"
                          >
                            {isImage ? (
                              <Icons.image size={11} />
                            ) : att.fileType === 'pdf' ? (
                              <Icons.file size={11} />
                            ) : (
                              <Icons.paperclip size={11} />
                            )}
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          </div>
          )
        })}

        {/* Thinking display - subtle collapsible reasoning */}
        {thinkingText && isLoading && (
          <div className="flex justify-start message-fade-in">
            <div className="max-w-[85%] ml-10">
              {/* Collapsed: tiny label. Expanded: reasoning text */}
              <button
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className="flex items-center gap-1.5 py-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors"
              >
                <Icons.chevronRight size={10} className={`transition-transform duration-200 ${thinkingExpanded ? 'rotate-90' : ''}`} />
                {isThinking ? (
                  <>
                    <span className="font-medium">Claude overweegt</span>
                    <div className="flex gap-0.5 ml-1">
                      <div className="w-1 h-1 rounded-full bg-workx-lime/40 typing-dot" />
                      <div className="w-1 h-1 rounded-full bg-workx-lime/40 typing-dot" />
                      <div className="w-1 h-1 rounded-full bg-workx-lime/40 typing-dot" />
                    </div>
                  </>
                ) : (
                  <span>Overwegingen bekijken</span>
                )}
              </button>
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                thinkingExpanded || isThinking ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.04] overflow-y-auto max-h-[180px] mb-2">
                  <p className="text-[11px] text-white/25 leading-relaxed whitespace-pre-wrap">
                    {thinkingText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator (only when not thinking) */}
        {isLoading && !isThinking && !thinkingText && (
          <div className="flex justify-start message-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-workx-lime/20 via-workx-lime/10 to-transparent flex items-center justify-center border border-workx-lime/10">
                <span className="text-[11px] font-bold text-workx-lime">W</span>
              </div>
              <div className="space-y-2">
                <div className="assistant-bubble assistant-bubble-streaming rounded-2xl rounded-tl-md px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-workx-lime/60 typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-workx-lime/60 typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-workx-lime/60 typing-dot" />
                    </div>
                    <span className="text-sm text-white/40">
                      {statusText || 'Claude denkt na...'}
                    </span>
                  </div>
                </div>
                <div className="thinking-shimmer ml-2 w-32" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — compact when options collapsed, expanded when shown */}
      <div className="flex-shrink-0 border-t border-white/[0.06] chat-input-area">
        {/* Collapsible options panel */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            optionsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pt-3 space-y-2">
            {/* Anonymize toggle */}
            <button
              type="button"
              onClick={() => setAnonymize(!anonymize)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                anonymize
                  ? 'bg-workx-lime/10 border-workx-lime/30'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
              }`}
            >
              <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all ${
                anonymize
                  ? 'bg-workx-lime border-workx-lime'
                  : 'border-white/20'
              }`}>
                {anonymize && <Icons.check size={12} className="text-workx-dark" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icons.shield size={14} className={anonymize ? 'text-workx-lime' : 'text-white/40'} />
                  <span className={`text-xs font-medium ${anonymize ? 'text-workx-lime' : 'text-white/60'}`}>
                    Anonimiseer persoonsgegevens
                  </span>
                </div>
                {anonymize ? (
                  <p className="text-[10px] text-workx-lime/60 mt-0.5 leading-relaxed">
                    PII wordt vervangen door placeholders ([Persoon-1], [BSN-1], etc.) voordat het naar AI wordt gestuurd.
                  </p>
                ) : (
                  <p className="text-[10px] text-white/25 mt-0.5 leading-relaxed">
                    De Orde van Advocaten vereist dat persoonsgegevens van cli&#235;nten worden geanonimiseerd voordat deze in een AI-tool worden ingelezen.
                  </p>
                )}
              </div>
            </button>

            {/* Model selector + Response option chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Model toggle */}
              <div className="flex items-center rounded-lg border border-white/10 overflow-hidden mr-1">
                <button
                  onClick={() => setSelectedModel('sonnet')}
                  disabled={isLoading}
                  className={`px-2.5 py-1 text-[11px] transition-all ${
                    selectedModel === 'sonnet'
                      ? 'bg-workx-lime/15 text-workx-lime font-medium'
                      : 'bg-transparent text-white/35 hover:text-white/60'
                  } disabled:opacity-30`}
                >
                  Sonnet
                </button>
                <button
                  onClick={() => setSelectedModel('opus')}
                  disabled={isLoading}
                  className={`px-2.5 py-1 text-[11px] transition-all border-l border-white/10 ${
                    selectedModel === 'opus'
                      ? 'bg-purple-500/15 text-purple-400 font-medium'
                      : 'bg-transparent text-white/35 hover:text-white/60'
                  } disabled:opacity-30`}
                  title="Opus — diepgaandere analyse, langzamer"
                >
                  Opus
                </button>
              </div>

              {/* Knowledge sources toggle */}
              <button
                onClick={() => setUseKnowledgeSources(!useKnowledgeSources)}
                disabled={isLoading}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                  useKnowledgeSources
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 font-medium'
                    : 'bg-white/[0.03] border-white/10 text-white/35 hover:text-white/60 hover:bg-white/[0.06]'
                } disabled:opacity-30`}
                title={useKnowledgeSources ? 'Kennisbronnen AAN — zoekt in T&C, Thematica, VAAN, RAR' : 'Kennisbronnen UIT — sneller antwoord, geen bronvermelding'}
              >
                {useKnowledgeSources ? '\u{1F4DA}' : '\u{1F4AD}'} Bronnen {useKnowledgeSources ? 'aan' : 'uit'}
              </button>

              <span className="text-white/10 text-[10px]">|</span>
              {RESPONSE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  disabled={isLoading}
                  className={`option-chip px-2.5 py-1 rounded-lg text-[11px] border ${
                    activeOptions.has(opt.id)
                      ? 'bg-workx-lime/15 border-workx-lime/30 text-workx-lime font-medium'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.06]'
                  } disabled:opacity-30`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Always visible: input row with inline toggle + active indicators */}
        <div className="px-4 pb-3 pt-2 space-y-2">
          {/* Retry button after error */}
          {lastFailedMessage && !isLoading && (
            <button
              onClick={retryLastMessage}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-all text-xs font-medium w-full justify-center"
            >
              <Icons.refresh size={14} />
              Opnieuw proberen
            </button>
          )}

          {/* Attached documents chips */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400"
                >
                  {anonymize && <Icons.shield size={9} className="text-workx-lime" />}
                  <Icons.paperclip size={10} />
                  <span className="truncate max-w-[150px]">{doc.name}</span>
                  <button
                    onClick={() => removeAttachedDoc(doc.id)}
                    className="hover:text-white transition-colors"
                  >
                    <Icons.x size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Collapsed state: show compact summary of active options + toggle button */}
          {!optionsExpanded && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setOptionsExpanded(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.07] hover:border-white/20"
              >
                <Icons.settings size={12} />
                Opties
                <Icons.chevronRight size={10} className="rotate-90" />
              </button>
              {/* Show compact active indicators */}
              {anonymize && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-workx-lime/10 border border-workx-lime/20 text-[10px] text-workx-lime">
                  <Icons.shield size={9} /> Anoniem
                </span>
              )}
              {selectedModel === 'opus' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400">
                  Opus
                </span>
              )}
              {activeOptions.size > 0 && (
                <>
                  {Array.from(activeOptions).map(optId => {
                    const opt = RESPONSE_OPTIONS.find(o => o.id === optId)
                    return opt ? (
                      <span
                        key={optId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-workx-lime/10 border border-workx-lime/20 text-[10px] text-workx-lime"
                      >
                        {opt.label}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleOption(optId) }}
                          className="hover:text-white transition-colors ml-0.5"
                        >
                          <Icons.x size={8} />
                        </button>
                      </span>
                    ) : null
                  })}
                </>
              )}
            </div>
          )}

          {/* Expanded state: show collapse button */}
          {optionsExpanded && messages.length > 0 && (
            <button
              onClick={() => setOptionsExpanded(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all text-white/30 hover:text-white/60"
            >
              <Icons.chevronRight size={10} className="-rotate-90" />
              Opties verbergen
            </button>
          )}

          <div className="flex items-end gap-2.5">
            {/* Attach document button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              title="Bestanden bijvoegen (PDF, DOCX, TXT, afbeeldingen)"
              className="attach-btn flex-shrink-0 w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 flex items-center justify-center hover:text-workx-lime hover:border-workx-lime/25 hover:bg-workx-lime/5 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <div className="animate-spin">
                  <Icons.refresh size={16} />
                </div>
              ) : (
                <Icons.paperclip size={18} />
              )}
            </button>

            <div className="flex-1 chat-input-wrapper">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || 'Stel een juridische vraag...'}
                disabled={isLoading}
                spellCheck={false}
                autoComplete="off"
                rows={1}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[15px] placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/30 focus:bg-white/[0.06] transition-all duration-300 disabled:opacity-50"
                style={{ maxHeight: '200px' }}
              />
            </div>
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="stop-btn flex-shrink-0 w-11 h-11 rounded-xl bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500 shadow-lg shadow-red-500/10"
                title="Stop generatie (Esc)"
              >
                <div className="w-3.5 h-3.5 rounded-sm bg-white" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="send-btn flex-shrink-0 w-11 h-11 rounded-xl bg-workx-lime text-workx-dark flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-workx-lime/10"
              >
                <Icons.send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
