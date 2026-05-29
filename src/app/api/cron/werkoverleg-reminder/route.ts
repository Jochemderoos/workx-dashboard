// Cron: maandag-reminder voor werkoverleg op dinsdag.
// - Slack post in #algemeen (één bericht voor de hele club, beter dan 15 DMs)
// - Push naar alle active users
// - Dashboard-popup via /api/notifications
//
// Schedule: maandag 09:00 (Vercel cron in vercel.json)

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'
import { sendPushNotificationToUsers } from '@/lib/push-notifications'
import { prisma } from '@/lib/prisma'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
const SLACK_CHANNEL = 'workx-algemeen'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    // Vangnet: alleen op maandag
    if (now.getDay() !== 1) {
      return NextResponse.json({ skipped: 'niet maandag' })
    }

    const werkoverlegUrl = `${DASHBOARD_BASE}/dashboard/werkoverleg`

    // Slack #algemeen
    const slackBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Werkoverleg morgen (dinsdag)*\nHeb je nog onderwerpen voor het werkoverleg? Zet ze nu in het dashboard.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open werkoverleg', emoji: false },
            url: werkoverlegUrl,
            style: 'primary',
          },
        ],
      },
    ]
    const fallback = `Werkoverleg morgen — nog agendapunten? ${werkoverlegUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, slackBlocks)

    // Push naar alle active users (incl. partners — die zitten ook in werkoverleg)
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] } },
      select: { id: true },
    })

    const pushResult = await sendPushNotificationToUsers(
      users.map(u => u.id),
      {
        title: 'Agendapunten werkoverleg?',
        body: 'Morgen werkoverleg. Heb je nog punten in te brengen?',
        url: '/dashboard/werkoverleg',
        tag: `werkoverleg-${now.toISOString().slice(0, 10)}`,
        requireInteraction: true,
      }
    )

    return NextResponse.json({
      ok: true,
      users: users.length,
      slack: slackOk,
      push: pushResult,
    })
  } catch (error) {
    console.error('Error in werkoverleg-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
