'use client'

import { useState, useEffect, useRef } from 'react'

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
      const res = await fetch('/api/slack/channels')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChannels(data.channels || [])
      // Auto-select first channel if available
      if (data.channels?.length > 0 && !selectedChannel) {
        setSelectedChannel(data.channels[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (channelId: string) => {
    try {
      const res = await fetch(`/api/slack/channels?channelId=${channelId}&limit=30`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
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
      .replace(/<@[A-Z0-9]+>/g, (match) => {
        // Find user in messages that matches
        return '@gebruiker'
      })
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
        <svg className="w-5 h-5 text-[#4A154B]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        <span className="font-medium">Slack</span>

        {/* Channel selector */}
        <select
          value={selectedChannel?.id || ''}
          onChange={(e) => {
            const channel = channels.find((c) => c.id === e.target.value)
            setSelectedChannel(channel || null)
          }}
          className="ml-auto bg-workx-dark/50 border border-workx-gray/30 rounded px-2 py-1 text-sm"
        >
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.isPrivate ? '🔒' : '#'} {channel.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-workx-muted text-sm text-center py-8">
            Geen berichten in dit kanaal
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.ts} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-workx-lime/20 flex items-center justify-center text-xs font-medium shrink-0">
                {(msg.userInfo?.realName || msg.userInfo?.name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">
                    {msg.userInfo?.realName || msg.userInfo?.name || 'Onbekend'}
                  </span>
                  <span className="text-xs text-workx-muted">{formatTime(msg.ts)}</span>
                </div>
                <p className="text-sm text-workx-muted break-words">
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
            className="flex-1 bg-workx-dark/50 border border-workx-gray/30 rounded-lg px-3 py-2 text-sm placeholder:text-workx-muted focus:outline-none focus:border-workx-lime/50"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-workx-lime text-workx-dark rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-workx-lime/90 transition-colors"
          >
            {sending ? '...' : 'Stuur'}
          </button>
        </div>
      </div>
    </div>
  )
}
