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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Only update convId when parent explicitly passes a new one
  useEffect(() => {
    if (initialConvId) {
      setConvId(initialConvId)
    }
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
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
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
            } else if (event.type === 'delta' && event.text) {
              streamedText += event.text
              // Update the assistant message content in-place
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: streamedText } : m
              ))
            } else if (event.type === 'status' && event.text) {
              setStatusText(event.text)
            } else if (event.type === 'done') {
              hasWebSearch = event.hasWebSearch || false
              citations = event.citations || []
              // Final update with citations
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, hasWebSearch, citations } : m
              ))
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Onbekende fout')
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Onbekende fout' && !parseErr.message.startsWith('Claude')) {
              console.warn('[ClaudeChat] SSE parse warning:', jsonStr.slice(0, 100))
            } else {
              throw parseErr
            }
          }
        }
      }

      if (!streamedText) {
        // Remove empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
        throw new Error('Claude gaf een leeg antwoord')
      }

      onNewMessage?.()
      setAttachedDocs([]) // Clear attached docs after successful send
      toast.dismiss()
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

      {/* Top bar with New Chat button */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-white/30">
          {convId && messages.length > 0 && (
            <span>{messages.filter(m => m.role === 'user').length} berichten</span>
          )}
        </div>
        <button
          onClick={startNewChat}
          disabled={isLoading || (messages.length === 0 && !convId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white/[0.05] border border-white/10 text-white/50 hover:text-workx-lime hover:border-workx-lime/30 hover:bg-workx-lime/5 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <Icons.plus size={14} />
          Nieuwe chat
        </button>
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
                              <span className="truncate max-w-[200px]">{citation.title || new URL(citation.url).hostname}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Copy button */}
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

        {/* Loading/thinking indicator */}
        {isLoading && (
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
        {/* Attached documents chips */}
        {attachedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedDocs.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400"
              >
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

        {/* Response option chips */}
        <div className="flex flex-wrap gap-1.5">
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
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-[inherit] placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40 focus:bg-white/[0.07] transition-all disabled:opacity-50"
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
