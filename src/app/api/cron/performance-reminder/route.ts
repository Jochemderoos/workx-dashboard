// Cron: 1x per 2 weken op donderdag 14:00 NL reminder voor Performance Management.
// Vercel cron schedule: 0 12 * * 4 (donderdag 12:00 UTC = 14:00 NL zomer).
// Tweewekelijks: handler skipt op oneven ISO-weken. Bedoeld voor #mt-groot.

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'mt-groot'

// ISO-weeknummer (1-53) voor 'om-de-week'-bepaling
function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    if (now.getDay() !== 4) {
      return NextResponse.json({ skipped: 'niet donderdag' })
    }
    const week = isoWeekNumber(now)
    // Alleen op even ISO-weken — bypass via ?force=true voor handmatig triggeren
    const force = new URL(req.url).searchParams.get('force') === 'true'
    if (week % 2 !== 0 && !force) {
      return NextResponse.json({ skipped: `oneven week ${week}` })
    }

    const performanceUrl = `${DASHBOARD_BASE}/dashboard/partners/performance`

    const slackBlocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Performance Management — vul je observaties in\n', style: { bold: true } },
              { type: 'text', text: 'Een goed moment om kort vast te leggen wat je deze weken zag bij collega\'s — positief of kritisch. Hoe meer onderbouwing, hoe makkelijker de beoordelingsgesprekken straks worden.\n→ ' },
              { type: 'link', url: performanceUrl, text: 'Open Performance Management' },
            ],
          },
        ],
      },
    ]
    const fallback = `Performance Management — vul je observaties in: ${performanceUrl}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, slackBlocks)

    return NextResponse.json({ ok: true, slack: slackOk, week })
  } catch (error) {
    console.error('Error in performance-reminder cron:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server fout',
    }, { status: 500 })
  }
}
