// Cron: dagelijkse "Wist je dat?"-tip.
// - Slack: post in #algemeen als "Workx Dashboard" bot met directe link
// - Push: stuur naar alle subscribers
// Schedule: ma-vr 09:00 (Vercel cron in vercel.json)

import { NextRequest, NextResponse } from 'next/server'
import { getTipOfTheDay } from '@/lib/wist-je-dat-tips'
import { sendChannelMessage } from '@/lib/slack'
import { sendPushNotification } from '@/lib/push-notifications'
import { prisma } from '@/lib/prisma'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
const SLACK_CHANNEL = 'algemeen' // ook 'general' wordt automatisch geprobeerd door sendChannelMessage

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    // Skip weekend — Vercel cron ondersteunt geen DOW-filter standaard
    const dow = now.getDay()
    if (dow === 0 || dow === 6) {
      return NextResponse.json({ skipped: 'weekend' })
    }

    // Algemene tip (zonder partner-extra) — voor de hele club
    const tip = getTipOfTheDay(false, now)
    const fullUrl = `${DASHBOARD_BASE}${tip.href}`

    // 1) Slack #algemeen
    const slackBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${tip.title}*\n${tip.message}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: `Open ${tip.page} in dashboard`, emoji: true },
            url: fullUrl,
            style: 'primary',
          },
        ],
      },
    ]
    const fallback = `${tip.title}\n${tip.message}\n${fullUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, slackBlocks)

    // 2) Push naar alle subscribers (alle actieve users met een PushSubscription)
    const subscribers = await prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    })
    let pushSent = 0
    let pushFailed = 0
    for (const s of subscribers) {
      const r = await sendPushNotification(s.userId, {
        title: tip.title,
        body: tip.message,
        url: tip.href,
        tag: `daily-tip-${now.toISOString().slice(0, 10)}`,
      })
      pushSent += r.sent
      pushFailed += r.failed
    }

    return NextResponse.json({
      ok: true,
      tip: { page: tip.page, href: tip.href },
      slack: slackOk,
      push: { sent: pushSent, failed: pushFailed, subscribers: subscribers.length },
    })
  } catch (error) {
    console.error('Error in daily-tip cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
