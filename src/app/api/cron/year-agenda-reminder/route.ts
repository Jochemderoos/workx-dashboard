// Cron: wekelijkse Slack-reminder voor de Jaaragenda. Stuurt in januari
// 2027 elke maandag een nudge naar #MT-Groot om de plannen voor het jaar
// in te vullen. Daarna geldt alleen nog de dashboard-notificatie zolang
// het jaaragenda-record onvolledig is.

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'mt-groot'

// Maandagen in januari 2027 — eerste week start 4 jan (maandag).
const SLACK_DATES = [
  '2027-01-04',
  '2027-01-11',
  '2027-01-18',
  '2027-01-25',
]

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const today = new Date().toISOString().slice(0, 10)
    if (!SLACK_DATES.includes(today)) {
      return NextResponse.json({ skipped: 'niet in venster', today, plannedDates: SLACK_DATES })
    }

    const planUrl = `${DASHBOARD_BASE}/dashboard/jaaragenda`
    const weekIdx = SLACK_DATES.indexOf(today) + 1
    const isLast = weekIdx === SLACK_DATES.length

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `Jaaragenda 2027 📅 — week ${weekIdx}/${SLACK_DATES.length}\n`, style: { bold: true } },
              { type: 'text', text: 'Tijd om de plannen voor het jaar op te schrijven: jaardoelen, thema, focus per maand en mijlpalen.\n→ ' },
              { type: 'link', url: planUrl, text: 'Open Jaaragenda' },
              ...(isLast ? [
                { type: 'text', text: '\n\n' },
                { type: 'text', text: 'Laatste Slack-reminder — daarna verschijnt het als nudge op het dashboard zolang het nog niet is ingevuld.', style: { italic: true } },
              ] : []),
            ],
          },
        ],
      },
    ]

    const fallback = `Jaaragenda 2027 invullen — week ${weekIdx}/${SLACK_DATES.length}: ${planUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)

    return NextResponse.json({ ok: true, slack: slackOk, today, weekIdx, isLast })
  } catch (error) {
    console.error('year-agenda-reminder cron failed:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
