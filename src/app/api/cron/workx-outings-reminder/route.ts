// Dagelijkse cron: stuurt voor elk aankomend uitje tot 3 "Ben je erbij?"-
// reminders naar #workx-algemeen op 14, 7 en 2 dagen voor de datum.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'

// Reminder-tijdslots: hoeveel dagen voor het uitje.
const REMINDER_DAYS = [14, 7, 2]

const TYPE_EMOJI: Record<string, string> = {
  'borrel-kantoor': '🍻',
  'borrel-elders': '🍹',
  'etentje': '🍝',
  'film': '🎬',
  'suppen': '🏄',
  'jeu-de-boules': '🎯',
  'opera': '🎭',
  'voorstelling': '🎤',
  'bowling': '🎳',
  'padel': '🎾',
  'bierfiets': '🍺',
  'rollerdisco': '🛼',
  'overig': '✨',
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // TIJDELIJK UITGEZET op verzoek user.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const SLACK_PROMOTIE_AAN = false
  if (!SLACK_PROMOTIE_AAN) {
    return NextResponse.json({ skipped: 'workx-uitjes Slack-promotie staat uit' })
  }

  const now = new Date()
  // Alleen uitjes binnen volgende 21 dagen ophalen
  const horizon = new Date(now.getTime() + 21 * 86400000)
  const outings = await prisma.workxOuting.findMany({
    where: {
      date: { gte: now, lte: horizon },
    },
    include: {
      organizer: { select: { name: true } },
      attendances: { select: { id: true, plusOnes: true } },
    },
  })

  let sent = 0
  const results: Array<{ id: string; title: string; daysOut: number; sent: boolean }> = []

  for (const outing of outings) {
    const daysOut = Math.round((outing.date.getTime() - now.getTime()) / 86400000)
    // Vind het meest passende reminder-slot waar daysOut <= REMINDER_DAYS[i]
    // maar niet al gestuurd. We sturen alleen exact op die dag (binnen 1).
    const matchingDay = REMINDER_DAYS.find(d => Math.abs(daysOut - d) <= 0)
    if (matchingDay === undefined) continue

    // Check of deze reminder al verstuurd
    let sentList: string[] = []
    try {
      sentList = JSON.parse(outing.reminderSentAt || '[]')
    } catch { sentList = [] }
    const slotKey = `d${matchingDay}`
    if (sentList.includes(slotKey)) continue

    try {
      const emoji = TYPE_EMOJI[outing.type] || '✨'
      const dateLabel = outing.date.toLocaleDateString('nl-NL', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
      const attendeesCount = outing.attendances.reduce((s, a) => s + 1 + (a.plusOnes || 0), 0)
      const url = `${DASHBOARD_BASE}/dashboard/workx-uitjes`
      const dayLabel = matchingDay === 1 ? 'morgen' : matchingDay === 2 ? 'overmorgen' : `over ${matchingDay} dagen`

      const blocks = [
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: `${emoji} Ben je erbij? ${outing.title}\n`, style: { bold: true } },
                { type: 'text', text: `${dateLabel} (${dayLabel})\n` },
                { type: 'text', text: `${attendeesCount} ${attendeesCount === 1 ? 'persoon heeft' : 'mensen hebben'} zich al ingeschreven.\n\n→ ` },
                { type: 'link', url, text: 'Schrijf je in' },
              ],
            },
          ],
        },
      ]
      const fallback = `${emoji} Ben je erbij bij "${outing.title}" (${dateLabel})? ${url}`
      await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)
      sentList.push(slotKey)
      await prisma.workxOuting.update({
        where: { id: outing.id },
        data: { reminderSentAt: JSON.stringify(sentList) },
      })
      sent++
      results.push({ id: outing.id, title: outing.title, daysOut: matchingDay, sent: true })
    } catch (e) {
      console.error('Slack reminder failed for', outing.id, e)
      results.push({ id: outing.id, title: outing.title, daysOut, sent: false })
    }
  }

  return NextResponse.json({ ok: true, checked: outings.length, sent, results })
}
