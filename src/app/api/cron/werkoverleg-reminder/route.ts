// Cron: maandag-reminder voor werkoverleg op dinsdag.
// - Slack post in #algemeen (één bericht voor de hele club, beter dan 15 DMs)
// - Push naar alle active users
// - Dashboard-popup via /api/notifications
//
// Schedule: maandag 14:00 NL zomertijd (= 12:00 UTC, Vercel cron in vercel.json)

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

    // Push naar alle active users (incl. partners — die zitten ook in werkoverleg).
    // Push-fout mag het hele resultaat niet 500'en als Slack al gelukt is.
    let userCount = 0
    let pushResult: unknown = null
    let pushError: string | null = null
    try {
      const users = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] } },
        select: { id: true },
      })
      userCount = users.length
      pushResult = await sendPushNotificationToUsers(
        users.map(u => u.id),
        {
          title: 'Agendapunten werkoverleg?',
          body: 'Morgen werkoverleg. Heb je nog punten in te brengen?',
          url: '/dashboard/werkoverleg',
          tag: `werkoverleg-${now.toISOString().slice(0, 10)}`,
          requireInteraction: true,
        }
      )
    } catch (err) {
      console.error('Push notification failed (slack reminder still sent):', err)
      pushError = err instanceof Error ? err.message : 'push failed'
    }

    return NextResponse.json({
      ok: true,
      users: userCount,
      slack: slackOk,
      push: pushResult,
      pushError,
    })
  } catch (error) {
    console.error('Error in werkoverleg-reminder cron:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server fout',
    }, { status: 500 })
  }
}
