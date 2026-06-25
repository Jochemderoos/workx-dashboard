// Cron: maandag 13:00 NL — reminder in #workx-algemeen met de openstaande
// actiepunten uit het werkoverleg, uitgeschreven in het bericht zelf zodat
// niemand hoeft te klikken.
//
// Schedule (vercel.json): draait om 11:00 én 12:00 UTC op maandag; de code
// gaat alleen door op exact 13:00 NL (zo klopt het zowel in zomer- als wintertijd).

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'
import { prisma } from '@/lib/prisma'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Bepaal NL-tijd (wal-klok) en ga alleen door op maandag 13:00.
    const now = new Date()
    const nl = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
    if (nl.getDay() !== 1 || nl.getHours() !== 13) {
      return NextResponse.json({ skipped: `niet maandag 13:00 NL (dag=${nl.getDay()}, uur=${nl.getHours()})` })
    }

    // Meest recente vergaderdag t/m vandaag (het werkoverleg is op dinsdag,
    // dus op maandag is dit de actielijst van de vorige vergadering).
    const day = await prisma.werkoverlegDay.findFirst({
      where: { meetingDate: { lte: now } },
      orderBy: { meetingDate: 'desc' },
      include: {
        actionItems: {
          where: { isCompleted: false },
          orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    const openActions = day?.actionItems ?? []
    if (openActions.length === 0) {
      return NextResponse.json({ skipped: 'geen openstaande actiepunten' })
    }

    const url = `${DASHBOARD_BASE}/dashboard/werkoverleg`
    const fmtDeadline = (d: Date | null) =>
      d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : null

    // Slack rich_text met een bullet-lijst van de actiepunten.
    const listItems = openActions.map((a) => {
      const dl = fmtDeadline(a.deadline)
      const meta = ` — ${a.responsibleName}${dl ? ` (deadline ${dl})` : ''}`
      return {
        type: 'rich_text_section',
        elements: [
          { type: 'text', text: a.description },
          { type: 'text', text: meta, style: { italic: true } },
        ],
      }
    })

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: '📋 Openstaande actiepunten — werkoverleg\n', style: { bold: true } },
            ],
          },
          { type: 'rich_text_list', style: 'bullet', elements: listItems },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: '\nAfgerond? Vink het af → ' },
              { type: 'link', url, text: 'de actielijst' },
            ],
          },
        ],
      },
    ]

    const fallback = `📋 Openstaande actiepunten (werkoverleg):\n` +
      openActions.map((a) => {
        const dl = fmtDeadline(a.deadline)
        return `• ${a.description} — ${a.responsibleName}${dl ? ` (deadline ${dl})` : ''}`
      }).join('\n') +
      `\n${url}`

    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)

    return NextResponse.json({ ok: true, slack: slackOk, count: openActions.length })
  } catch (error) {
    console.error('Error in werkoverleg-actielijst-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
