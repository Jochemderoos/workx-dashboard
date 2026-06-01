// Cron: maandagochtend reminder om Mijn Werkweek in te vullen.
// - Slack-post in #workx-algemeen
// - Push naar alle active employees/partners
//
// Schedule in vercel.json: 45 6 * * 1  (= 08:45 NL zomertijd, 07:45 winter)

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
    if (now.getDay() !== 1) {
      return NextResponse.json({ skipped: 'niet maandag' })
    }

    const intakeUrl = `${DASHBOARD_BASE}/dashboard/mijn-werkweek`

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Mijn werkweek — vergeet niet in te vullen*\nVul vóór 10:00 in wat je deze week op je bord hebt, of je ruimte hebt en welke dagen je afwezig bent. Partners gebruiken dit bij het werkverdelingsgesprek (dinsdag).\n${intakeUrl}`,
        },
      },
    ]
    const fallback = `Vul vóór 10:00 Mijn werkweek in: ${intakeUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks)

    // Push naar advocaten/medewerkers (niet de partners, die hoeven niet)
    const users = await prisma.user.findMany({
      where: { isActive: true, role: 'EMPLOYEE' },
      select: { id: true },
    })
    const pushResult = await sendPushNotificationToUsers(
      users.map(u => u.id),
      {
        title: 'Mijn werkweek — vóór 10:00 invullen',
        body: 'Wat heb je deze week liggen? Ruimte voor extra werk? Dagen afwezig?',
        url: '/dashboard/mijn-werkweek',
        tag: `week-intake-${now.toISOString().slice(0, 10)}`,
        requireInteraction: true,
      }
    )

    return NextResponse.json({ ok: true, users: users.length, slack: slackOk, push: pushResult })
  } catch (error) {
    console.error('Error in week-intake-reminder cron:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
