'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Icons } from '@/components/ui/Icons'
import { renderMarkdown } from '@/lib/markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  hasWebSearch?: boolean
  citations?: Array<{ url: string; title: string }>
  createdAt?: string
}

interface ClaudeChatProps {
  conversationId?: string | null
  projectId?: string | null
  documentIds?: string[]
  initialMessages?: Message[]
  onConversationCreated?: (id: string) => void
  onNewMessage?: () => void
  placeholder?: string
  compact?: boolean
  quickActionPrompt?: string | null
  onQuickActionHandled?: () => void
}

// Stap-voor-stap status indicator
interface StreamStatus {
  phase: 'idle' | 'thinking' | 'searching' | 'analyzing' | 'writing' | 'citing' | 'done'
  detail?: string
}

const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  thinking: { label: 'Nadenken over je vraag...', icon: 'brain' },
  searching: { label: 'Zoeken op het web...', icon: 'globe' },
  analyzing: { label: 'Documenten analyseren...', icon: 'file' },
  writing: { label: 'Antwoord formuleren...', icon: 'edit' },
  citing: { label: 'Bronnen verifiëren...', icon: 'link' },
  done: { label: 'Klaar', icon: 'check' },
}

export default function ClaudeChat({
  conversationId: initialConvId,
  projectId,
  documentIds = [],
  initialMessages = [],
  onConversationCreated,
  onNewMessage,
  placeholder = 'Stel een vraag over arbeidsrecht, contracten, ontslag...',
  compact = false,
  quickActionPrompt,
  onQuickActionHandled,
}: ClaudeChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({ phase: 'idle' })
  const [convId, setConvId] = useState<string | null>(initialConvId || null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    setConvId(initialConvId || null)
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
    if (quickActionPrompt && !isStreaming) {
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
    if (!text || isStreaming) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setStreamStatus({ phase: 'thinking' })

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          projectId,
          message: text,
          documentIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Fout ${response.status}`)
      }

      // Update conversation ID
      if (data.conversationId && !convId) {
        setConvId(data.conversationId)
        onConversationCreated?.(data.conversationId)
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || '',
        hasWebSearch: data.hasWebSearch || false,
        citations: data.citations || [],
      }

      setMessages(prev => [...prev, assistantMessage])
      onNewMessage?.()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Onbekende fout'
      console.error('Chat error:', errMsg)
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Er ging iets mis: ${errMsg}`,
        },
      ])
    } finally {
      setIsStreaming(false)
      setStreamStatus({ phase: 'idle' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Suggested prompts for empty state
  const suggestedPrompts = [
    { label: 'Transitievergoeding berekenen', prompt: 'Hoe bereken ik de transitievergoeding voor een werknemer die 8 jaar in dienst is met een bruto maandsalaris van €4.500?' },
    { label: 'Ontslag procedure uitleggen', prompt: 'Leg de stappen uit voor het ontslaan van een werknemer via de kantonrechter op grond van disfunctioneren (art. 7:669 lid 3 sub d BW).' },
    { label: 'Vaststellingsovereenkomst checken', prompt: 'Waar moet ik op letten bij het beoordelen van een vaststellingsovereenkomst? Geef een complete checklist.' },
    { label: 'Concurrentiebeding toetsen', prompt: 'Wat zijn de vereisten voor een geldig concurrentiebeding en wanneer kan een rechter dit beding geheel of gedeeltelijk vernietigen?' },
  ]

  return (
    <div className={`flex flex-col ${compact ? 'h-[500px]' : 'h-full'}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Empty state with suggested prompts */}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-6 max-w-lg">
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center border border-workx-lime/20">
                  <Icons.sparkles size={28} className="text-workx-lime" />
                </div>
                <h3 className="text-lg font-medium text-white">AI Assistent</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Stel vragen over arbeidsrecht, laat documenten analyseren, of gebruik de snelle acties.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {suggestedPrompts.map((sp) => (
                  <button
                    key={sp.label}
                    onClick={() => sendMessage(sp.prompt)}
                    className="text-left p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    <span className="text-workx-lime/60 text-[10px] block mb-1">Voorbeeld</span>
                    {sp.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-white/20">
                Antwoorden vormen geen juridisch advies. Controleer altijd bronnen.
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`relative group max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
              {/* Avatar */}
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
                            <><Icons.copy size={10} /> Kopiëren</>
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

        {/* Live status indicator */}
        {isStreaming && streamStatus.phase !== 'idle' && streamStatus.phase !== 'done' && streamStatus.phase !== 'writing' && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/10 flex items-center justify-center">
                <div className="animate-pulse">
                  <Icons.sparkles size={14} className="text-workx-lime" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <StatusIndicator phase={streamStatus.phase} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-white/5">
        {/* Typing status bar */}
        {isStreaming && (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-white/30">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-workx-lime/60 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-workx-lime/60 animate-pulse" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-workx-lime/60 animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
            <span>{STATUS_LABELS[streamStatus.phase]?.label || 'Bezig...'}</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isStreaming}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40 focus:bg-white/[0.07] transition-all disabled:opacity-50"
              style={{ maxHeight: '200px' }}
            />
            <div className="absolute right-2 bottom-2 text-[10px] text-white/15">
              Shift+Enter voor nieuwe regel
            </div>
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-workx-lime text-workx-dark flex items-center justify-center hover:bg-workx-lime/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-workx-lime/10"
          >
            {isStreaming ? (
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

/** Animated status indicator component */
function StatusIndicator({ phase }: { phase: string }) {
  const config = STATUS_LABELS[phase]
  if (!config) return null

  const iconMap: Record<string, React.ReactNode> = {
    brain: <Icons.sparkles size={13} className="text-workx-lime" />,
    globe: <Icons.globe size={13} className="text-blue-400" />,
    file: <Icons.file size={13} className="text-amber-400" />,
    edit: <Icons.edit size={13} className="text-workx-lime" />,
    link: <Icons.link size={13} className="text-purple-400" />,
    check: <Icons.check size={13} className="text-green-400" />,
  }

  return (
    <div className="flex items-center gap-2 text-xs text-white/50">
      <div className="animate-pulse">{iconMap[config.icon]}</div>
      <span>{config.label}</span>
      <div className="flex gap-0.5">
        <div className="w-1 h-1 rounded-full bg-white/20 animate-pulse" />
        <div className="w-1 h-1 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-1 h-1 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}
