'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Icons } from '@/components/ui/Icons'
import { renderMarkdown } from '@/lib/markdown'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  hasWebSearch?: boolean
  citations?: Array<{ url: string; title: string }>
  sources?: Array<{ name: string; category: string }>
  confidence?: 'hoog' | 'gemiddeld' | 'laag'
  model?: string
  createdAt?: string
}

interface AttachedDoc {
  id: string
  name: string
  fileType: string
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
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set())
  const [annotatingId, setAnnotatingId] = useState<string | null>(null)
  const [annotationText, setAnnotationText] = useState('')
  const [annotationType, setAnnotationType] = useState<'comment' | 'correction' | 'warning'>('comment')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isThinkingRef = useRef(false) // Tracks thinking state inside streaming closure
  const streamBufferRef = useRef('') // Buffered streaming text for batched updates
  const rafIdRef = useRef<number | null>(null) // requestAnimationFrame ID for batched rendering

  const RESPONSE_OPTIONS = [
    { id: 'kort', label: 'Kort antwoord', instruction: 'Geef een kort en bondig antwoord, maximaal een paar alinea\'s.' },
    { id: 'uitgebreid', label: 'Uitgebreid + bronnen', instruction: 'Geef een uitgebreid en grondig antwoord met bronvermeldingen (wetsartikelen, jurisprudentie, literatuur) waar mogelijk.' },
    { id: 'nl', label: 'Nederlands', instruction: 'Antwoord in het Nederlands.' },
    { id: 'en', label: 'Engels', instruction: 'Answer in English.' },
    { id: 'word', label: 'Word-format', instruction: 'Structureer het antwoord als een formeel document met kopjes, opsommingen en duidelijke paragrafen, geschikt om te kopiëren naar een Word-bestand.' },
    { id: 'client', label: 'Cliënt-taal', instruction: 'Schrijf het antwoord in begrijpelijke taal voor een cliënt die geen juridische achtergrond heeft. Vermijd juridisch jargon of leg het uit. Gebruik een vriendelijke, professionele toon alsof je een e-mail aan de cliënt schrijft. Begin met "Beste [cliënt]," en eindig met een uitnodiging om contact op te nemen bij vragen.' },
    { id: 'vergelijk', label: 'Vergelijk documenten', instruction: 'Vergelijk de bijgevoegde documenten met elkaar. Maak een gestructureerde vergelijking met: (1) Overeenkomsten, (2) Verschillen, (3) Ontbrekende bepalingen, (4) Juridische risico\'s per document. Gebruik een overzichtelijke tabel waar mogelijk. Markeer de belangrijkste afwijkingen met een ⚠️.' },
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
    onNewChat?.()
  }

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      toast.error(`Bestandstype .${ext} niet ondersteund. Toegestaan: pdf, docx, txt, md`)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Bestand is te groot (max 10MB)')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (projectId) formData.append('projectId', projectId)

      const res = await fetch('/api/claude/documents', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload mislukt')
      }
      const doc = await res.json()
      setAttachedDocs(prev => [...prev, { id: doc.id, name: doc.name, fileType: doc.fileType }])
      toast.success(`${file.name} bijgevoegd`)
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Handle quick action prompts from parent
  useEffect(() => {
    if (quickActionPrompt && !isLoading) {
      sendMessage(quickActionPrompt)
      onQuickActionHandled?.()
    }
  }, [quickActionPrompt])

  const exportToDocument = async (content: string, format: 'pdf' | 'docx') => {
    try {
      if (format === 'pdf') {
        // Dynamic import jsPDF
        const { default: jsPDF } = await import('jspdf')
        const doc = new jsPDF({ format: 'a4', unit: 'mm' })
        doc.setFont('helvetica')
        doc.setFontSize(10)
        // Header
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text('Workx Advocaten — AI Assistent', 15, 12)
        doc.text(new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), 195, 12, { align: 'right' })
        doc.setDrawColor(230)
        doc.line(15, 15, 195, 15)
        // Content
        doc.setFontSize(10)
        doc.setTextColor(30)
        const cleaned = content
          .replace(/#{1,6}\s/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
        const lines = doc.splitTextToSize(cleaned, 175)
        doc.text(lines, 15, 22)
        // Footer
        const pageCount = doc.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFontSize(7)
          doc.setTextColor(180)
          doc.text('Dit document is gegenereerd door AI en vormt geen juridisch advies.', 15, 287)
          doc.text(`Pagina ${i} van ${pageCount}`, 195, 287, { align: 'right' })
        }
        doc.save(`workx-ai-${new Date().toISOString().slice(0, 10)}.pdf`)
        toast.success('PDF gedownload')
      } else {
        // Simple DOCX export via HTML blob
        const htmlContent = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
          <head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a}h1,h2,h3{color:#333}p{margin:0 0 8pt}</style></head>
          <body>
          <p style="font-size:8pt;color:#999">Workx Advocaten — AI Assistent — ${new Date().toLocaleDateString('nl-NL')}</p>
          <hr style="border:1px solid #eee">
          ${renderMarkdown(content)}
          <hr style="border:1px solid #eee">
          <p style="font-size:7pt;color:#aaa;margin-top:12pt"><em>Dit document is gegenereerd door AI en vormt geen juridisch advies.</em></p>
          </body></html>`
        const blob = new Blob([htmlContent], { type: 'application/msword' })
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
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsThinking(false)
    isThinkingRef.current = false
    setThinkingText('')
    setThinkingExpanded(false)
    setStatusText('Verbinden met Claude...')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const assistantMsgId = `assistant-${Date.now()}`

    // Timeout after 120 seconds (streaming keeps connection alive)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

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
        }),
        signal: controller.signal,
      })

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

      // Add empty assistant message that we'll update with streamed content
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
              setThinkingText(prev => prev + event.text)
            } else if (event.type === 'delta' && event.text) {
              // First text delta means thinking is done — auto-collapse
              // Use ref to avoid stale closure (isThinking state is captured at function creation)
              if (isThinkingRef.current) {
                isThinkingRef.current = false
                setIsThinking(false)
                setThinkingExpanded(false)
                setStatusText('Claude schrijft...')
              }
              streamedText += event.text
              // Batch updates: accumulate text in ref, only re-render once per animation frame
              streamBufferRef.current = streamedText
              if (!rafIdRef.current) {
                rafIdRef.current = requestAnimationFrame(() => {
                  rafIdRef.current = null
                  const buffered = streamBufferRef.current
                  setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: buffered } : m
                  ))
                })
              }
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
              // Final update with citations, sources, confidence, model
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: streamedText, hasWebSearch, citations, sources, confidence, model: eventModel } : m
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

      // Flush any remaining buffered text
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (streamedText) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: streamedText } : m
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
          errMsg = 'Geen reactie na 2 minuten. Probeer een kortere vraag.'
        } else {
          errMsg = error.message
        }
      }

      console.error('[ClaudeChat] Error:', errMsg)
      toast.error(errMsg, { duration: 15000 })
      setStatusText('')

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
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileAttach}
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center border border-workx-lime/20">
                <Icons.sparkles size={24} className="text-workx-lime" />
              </div>
              <h3 className="text-base font-medium text-white">AI Assistent</h3>
              <p className="text-xs text-white/30">
                Stel je vraag hieronder
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`relative group max-w-[85%]`}>
              {/* Assistant message */}
              {msg.role === 'assistant' && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/10 flex items-center justify-center mt-0.5">
                    <Icons.sparkles size={14} className="text-workx-lime" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl rounded-tl-md px-4 py-3 bg-white/[0.04] border border-white/[0.08]">
                      <div
                        className="claude-response text-sm text-white/90 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    </div>

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
                              <Icons.globe size={10} />
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
                              <Icons.database size={8} />
                              {source.name}
                              <span className="text-white/15">({source.category})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons: Copy, Export, Favorite, Annotate */}
                    {msg.content && (
                      <div className="flex items-center gap-1 mt-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <><Icons.check size={10} /> Gekopieerd</>
                          ) : (
                            <><Icons.copy size={10} /> Kopieer</>
                          )}
                        </button>
                        <button
                          onClick={() => exportToDocument(msg.content, 'pdf')}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors"
                        >
                          <Icons.download size={10} /> PDF
                        </button>
                        <button
                          onClick={() => exportToDocument(msg.content, 'docx')}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors"
                        >
                          <Icons.download size={10} /> Word
                        </button>
                        <span className="text-white/10 mx-0.5">|</span>
                        <button
                          onClick={() => toggleFavorite(msg.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                            favoritedIds.has(msg.id) ? 'text-yellow-400' : 'text-white/30 hover:text-yellow-400'
                          }`}
                        >
                          <Icons.star size={10} /> {favoritedIds.has(msg.id) ? 'Favoriet' : 'Bewaar'}
                        </button>
                        <button
                          onClick={() => setAnnotatingId(annotatingId === msg.id ? null : msg.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                            annotatingId === msg.id ? 'text-blue-400' : 'text-white/30 hover:text-blue-400'
                          }`}
                        >
                          <Icons.chat size={10} /> Annoteer
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
                <div className="rounded-2xl rounded-tr-md px-4 py-3 bg-workx-lime text-workx-dark">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking display - subtle collapsible reasoning */}
        {thinkingText && isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] ml-10">
              {/* Collapsed: tiny label. Expanded: reasoning text */}
              <button
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className="flex items-center gap-1.5 py-1 text-[10px] text-white/25 hover:text-white/40 transition-colors"
              >
                <Icons.chevronRight size={10} className={`transition-transform duration-200 ${thinkingExpanded ? 'rotate-90' : ''}`} />
                {isThinking ? (
                  <>
                    <span>Claude overweegt</span>
                    <div className="flex gap-0.5 ml-0.5">
                      <div className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '0s' }} />
                      <div className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1 h-1 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '0.3s' }} />
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
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/10 flex items-center justify-center">
                <div className="animate-spin">
                  <Icons.refresh size={14} className="text-workx-lime" />
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-workx-lime/60 animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 rounded-full bg-workx-lime/60 animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-2 h-2 rounded-full bg-workx-lime/60 animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                  <span className="text-sm text-white/50">
                    {statusText || 'Claude denkt na...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-white/5 space-y-2">
        {/* Anonymize toggle — prominent, above input */}
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
          <span className="text-white/10 text-[10px]">|</span>
          {RESPONSE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                activeOptions.has(opt.id)
                  ? 'bg-workx-lime/15 border-workx-lime/30 text-workx-lime font-medium'
                  : 'bg-white/[0.03] border-white/10 text-white/35 hover:text-white/60 hover:bg-white/[0.06]'
              } disabled:opacity-30`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          {/* Attach document button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            title="Document bijvoegen (PDF, DOCX, TXT, MD)"
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 text-white/40 flex items-center justify-center hover:text-workx-lime hover:border-workx-lime/30 hover:bg-workx-lime/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <div className="animate-spin">
                <Icons.refresh size={16} />
              </div>
            ) : (
              <Icons.paperclip size={18} />
            )}
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || 'Typ je vraag...'}
              disabled={isLoading}
              spellCheck={false}
              autoComplete="off"
              rows={1}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40 focus:bg-white/[0.07] transition-all disabled:opacity-50"
              style={{ maxHeight: '200px' }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-workx-lime text-workx-dark flex items-center justify-center hover:bg-workx-lime/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-workx-lime/10"
          >
            {isLoading ? (
              <div className="animate-spin">
                <Icons.refresh size={18} />
              </div>
            ) : (
              <Icons.send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
