// Cron: vrijdag-reminder voor partneroverleg op maandag 10:00.
// - Slack DM per PARTNER (en ADMIN Hanna)
// - Push naar dezelfde groep
// - Dashboard-popup verschijnt automatisch in belletje vanwege de notification (zie /api/notifications)
//
// Schedule: vrijdag 14:00 (Vercel cron in vercel.json)
// Vercel cron syntax: '0 13 * * 5' (UTC = 14:00 NL in zomertijd, 15:00 in wintertijd).
// We accepteren een uur drift in de winter — verbetert nooit erg.

import { NextRequest, NextResponse } from 'next/server'
import { sendDirectMessage } from '@/lib/slack'
import { sendPushNotificationToUsers } from '@/lib/push-notifications'
import { prisma } from '@/lib/prisma'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    // Alleen op vrijdag versturen — vangnet voor handmatige triggers
    if (now.getDay() !== 5) {
      return NextResponse.json({ skipped: 'niet vrijdag' })
    }

    const notulenUrl = `${DASHBOARD_BASE}/dashboard/partners/notulen`

    // Partners + ADMIN
    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['PARTNER', 'ADMIN'] } },
      select: { id: true, email: true, name: true },
    })

    // Slack DM per partner
    const slackBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Partneroverleg maandag 10:00*\nHeb je nog agendapunten voor het overleg? Zet ze nu in het dashboard zodat ze klaar staan.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open partner agenda', emoji: false },
            url: notulenUrl,
            style: 'primary',
          },
        ],
      },
    ]
    const fallback = `Partneroverleg maandag 10:00 — agendapunten? ${notulenUrl}`

    let slackOk = 0
    let slackFail = 0
    for (const r of recipients) {
      const ok = await sendDirectMessage(r.email, fallback, slackBlocks)
      if (ok) slackOk++
      else slackFail++
    }

    // Push notifications
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
      recipients: recipients.length,
      slack: { sent: slackOk, failed: slackFail },
      push: pushResult,
    })
  } catch (error) {
    console.error('Error in partneroverleg-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
