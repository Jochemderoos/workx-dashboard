// Cron: dinsdag-reminders in #mt-groot.
// 1) Werkverdeling: als er voor deze week niemand is ingedeeld (WorkDistribution).
// 2) Info-inbox: als er voor deze week niemand is toegewezen (InfoboxWeek).
// Beide gaan pas in vanaf de eerste week van augustus 2026.
// Schedule: dinsdag 07:00 UTC (= 09:00 Amsterdam) — zie vercel.json.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'
import { weekStartISO } from '@/lib/infobox-week'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const CHANNEL = 'mt-groot'
const START_DATE = '2026-08-01' // reminders gaan pas hierna in

function amsterdamDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
function amsterdamWeekday(now: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).format(now)
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

    // Vangnet: alleen op dinsdag
    if (!dry && amsterdamWeekday(now) !== 'Tue') {
      return NextResponse.json({ skipped: 'niet dinsdag' })
    }
    // Gaat pas in vanaf de eerste week van augustus
    if (!dry && today < START_DATE) {
      return NextResponse.json({ skipped: `nog niet actief (${today} < ${START_DATE})` })
    }

    const weekStart = weekStartISO(now) // maandag van deze week (YYYY-MM-DD)
    const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`)
    const weekEndDate = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    const notulenUrl = `${DASHBOARD_BASE}/dashboard/partners/notulen`

    // 1) Werkverdeling van deze week
    const week = await prisma.meetingWeek.findFirst({
      where: { meetingDate: { gte: weekStartDate, lt: weekEndDate } },
      include: { distributions: true },
      orderBy: { meetingDate: 'desc' },
    })
    const assigned = week ? week.distributions.filter(d => d.employeeName && d.employeeName.trim()).length : 0
    const werkverdelingLeeg = assigned === 0

    // 2) Info-inbox van deze week
    const infobox = await prisma.infoboxWeek.findUnique({ where: { weekStart } })
    const infoboxLeeg = !infobox?.assigneeId

    const results: Record<string, unknown> = { today, weekStart, werkverdelingLeeg, infoboxLeeg }

    if (dry) return NextResponse.json({ ok: true, dryRun: true, ...results })

    if (werkverdelingLeeg) {
      const blocks = [{
        type: 'rich_text',
        elements: [{
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: 'Werkverdeling nog niet ingedeeld\n', style: { bold: true } },
            { type: 'text', text: 'Voor deze week staat nog niemand ingedeeld voor de werkverdeling. Zijn we het maandag vergeten? Vul het even in in ' },
            { type: 'link', url: notulenUrl, text: 'het partneroverleg' },
            { type: 'text', text: '.' },
          ],
        }],
      }]
      results.werkverdelingSlack = await sendChannelMessage(CHANNEL, `Werkverdeling nog niet ingedeeld — vul het in: ${notulenUrl}`, blocks)
    }

    if (infoboxLeeg) {
      const blocks = [{
        type: 'rich_text',
        elements: [{
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: 'Info-inbox nog niet toegewezen\n', style: { bold: true } },
            { type: 'text', text: 'Er is nog niemand ingevuld die deze week de info-inbox bijhoudt. Wijs iemand aan in ' },
            { type: 'link', url: notulenUrl, text: 'het partneroverleg' },
            { type: 'text', text: '.' },
          ],
        }],
      }]
      results.infoboxSlack = await sendChannelMessage(CHANNEL, `Info-inbox nog niet toegewezen — wijs iemand aan: ${notulenUrl}`, blocks)
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error('Error in tuesday-mt-reminders cron:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
