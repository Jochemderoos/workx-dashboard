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

export default function ClaudeChat({
  conversationId: initialConvId,
  projectId,
  documentIds = [],
  initialMessages = [],
  onConversationCreated,
  onNewMessage,
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

    // Add user message
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

    const toastId = toast.loading('Claude denkt na...')

    // Timeout after 90 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    try {
      setStatusText('Verzoek versturen...')

      const response = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: convId,
          projectId,
          message: text,
          documentIds,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      setStatusText('Antwoord verwerken...')

      // Read response as text first (avoids double-read issue)
      const rawText = await response.text()

      if (!response.ok) {
        let errorMsg = `Server fout (${response.status})`
        try {
          const errData = JSON.parse(rawText)
          if (errData.error) errorMsg = errData.error
        } catch {
          if (rawText.length > 0) errorMsg = rawText.slice(0, 200)
        }
        throw new Error(errorMsg)
      }

      if (!rawText) {
        throw new Error('Server gaf een leeg antwoord')
      }

      let data: {
        conversationId?: string
        content?: string
        hasWebSearch?: boolean
        citations?: Array<{ url: string; title: string }>
      }

      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error(`Server gaf ongeldig antwoord: ${rawText.slice(0, 100)}`)
      }

      if (!data.content) {
        throw new Error(`Claude gaf een leeg antwoord`)
      }

      // Update conversation ID
      if (data.conversationId && !convId) {
        setConvId(data.conversationId)
        onConversationCreated?.(data.conversationId)
      }

      // Add assistant message
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content!,
        hasWebSearch: data.hasWebSearch || false,
        citations: data.citations || [],
      }])

      onNewMessage?.()
      toast.success('Antwoord ontvangen', { id: toastId })
      setStatusText('')

    } catch (error) {
      clearTimeout(timeoutId)
      let errMsg = 'Onbekende fout'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errMsg = 'Geen reactie na 90 seconden. Probeer een kortere vraag.'
        } else {
          errMsg = error.message
        }
      }

      console.error('[ClaudeChat] Error:', errMsg)
      toast.error(errMsg, { id: toastId, duration: 15000 })
      setStatusText('')

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `**Fout:** ${errMsg}\n\nProbeer het opnieuw of ververs de pagina (Ctrl+Shift+R).`,
      }])
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
      <div className="flex-shrink-0 p-4 border-t border-white/5">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || 'Typ je vraag...'}
              disabled={isLoading}
              rows={1}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40 focus:bg-white/[0.07] transition-all disabled:opacity-50"
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
