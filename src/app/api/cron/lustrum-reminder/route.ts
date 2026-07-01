// Cron: eenmalige Lustrum-HERINNERING in #workx-algemeen.
// Draait server-side via Vercel cron (onafhankelijk van welke app dan ook).
// Schedule staat op 6 juli 08:30 UTC (= 10:30 Amsterdam); een datum-vangnet
// zorgt dat het alleen op 6 juli 2026 daadwerkelijk post.

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'
const TARGET_DATE = '2026-07-06' // alleen op deze dag posten (Amsterdam)

function amsterdamDate(now: Date): string {
  // en-CA levert YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    const today = amsterdamDate(now)
    const url = new URL(req.url)
    const dry = url.searchParams.get('dry') === 'true'

    // Datum-vangnet: alleen op de doeldag posten (tenzij dry-run).
    if (!dry && today !== TARGET_DATE) {
      return NextResponse.json({ skipped: `niet de doeldag (${today} != ${TARGET_DATE})` })
    }

    const lustrumUrl = `${DASHBOARD_BASE}/dashboard/lustrum`
    const imageUrl = `${DASHBOARD_BASE}/lustrum-programma-2026.jpg`

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'REMINDER\n', style: { bold: true } },
              { type: 'text', text: 'Geef ' },
              { type: 'text', text: 'vandaag (maandag 6 juli)', style: { bold: true } },
              { type: 'text', text: ' je voorkeur door voor het organiseren van de Lustrum-onderdelen — het is de laatste dag. Open een onderdeel en klik op "Ik wil dit organiseren" in ' },
              { type: 'link', url: lustrumUrl, text: 'het Lustrumprogramma' },
              { type: 'text', text: '. Hanna verdeelt daarna en houdt zoveel mogelijk rekening met ieders voorkeur.' },
            ],
          },
        ],
      },
      {
        type: 'image',
        image_url: imageUrl,
        alt_text: 'Workx Lustrum — Mallorca 2026',
      },
    ]
    const fallback = `REMINDER — geef vandaag (6 juli) je voorkeur door voor het Lustrumprogramma: ${lustrumUrl}`

    if (dry) {
      return NextResponse.json({ ok: true, dryRun: true, today, lustrumUrl, imageUrl, blocks })
    }

    const slackOk = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks)
    return NextResponse.json({ ok: true, today, slack: slackOk, lustrumUrl })
  } catch (error) {
    console.error('Error in lustrum-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
