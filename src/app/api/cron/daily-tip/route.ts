// Cron: dagelijkse "Wist je dat?"-tip.
// - Maandag → #mt-groot, partner-pagina/tool tip
// - Dinsdag/woensdag/donderdag → #workx-algemeen, algemene tip
// - Vrijdag → niets (dag van partneroverleg-reminder)
// - Weekend → niets
//
// Geen push notifications — tip is informatief, niet popup-waardig.
// Schedule in vercel.json: '0 7 * * 1-4' (07:00 UTC zomertijd = 09:00 NL CEST)

import { NextRequest, NextResponse } from 'next/server'
import { GENERAL_TIPS, PARTNER_TIPS, daysSinceEpoch } from '@/lib/wist-je-dat-tips'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

// Strip de leidende "💡 Wist je dat? — " en bouw schone titel zonder emoji.
function cleanTitle(t: string): string {
  return t.replace(/^💡\s*Wist je dat\?\s*[—–-]\s*/i, '')
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    const dow = now.getDay() // 0=zo, 1=ma, 2=di, 3=wo, 4=do, 5=vr, 6=za

    let channel: string
    let pool: typeof GENERAL_TIPS
    if (dow === 1) {
      channel = 'mt-groot'
      pool = PARTNER_TIPS
    } else if (dow >= 2 && dow <= 4) {
      channel = 'workx-algemeen'
      pool = GENERAL_TIPS
    } else {
      return NextResponse.json({ skipped: `dow=${dow}` })
    }

    const idx = Math.abs(daysSinceEpoch(now)) % pool.length
    const tip = pool[idx]
    const fullUrl = `${DASHBOARD_BASE}${tip.href}`
    const subject = cleanTitle(tip.title)

    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `Wist je dat? — ${subject}\n`, style: { bold: true } },
              { type: 'text', text: `${tip.message}\n→ ` },
              { type: 'link', url: fullUrl, text: `Open ${tip.page}` },
            ],
          },
        ],
      },
    ]
    const fallback = `Wist je dat? — ${subject}. ${tip.message} ${fullUrl}`
    const ok = await sendChannelMessage(channel, fallback, blocks)

    return NextResponse.json({ ok, channel, page: tip.page, href: tip.href })
  } catch (error) {
    console.error('Error in daily-tip cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
