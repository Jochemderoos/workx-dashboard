'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface SlackMessage {
  user: string
  text: string
  ts: string
  userInfo?: {
    realName: string
    name: string
  }
}

// Compact Slack preview widget for dashboard
export function SlackPreview() {
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [channelName, setChannelName] = useState<string>('general')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestMessages()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLatestMessages, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchLatestMessages = async () => {
    try {
      // First get channels
      const channelRes = await fetch('/api/slack/channels')
      const channelData = await channelRes.json()

      if (channelData.channels?.length > 0) {
        // Get general or first channel
        const generalChannel = channelData.channels.find(
          (c: { name: string }) => c.name === 'general'
        ) || channelData.channels[0]

        setChannelName(generalChannel.name)

        // Fetch latest 5 messages
        const msgRes = await fetch(`/api/slack/channels?channelId=${generalChannel.id}&limit=5`)
        const msgData = await msgRes.json()
        setMessages(msgData.messages || [])
      }
    } catch (err) {
      console.error('Error fetching Slack preview:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  const formatSlackText = (text: string) => {
    return text
      .replace(/<@[A-Z0-9]+>/g, '@gebruiker')
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
      .replace(/<([^>]+)>/g, '$1')
      .slice(0, 80) + (text.length > 80 ? '...' : '')
  }

  if (loading) {
    return (
      <div className="bg-workx-gray/30 rounded-xl p-4 animate-pulse">
        <div className="h-5 bg-workx-gray/50 rounded w-24 mb-3"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-workx-gray/50 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-workx-gray/40 to-workx-dark/60 rounded-xl overflow-hidden border border-workx-gray/30">
      <div className="px-4 py-3 border-b border-workx-gray/30 flex items-center gap-2">
        <svg className="w-4 h-4 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        <span className="font-medium text-sm">#{channelName}</span>
        <span className="ml-auto text-xs text-workx-muted">Slack</span>
      </div>

      <div className="px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-workx-muted text-sm text-center py-4">
            Geen recente berichten
          </p>
        ) : (
          messages.slice(-3).map((msg) => (
            <div key={msg.ts} className="flex gap-2 text-sm">
              <span className="font-medium shrink-0">
                {(msg.userInfo?.realName || msg.userInfo?.name || 'Onbekend').split(' ')[0]}:
              </span>
              <span className="text-workx-muted truncate">{formatSlackText(msg.text)}</span>
              <span className="text-xs text-workx-muted/60 shrink-0">{formatTime(msg.ts)}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-workx-gray/30">
        <Link
          href="/dashboard/chat"
          className="text-xs text-workx-lime hover:underline"
        >
          Open Slack chat &rarr;
        </Link>
      </div>
    </div>
  )
}
