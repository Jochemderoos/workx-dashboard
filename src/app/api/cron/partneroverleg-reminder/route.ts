// Cron: vrijdag-reminder voor partneroverleg op maandag 10:00.
// - Slack: post in #mt-groot (private channel met partners + Hanna)
// - Push: naar PARTNER + ADMIN
//
// Schedule: vrijdag 10:00 NL (08:00 UTC zomertijd).

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'
import { sendPushNotificationToUsers } from '@/lib/push-notifications'
import { prisma } from '@/lib/prisma'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
const SLACK_CHANNEL = 'mt-groot' // private channel met partners + Hanna

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    if (now.getDay() !== 5) {
      return NextResponse.json({ skipped: 'niet vrijdag' })
    }

    const notulenUrl = `${DASHBOARD_BASE}/dashboard/partners/notulen`

    const slackBlocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Partneroverleg maandag 10:00\n', style: { bold: true } },
              { type: 'text', text: 'Heb je nog agendapunten voor het overleg? Zet ze nu in ' },
              { type: 'link', url: notulenUrl, text: 'de partner agenda' },
              { type: 'text', text: ' zodat ze klaar staan.' },
            ],
          },
        ],
      },
    ]
    const fallback = `Partneroverleg maandag 10:00 — agendapunten? ${notulenUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, slackBlocks)

    // Push naar PARTNER + ADMIN
    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['PARTNER', 'ADMIN'] } },
      select: { id: true },
    })
    const pushResult = await sendPushNotificationToUsers(
      recipients.map(r => r.id),
      {
        title: 'Agendapunten partneroverleg?',
        body: 'Maandag 10:00 partneroverleg. Heb je nog punten? Klik om toe te voegen.',
        url: '/dashboard/partners/notulen',
        tag: `partneroverleg-${now.toISOString().slice(0, 10)}`,
        requireInteraction: true,
      }
    )

    return NextResponse.json({
      ok: true,
      slack: slackOk,
      pushRecipients: recipients.length,
      push: pushResult,
    })
  } catch (error) {
    console.error('Error in partneroverleg-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
