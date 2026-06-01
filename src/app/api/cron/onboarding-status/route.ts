// Cron: wekelijkse onboarding-status voor partners + Hanna.
// Post in #mt-groot — overzicht van actieve nieuwe medewerkers en open items.
// Skip als alles is afgerond.
//
// Schedule: donderdag 09:00 NL (07:00 UTC zomertijd)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

function fmtDateNL(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const employees = await prisma.onboardingEmployee.findMany({
      where: { isArchived: false },
      include: {
        items: { select: { isCompleted: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    if (employees.length === 0) {
      return NextResponse.json({ skipped: 'geen actieve onboarding' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lines = employees.map(e => {
      const total = e.items.length
      const done = e.items.filter(i => i.isCompleted).length
      const open = total - done
      const startLabel = e.startDate
        ? (() => {
            const sd = new Date(e.startDate)
            sd.setHours(0, 0, 0, 0)
            const days = Math.round((sd.getTime() - today.getTime()) / 86400000)
            if (days > 0) return `start over ${days} ${days === 1 ? 'dag' : 'dagen'} (${fmtDateNL(sd)})`
            if (days === 0) return 'start vandaag'
            return `in dienst sinds ${fmtDateNL(sd)}`
          })()
        : 'geen startdatum'
      const role = e.role ? ` · ${e.role}` : ''
      return `•  *${e.name}*${role} — ${startLabel} · *${open}* van ${total} items nog open`
    })

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Onboarding-status*\nNieuwe medewerkers waarvan de checklist nog niet rond is:`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') + `\n\n→ <${DASHBOARD_BASE}/dashboard/onboarding|Open onboarding>` },
      },
    ]
    const fallback = `Onboarding-status — ${employees.length} actieve nieuwe medewerkers.`
    const ok = await sendChannelMessage('mt-groot', fallback, blocks)
    return NextResponse.json({ ok, employees: employees.length })
  } catch (error) {
    console.error('Error in onboarding-status cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
