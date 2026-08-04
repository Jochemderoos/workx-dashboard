// Cron: maandelijkse herinnering (#workx-algemeen) om nieuwe contactpersonen
// aan de Mailchimp-lijst toe te voegen. Schedule: 1e van de maand 08:00 UTC
// (= 10:00 Amsterdam) — zie vercel.json.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const CHANNEL = 'workx-algemeen'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const dry = new URL(req.url).searchParams.get('dry') === 'true'
    const openCount = await prisma.mailchimpContact.count({ where: { addedToMailchimp: false } })
    const pageUrl = `${DASHBOARD_BASE}/dashboard/mailchimp`

    const openLine = openCount > 0
      ? `Er staan er nu ${openCount} klaar om te verwerken.`
      : 'De lijst is nu leeg — mooi moment om nieuwe contacten toe te voegen.'

    if (dry) return NextResponse.json({ ok: true, dryRun: true, openCount })

    const blocks = [{
      type: 'rich_text',
      elements: [{
        type: 'rich_text_section',
        elements: [
          { type: 'text', text: '📋 Mailchimp-lijst — nieuwe contacten?\n', style: { bold: true } },
          { type: 'text', text: 'Nieuwe maand! Ben je mensen tegengekomen die op onze Mailchimp-lijst horen? Voeg ze toe (naam, e-mail, telefoon, bedrijf) in ' },
          { type: 'link', url: pageUrl, text: 'de Mailchimp-lijst' },
          { type: 'text', text: `. Office voegt ze daarna toe aan Mailchimp. ${openLine}` },
        ],
      }],
    }]

    const sent = await sendChannelMessage(CHANNEL, `Mailchimp-lijst: voeg nieuwe contactpersonen toe — ${pageUrl}`, blocks)
    return NextResponse.json({ ok: true, openCount, sent })
  } catch (error) {
    console.error('Error in mailchimp-reminder cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
