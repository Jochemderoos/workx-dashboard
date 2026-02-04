'use client'

import { useState, useEffect, useRef } from 'react'
import * as Popover from '@radix-ui/react-popover'

interface SlackMessage {
  user: string
  text: string
  ts: string
  userInfo?: {
    id: string
    name: string
    realName: string
    email: string
  }
}

interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  memberCount?: number
}

export function SlackWidget() {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null)
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channelPickerOpen, setChannelPickerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels()
  }, [])

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id)
    }
  }, [selectedChannel])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      console.log('[SlackWidget] Fetching channels...')
      const res = await fetch('/api/slack/channels')
      const data = await res.json()
      console.log('[SlackWidget] Channels response:', data)
      if (data.error) throw new Error(data.error)
      setChannels(data.channels || [])
      // Auto-select first channel if available
      if (data.channels?.length > 0) {
        console.log('[SlackWidget] Auto-selecting channel:', data.channels[0])
        setSelectedChannel(data.channels[0])
      }
    } catch (err) {
      console.error('[SlackWidget] Error fetching channels:', err)
      setError(err instanceof Error ? err.message : 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (channelId: string) => {
    try {
      console.log('[SlackWidget] Fetching messages for channel:', channelId)
      const res = await fetch(`/api/slack/channels?channelId=${channelId}&limit=30`)
      const data = await res.json()
      console.log('[SlackWidget] Messages response:', data)
      if (data.error) throw new Error(data.error)
      setMessages(data.messages || [])
      console.log('[SlackWidget] Set messages count:', (data.messages || []).length)
    } catch (err) {
      console.error('[SlackWidget] Error fetching messages:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || sending) return

    try {
      setSending(true)
      const res = await fetch('/api/slack/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          message: newMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setNewMessage('')
      // Refresh messages
      fetchMessages(selectedChannel.id)
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  const formatSlackText = (text: string) => {
    // Convert Slack mentions to display names
    return text
      .replace(/<@[A-Z0-9]+>/g, '@gebruiker')
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1') // Channel links
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2') // URL links with text
      .replace(/<([^>]+)>/g, '$1') // Plain URLs
  }

  if (loading) {
    return (
      <div className="bg-workx-gray/30 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-workx-gray/50 rounded w-32 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-workx-gray/50 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-workx-gray/30 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <span>Slack niet verbonden</span>
        </div>
        <p className="text-xs text-workx-muted mt-2">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-workx-gray/40 to-workx-dark/60 rounded-xl overflow-hidden border border-workx-gray/30">
      {/* Header */}
      <div className="px-4 py-3 border-b border-workx-gray/30 flex items-center gap-3">
        <svg className="w-5 h-5 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        <span className="font-medium">Slack</span>

        {/* Channel selector with Popover */}
        <Popover.Root open={channelPickerOpen} onOpenChange={setChannelPickerOpen}>
          <Popover.Trigger asChild>
            <button className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-workx-dark/50 hover:bg-workx-dark/70 border border-workx-gray/30 rounded-lg text-sm transition-colors">
              <span className="text-workx-muted">
                {selectedChannel?.isPrivate ? '🔒' : '#'}
              </span>
              <span>{selectedChannel?.name || 'Kies kanaal'}</span>
              <svg className="w-4 h-4 text-workx-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-64 max-h-80 overflow-y-auto bg-workx-dark border border-workx-gray/30 rounded-xl shadow-xl"
              sideOffset={5}
              align="end"
            >
              <div className="p-2">
                <div className="text-xs text-workx-muted uppercase tracking-wider px-2 py-1 mb-1">
                  Kanalen
                </div>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedChannel(channel)
                      setChannelPickerOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      selectedChannel?.id === channel.id
                        ? 'bg-workx-lime/20 text-workx-lime'
                        : 'hover:bg-workx-gray/30'
                    }`}
                  >
                    <span className="text-workx-muted w-5">
                      {channel.isPrivate ? '🔒' : '#'}
                    </span>
                    <span className="flex-1 truncate">{channel.name}</span>
                    {channel.memberCount && (
                      <span className="text-xs text-workx-muted">{channel.memberCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-workx-muted text-sm text-center py-8">
            Geen berichten in dit kanaal
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.ts} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-workx-lime/30 to-workx-lime/10 flex items-center justify-center text-sm font-medium shrink-0 border border-workx-lime/20">
                {(msg.userInfo?.realName || msg.userInfo?.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">
                    {msg.userInfo?.realName || msg.userInfo?.name || 'Onbekend'}
                  </span>
                  <span className="text-xs text-workx-muted">{formatTime(msg.ts)}</span>
                </div>
                <p className="text-sm text-workx-light/80 break-words mt-0.5">
                  {formatSlackText(msg.text)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-workx-gray/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Bericht naar #${selectedChannel?.name || 'kanaal'}...`}
            className="flex-1 bg-workx-dark/50 border border-workx-gray/30 rounded-lg px-4 py-2.5 text-sm placeholder:text-workx-muted focus:outline-none focus:border-workx-lime/50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-5 py-2.5 bg-workx-lime text-workx-dark rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-workx-lime/90 transition-colors"
          >
            {sending ? '...' : 'Stuur'}
          </button>
        </div>
      </div>
    </div>
  )
}
