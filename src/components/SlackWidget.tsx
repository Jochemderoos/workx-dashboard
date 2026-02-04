'use client'

import { useState, useEffect, useRef } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { getPhotoUrl } from '@/lib/team-photos'

interface SlackFile {
  id: string
  name: string
  mimetype: string
  url: string
  thumb?: string
}

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
  files?: SlackFile[]
}

interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  memberCount?: number
}

// Popular emojis for quick access
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '💪', '👏', '🙌', '✨', '💯', '🚀', '☕', '🍕', '🎯', '💡', '✅', '❌', '👀', '🤔']

// Emoji categories
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🤩', '🥳', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶'],
  'Gebaren': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'],
  'Harten': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Feest': ['🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁', '🥂', '🍾', '🎆', '🎇', '✨', '🎯', '🏆', '🥇', '🎖️', '🏅'],
  'Werk': ['💼', '📁', '📂', '📅', '📆', '📌', '📍', '✏️', '📝', '💻', '🖥️', '📧', '📨', '📩', '✉️', '📞', '☎️', '📱', '⏰', '⏱️', '📊', '📈', '📉', '✅', '❌', '❓', '❗', '💡', '🔔', '🔕'],
  'Eten': ['🍕', '🍔', '🍟', '🌭', '🍿', '🧀', '🥐', '🥖', '🥨', '🥯', '🍞', '☕', '🍵', '🧃', '🥤', '🍺', '🍷', '🥃', '🍸', '🍹'],
}

interface SlackWidgetProps {
  currentUserName?: string
}

export function SlackWidget({ currentUserName }: SlackWidgetProps) {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null)
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channelPickerOpen, setChannelPickerOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('Smileys')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels()
  }, [])

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id)
      // Poll for new messages every 10 seconds
      const interval = setInterval(() => fetchMessages(selectedChannel.id), 10000)
      return () => clearInterval(interval)
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
      if (data.channels?.length > 0) {
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
      const res = await fetch(`/api/slack/channels?channelId=${channelId}&limit=50`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || sending) return

    const messageText = newMessage.trim()

    // Optimistic update - add message immediately to UI
    const optimisticMessage: SlackMessage = {
      user: 'me',
      text: messageText,
      ts: `optimistic-${Date.now()}`,
      userInfo: {
        id: 'me',
        name: currentUserName || 'Jij',
        realName: currentUserName || 'Jij',
        email: '',
      },
    }
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')

    // Send in background
    setSending(true)
    try {
      const res = await fetch('/api/slack/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          message: messageText,
        }),
      })
      const data = await res.json()
      if (data.error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.ts !== optimisticMessage.ts))
        console.error('Error sending message:', data.error)
      } else {
        // Fetch after short delay to get the real message with proper user info
        setTimeout(() => fetchMessages(selectedChannel.id), 1500)
      }
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.ts !== optimisticMessage.ts))
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
    inputRef.current?.focus()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChannel || uploading) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('channelId', selectedChannel.id)

      const res = await fetch('/api/slack/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Refresh messages to show the upload
      fetchMessages(selectedChannel.id)
    } catch (err) {
      console.error('Error uploading file:', err)
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatTime = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Vandaag'
    if (date.toDateString() === yesterday.toDateString()) return 'Gisteren'
    return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const formatSlackText = (text: string) => {
    return text
      .replace(/<@[A-Z0-9]+>/g, '@gebruiker')
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
      .replace(/<([^>]+)>/g, '$1')
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.ts)
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {} as Record<string, SlackMessage[]>)

  // Get avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-teal-500 to-emerald-500',
      'from-green-500 to-lime-500',
      'from-yellow-500 to-orange-500',
      'from-orange-500 to-red-500',
    ]
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  if (loading) {
    return (
      <div className="h-[600px] bg-gradient-to-br from-[#1a1d21] to-[#0d0f11] rounded-2xl p-6 animate-pulse border border-white/5">
        <div className="h-8 bg-white/5 rounded-lg w-48 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/5 rounded w-32"></div>
                <div className="h-4 bg-white/5 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[600px] bg-gradient-to-br from-[#1a1d21] to-[#0d0f11] rounded-2xl border border-white/5 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Slack niet verbonden</h3>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[600px] bg-gradient-to-br from-[#1a1d21] via-[#13151a] to-[#0d0f11] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 bg-gradient-to-r from-white/[0.02] to-transparent">
        {/* Slack Logo with glow */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#E01E5A] via-[#ECB22E] to-[#2EB67D] rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="relative w-10 h-10 rounded-xl bg-[#1a1d21] flex items-center justify-center border border-white/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path className="text-[#E01E5A]" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
              <path className="text-[#E01E5A]" d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              <path className="text-[#2EB67D]" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z"/>
              <path className="text-[#2EB67D]" d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
              <path className="text-[#ECB22E]" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z"/>
              <path className="text-[#ECB22E]" d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
              <path className="text-[#36C5F0]" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z"/>
              <path className="text-[#36C5F0]" d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <h2 className="font-semibold text-white">Team Chat</h2>
          <p className="text-xs text-gray-500">Verbonden met Slack</p>
        </div>

        {/* Channel selector */}
        <Popover.Root open={channelPickerOpen} onOpenChange={setChannelPickerOpen}>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-all hover:border-white/20 group">
              <span className="text-gray-400 group-hover:text-gray-300">
                {selectedChannel?.isPrivate ? '🔒' : '#'}
              </span>
              <span className="text-white font-medium">{selectedChannel?.name || 'Kies kanaal'}</span>
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-72 bg-[#1a1d21] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95"
              sideOffset={8}
              align="end"
            >
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kanalen
                </div>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedChannel(channel)
                      setChannelPickerOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      selectedChannel?.id === channel.id
                        ? 'bg-workx-lime/20 text-workx-lime'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`w-6 text-center ${selectedChannel?.id === channel.id ? 'text-workx-lime' : 'text-gray-500'}`}>
                      {channel.isPrivate ? '🔒' : '#'}
                    </span>
                    <span className="flex-1 font-medium">{channel.name}</span>
                    {selectedChannel?.id === channel.id && (
                      <div className="w-2 h-2 rounded-full bg-workx-lime"></div>
                    )}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-workx-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Geen berichten</h3>
            <p className="text-sm text-gray-500">Start het gesprek!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <span className="text-xs font-medium text-gray-500 bg-[#13151a] px-3 py-1 rounded-full">{date}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {msgs.map((msg) => (
                  <div key={msg.ts} className="group relative">
                    {/* Message glow effect on hover */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-workx-lime/0 via-workx-lime/5 to-workx-lime/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>

                    <div className="relative flex gap-3 p-2 rounded-xl transition-colors group-hover:bg-white/[0.02]">
                      {/* Avatar with photo or gradient fallback */}
                      {getPhotoUrl(msg.userInfo?.realName || '') ? (
                        <img
                          src={getPhotoUrl(msg.userInfo?.realName || '')!}
                          alt={msg.userInfo?.realName || ''}
                          className="w-10 h-10 rounded-xl object-cover shadow-lg shrink-0 ring-2 ring-white/10 group-hover:ring-workx-lime/30 transition-all"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(msg.userInfo?.realName || msg.userInfo?.name || '?')} flex items-center justify-center text-white font-semibold text-sm shadow-lg shrink-0`}>
                          {(msg.userInfo?.realName || msg.userInfo?.name || '?')[0].toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-white text-sm">
                            {msg.userInfo?.realName || msg.userInfo?.name || 'Onbekend'}
                          </span>
                          <span className="text-xs text-gray-600">{formatTime(msg.ts)}</span>
                        </div>
                        {msg.text && (
                          <p className="text-sm text-gray-300 break-words leading-relaxed">
                            {formatSlackText(msg.text)}
                          </p>
                        )}
                        {/* File attachments */}
                        {msg.files && msg.files.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.files.map((file) => (
                              <a
                                key={file.id}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group/file max-w-xs"
                                title="Opent in Slack"
                              >
                                {/* File icon or thumbnail */}
                                {file.mimetype?.startsWith('image/') && file.thumb ? (
                                  <img
                                    src={file.thumb}
                                    alt={file.name}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate group-hover/file:text-workx-lime transition-colors">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                                    </svg>
                                    Opent in Slack
                                  </p>
                                </div>
                                <svg className="w-4 h-4 text-gray-500 group-hover/file:text-workx-lime transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />

        <div className="flex gap-3 items-end">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !selectedChannel}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-gray-400 hover:text-blue-400 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Bestand uploaden"
          >
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          {/* Emoji picker */}
          <Popover.Root open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <Popover.Trigger asChild>
              <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-gray-400 hover:text-yellow-400 hover:scale-105">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-80 bg-[#1a1d21] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95"
                sideOffset={8}
                align="start"
              >
                <div className="p-3">
                  {/* Quick emojis */}
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Snel toevoegen</div>
                    <div className="flex flex-wrap gap-1">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { addEmoji(emoji); setEmojiPickerOpen(false); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                    {Object.keys(EMOJI_CATEGORIES).map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedEmojiCategory(category)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          selectedEmojiCategory === category
                            ? 'bg-workx-lime/20 text-workx-lime'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* Emoji grid */}
                  <div className="h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { addEmoji(emoji); setEmojiPickerOpen(false); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* Message input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Bericht naar #${selectedChannel?.name || 'kanaal'}...`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-workx-lime/50 focus:ring-2 focus:ring-workx-lime/20 transition-all"
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={sendMessage}
            disabled={!newMessage.trim() || !selectedChannel || sending}
            className="p-3 rounded-xl bg-gradient-to-r from-workx-lime to-workx-lime/80 text-workx-dark font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-workx-lime/25 hover:scale-105 transition-all"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
