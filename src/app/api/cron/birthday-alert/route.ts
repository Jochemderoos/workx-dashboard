// Cron: dagelijkse verjaardag-alert.
// Stuurt om 08:00 NL een persoonlijke DM aan iedereen behalve de jarige(n)
// als er vandaag iemand jarig is.
// Geen jarigen vandaag -> niets versturen.
//
// Schedule: dagelijks 08:00 NL (06:00 UTC zomertijd)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

function todayMMDD(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const today = new Date()
    const mmdd = todayMMDD(today)

    const all = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, birthDate: true },
    })
    const jarigen = all.filter(u => u.birthDate === mmdd)
    if (jarigen.length === 0) {
      return NextResponse.json({ skipped: 'geen jarigen vandaag' })
    }

    const jarigeNames = jarigen.map(j => j.name)
    const jarigeIds = new Set(jarigen.map(j => j.id))
    const recipients = all.filter(u => !jarigeIds.has(u.id))

    // Bouw boodschap
    let header: string
    if (jarigeNames.length === 1) {
      header = `Vandaag is *${jarigeNames[0]}* jarig.`
    } else if (jarigeNames.length === 2) {
      header = `Vandaag zijn *${jarigeNames[0]}* en *${jarigeNames[1]}* jarig.`
    } else {
      const last = jarigeNames[jarigeNames.length - 1]
      const rest = jarigeNames.slice(0, -1).map(n => `*${n}*`).join(', ')
      header = `Vandaag zijn ${rest} en *${last}* jarig.`
    }

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${header}\nEven een kaartje of een felicitatie op kantoor?`,
        },
      },
    ]
    const fallback = header.replace(/\*/g, '')

    let sent = 0
    let failed = 0
    for (const r of recipients) {
      try {
        const ok = await sendDirectMessage(r.email, fallback, blocks)
        if (ok) sent++; else failed++
      } catch {
        failed++
      }
    }

    return NextResponse.json({
      ok: true,
      jarigen: jarigeNames,
      recipients: recipients.length,
      sent,
      failed,
    })
  } catch (error) {
    console.error('Error in birthday-alert cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
