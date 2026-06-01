// Slack-diagnose: stuur een test-bericht naar een channel + retourneer de raw Slack-error.
// PARTNER + ADMIN.
//
// POST body: { channel: string, text?: string }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { slack } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const channelName = String(body.channel || 'workx-algemeen').replace('#', '')
    const text = String(body.text || `🔧 Test-bericht vanuit Workx Dashboard (door ${session.user.name}). Als je dit ziet, werkt Slack-integratie.`)

    // Zoek channel
    const list = await slack.conversations.list({
      types: 'public_channel,private_channel',
      limit: 200,
    })
    const channel = list.channels?.find(c => c.name === channelName)
    if (!channel?.id) {
      return NextResponse.json({
        ok: false,
        step: 'lookup',
        error: `Channel '${channelName}' niet gevonden of bot heeft geen channels:read scope.`,
        availableNames: list.channels?.map(c => c.name).filter(Boolean).slice(0, 50) || [],
      }, { status: 200 })
    }
    if (!channel.is_member) {
      return NextResponse.json({
        ok: false,
        step: 'membership',
        channel: { id: channel.id, name: channel.name, isMember: false },
        error: `Bot is geen lid van '${channelName}'. Typ in dat channel: /invite @Workx Dashboard`,
      }, { status: 200 })
    }

    try {
      const res = await slack.chat.postMessage({
        channel: channel.id,
        text,
        username: 'Workx Dashboard',
        icon_url: 'https://workx-dashboard.vercel.app/workx-logo.png',
        unfurl_links: false,
        unfurl_media: false,
      })
      return NextResponse.json({
        ok: true,
        step: 'sent',
        channel: { id: channel.id, name: channel.name },
        ts: res.ts,
      })
    } catch (err: any) {
      return NextResponse.json({
        ok: false,
        step: 'postMessage',
        channel: { id: channel.id, name: channel.name },
        error: err?.data?.error || err?.message || 'Onbekende Slack-error',
        raw: err?.data || null,
      }, { status: 200 })
    }
  } catch (error) {
    console.error('slack-debug/test error:', error)
    return NextResponse.json({
      ok: false,
      step: 'unexpected',
      error: error instanceof Error ? error.message : 'Server error',
    }, { status: 500 })
  }
}
