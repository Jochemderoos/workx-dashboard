// Wekelijks-iets-vaker cron: vrolijke nudge in #workx-algemeen om
// uitjes te plannen. Iedere 3 weken, vrijdagochtend.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'

const NUDGE_TEMPLATES = [
  {
    title: 'Tijd voor een uitje?',
    body: 'Geen idee wat — borrel op kantoor, etentje, film, suppen, jeu de boules, opera of voorstelling. Iets verzinnen samen met een kantoorgenoot is áltijd leuker dan alleen.',
  },
  {
    title: 'Wie heeft er zin in een Workx-uitje?',
    body: 'Bedenk iets met een collega en plan het in. Een suppen-clinic, terras-borrel, late dinner of cinema-avondje — bedenk maar.',
  },
  {
    title: 'Iemand zin om iets te plannen?',
    body: 'We doen 1× per 2 maanden iets leuks. Vraag een collega, kies iets gezelligs en zet het op de pagina. Niets te gek.',
  },
] as const

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // TIJDELIJK UITGEZET op verzoek user.
  return NextResponse.json({ skipped: 'workx-uitjes Slack-promotie staat uit' })

  const now = new Date()

  // Run alleen elke 3 weken: gebruik ISO-week-nummer. Cron draait elke
  // vrijdag — alleen als (week % 3 === 0) sturen we iets.
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const weekNum = Math.floor(((now.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7)
  if (weekNum % 3 !== 0) {
    return NextResponse.json({ skipped: 'niet in 3-weeks venster', weekNum })
  }

  // Skip als er al een aankomend uitje binnen 21 dagen is — dan is een
  // nudge overbodig (er staat al iets in de planning).
  const horizon = new Date(now.getTime() + 21 * 86400000)
  const upcomingCount = await prisma.workxOuting.count({
    where: { date: { gte: now, lte: horizon } },
  })
  if (upcomingCount > 0) {
    return NextResponse.json({ skipped: 'er staat al iets gepland', upcomingCount })
  }

  // Random template
  const tpl = NUDGE_TEMPLATES[Math.floor(Math.random() * NUDGE_TEMPLATES.length)]
  const url = `${DASHBOARD_BASE}/dashboard/workx-uitjes`

  try {
    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `✨ ${tpl.title}\n`, style: { bold: true } },
              { type: 'text', text: `${tpl.body}\n\n` },
              { type: 'text', text: 'Vergeet niet het budget even met Hanna af te stemmen.\n→ ' },
              { type: 'link', url, text: 'Plan een uitje' },
            ],
          },
        ],
      },
    ]
    const fallback = `${tpl.title} ${tpl.body} ${url}`
    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)
    return NextResponse.json({ ok: true, slack: slackOk, weekNum, template: tpl.title })
  } catch (err) {
    console.error('workx-outings-nudge failed', err)
    return NextResponse.json({ error: 'Kon Slack-bericht niet sturen' }, { status: 500 })
  }
}
