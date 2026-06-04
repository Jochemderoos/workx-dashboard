// Cron: Slack-reminder in #workx-algemeen voor het recruitment-overleg.
// Twee firings:
//   - Vrijdag 10:00 NL  (vooruit-blik op het maandag-overleg)
//   - Maandag 09:15 NL  (laatste check vóór het 11:00 overleg)
//
// Schedules in vercel.json:
//   0 8 * * 5    (= 10:00 NL zomertijd, 09:00 winter)
//   15 7 * * 1   (= 09:15 NL zomertijd, 08:15 winter)
//
// Firet alleen als we binnen 4 dagen vóór NEXT_RECRUITMENT_MEETING zitten,
// zodat het niet eeuwig blijft pingen.

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'
import { NEXT_RECRUITMENT_MEETING } from '@/lib/recruitment-config'

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
    const daysUntilMeeting = (NEXT_RECRUITMENT_MEETING.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    if (daysUntilMeeting < -0.5 || daysUntilMeeting > 4) {
      return NextResponse.json({ skipped: 'buiten 4-daags venster voor overleg', daysUntilMeeting })
    }

    const day = now.getUTCDay() // 0=zo, 1=ma, ..., 5=vr
    const isMonday = day === 1
    const url = `${DASHBOARD_BASE}/dashboard/recruitment`

    const title = isMonday
      ? 'Recruitment-overleg vandaag om 11:00 — laatste check'
      : 'Recruitment-overleg maandag 11:00'
    const body = isMonday
      ? 'Vul je lijstje af zodat we vandaag samen door de namen kunnen.\n→ '
      : 'Denk vóór maandag aan je 5 kandidaten + ambassadeur + LinkedIn-ideeën.\n→ '

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `${title}\n`, style: { bold: true } },
              { type: 'text', text: body },
              { type: 'link', url, text: 'Open recruitment-pagina' },
            ],
          },
        ],
      },
    ]
    const fallback = `${title} — ${url}`
    const ok = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)

    return NextResponse.json({ ok, day, isMonday })
  } catch (err) {
    console.error('[cron/recruitment-reminder] mislukt:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
