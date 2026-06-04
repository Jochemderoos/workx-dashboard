// Cron: Slack-reminder in #mt-groot wanneer een medewerker een
// contract-evaluatie heeft staan op die dag (of binnen 1 dag).
//
// Schedule in vercel.json: 0 7 * * *  (= 09:00 NL zomertijd, 08:00 winter)
//
// Werkt voor alle User-records met contractEvaluations gevuld.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 10)

    const usersWithEvals = await prisma.user.findMany({
      where: {
        isActive: true,
        contractEvaluations: { not: null },
      },
      select: { id: true, name: true, contractEvaluations: true, startDate: true },
    })

    const todayEvals: { name: string; iso: string; startDate: string | null }[] = []
    for (const u of usersWithEvals) {
      if (!u.contractEvaluations) continue
      let dates: string[] = []
      try { dates = JSON.parse(u.contractEvaluations) } catch { continue }
      if (dates.includes(todayIso)) {
        todayEvals.push({
          name: u.name,
          iso: todayIso,
          startDate: u.startDate?.toISOString().slice(0, 10) || null,
        })
      }
    }

    if (todayEvals.length === 0) {
      return NextResponse.json({ skipped: 'geen evaluaties vandaag', date: todayIso })
    }

    const url = `${DASHBOARD_BASE}/dashboard/team`
    const lines = todayEvals.map(e => {
      const since = e.startDate ? `in dienst sinds ${new Date(e.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''
      return `• ${e.name}${since ? ` (${since})` : ''}`
    })
    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Contract-evaluatie vandaag\n', style: { bold: true } },
              { type: 'text', text: lines.join('\n') + '\n→ ' },
              { type: 'link', url, text: 'Open team-pagina' },
            ],
          },
        ],
      },
    ]
    const fallback = `Contract-evaluatie vandaag: ${todayEvals.map(e => e.name).join(', ')}`
    const ok = await sendChannelMessage('mt-groot', fallback, blocks as any)

    return NextResponse.json({ ok, evaluations: todayEvals })
  } catch (err) {
    console.error('[cron/contract-eval-reminder] mislukt:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
