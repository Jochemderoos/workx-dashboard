// Cron: wekelijkse Slack-reminder voor Ontwikkelplan (voorheen Jaarplan).
// Schema: 3 donderdagen in juni 2026 → #workx-algemeen.
// Vanaf juli verschijnt de reminder als dashboard-notificatie
// voor users zonder ontwikkelplan-items (zie /api/notifications/route.ts).

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'

// 3 donderdagen waarop Slack-reminder gestuurd wordt
const SLACK_DATES = ['2026-06-11', '2026-06-18', '2026-06-25']

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const today = new Date().toISOString().slice(0, 10)
    if (!SLACK_DATES.includes(today)) {
      return NextResponse.json({ skipped: 'niet in Slack-reminder venster', today, plannedDates: SLACK_DATES })
    }

    const planUrl = `${DASHBOARD_BASE}/dashboard/ontwikkelplannen`
    const remainingDates = SLACK_DATES.filter(d => d > today)
    const isLastSlackRound = remainingDates.length === 0

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Mijn Ontwikkelplan 📋 — even invullen\n', style: { bold: true } },
              { type: 'text', text: 'Zet je ontwikkeldoelen voor dit jaar op een rij in 4 categorieën:\n' },
              { type: 'text', text: '• Inhoud theorie · Inhoud praktijk · Eigen praktijk en zaken · Intern\n\n' },
              { type: 'text', text: 'Hoeft niet groots — drie tot vijf concrete punten per categorie is al heel wat. Voortgang vink je later af in dezelfde tool. Partners voegen evaluaties toe.\n→ ' },
              { type: 'link', url: planUrl, text: 'Open mijn ontwikkelplan' },
              ...(isLastSlackRound ? [
                { type: 'text', text: '\n\n' },
                { type: 'text', text: 'Laatste reminder via Slack — daarna verschijnt het als nudge in het dashboard voor wie het nog niet heeft ingevuld.', style: { italic: true } },
              ] : []),
            ],
          },
        ],
      },
    ]

    const fallback = `Mijn Ontwikkelplan — vul je doelen in: ${planUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)

    return NextResponse.json({
      ok: true,
      slack: slackOk,
      today,
      isLastSlackRound,
      remainingDates,
    })
  } catch (error) {
    console.error('year-plan-reminder cron failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server fout',
    }, { status: 500 })
  }
}
