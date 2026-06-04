// Slack-diagnose: stuur een zelf-gemaakt bericht naar een channel,
// met optionele titel (vet) en optionele dashboard-link.
// PARTNER + ADMIN.
//
// POST body: { channel: string, title?: string, body: string, linkUrl?: string, linkLabel?: string }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendChannelMessage } from '@/lib/slack'

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
    const channelName = String(body.channel || '').trim().replace(/^#/, '')
    const title = body.title ? String(body.title).trim() : ''
    const messageBody = String(body.body || '').trim()
    const linkUrlRaw = body.linkUrl ? String(body.linkUrl).trim() : ''
    const linkLabel = body.linkLabel ? String(body.linkLabel).trim() : 'Open dashboard'

    if (!channelName) return NextResponse.json({ ok: false, error: 'Channel ontbreekt' }, { status: 400 })
    if (!messageBody && !title) return NextResponse.json({ ok: false, error: 'Bericht is leeg' }, { status: 400 })

    // Link normaliseren — accepteer paden en volledige URLs
    let linkUrl = linkUrlRaw
    if (linkUrl) {
      if (linkUrl.startsWith('/')) {
        const base = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
        linkUrl = base + linkUrl
      } else if (!/^https?:\/\//i.test(linkUrl)) {
        linkUrl = 'https://' + linkUrl
      }
    }

    const sectionElements: any[] = []
    if (title) {
      sectionElements.push({ type: 'text', text: `${title}\n`, style: { bold: true } })
    }
    if (messageBody) {
      sectionElements.push({ type: 'text', text: messageBody + (linkUrl ? '\n→ ' : '') })
    } else if (linkUrl) {
      sectionElements.push({ type: 'text', text: '→ ' })
    }
    if (linkUrl) {
      sectionElements.push({ type: 'link', url: linkUrl, text: linkLabel })
    }

    const blocks = [
      {
        type: 'rich_text',
        elements: [{ type: 'rich_text_section', elements: sectionElements }],
      },
    ]
    const fallback = [title, messageBody, linkUrl ? `→ ${linkUrl}` : ''].filter(Boolean).join(' — ')
    const ok = await sendChannelMessage(channelName, fallback, blocks as any)

    return NextResponse.json({ ok, channel: channelName })
  } catch (error) {
    console.error('slack-debug/send-custom error:', error)
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Server error',
    }, { status: 500 })
  }
}
