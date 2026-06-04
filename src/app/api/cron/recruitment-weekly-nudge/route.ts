// Cron: wekelijkse "denk-aan-recruitment" nudge in #workx-algemeen.
//
// Werking: cron firet elk uur tussen 09:00-17:00 NL Mon-Fri.
// Per week wordt deterministisch ÉÉN slot gekozen (op basis van ISO-weeknummer)
// — alleen op dat moment verschijnt het bericht. Zo voelt het als een "willekeurig"
// moment, maar het is reproduceerbaar en debugbaar.
//
// De tekst varieert ook per week, zodat het niet repetitief wordt.
//
// Schedule in vercel.json: 0 7-15 * * 1-5  (= 09:00-17:00 NL zomertijd Mon-Fri)

import { NextRequest, NextResponse } from 'next/server'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
const SLACK_CHANNEL = 'workx-algemeen'

const MESSAGES: { title: string; body: string }[] = [
  { title: 'Even denken aan recruitment',
    body: 'Wie ben je deze week tegengekomen die wel bij Workx zou passen? Voeg ze toe of update je lijstje.\n→ ' },
  { title: 'LinkedIn-doomscroll-check',
    body: 'Zag je vandaag iemand voorbijkomen die je intrigeerde? Zet ’m in je recruitment-lijstje voor je het vergeet.\n→ ' },
  { title: 'Eén nieuwe naam per week',
    body: 'Doel: minimaal één nieuwe potentiele Workxer per week. Wie staat er op jouw lijst voor deze week?\n→ ' },
  { title: 'Opvolging op je lijstje',
    body: 'Heb je nog iemand op je lijst staan die je wilde benaderen? Vandaag is een prima dag voor dat appje.\n→ ' },
  { title: 'Ambassadeurs check',
    body: 'Wie ken je die enthousiast over Workx zou kunnen praten? Vul je ambassadeur in als je dat nog niet hebt gedaan.\n→ ' },
  { title: 'Recruitment-coffee?',
    body: 'Plan eens een koffie met iemand uit je lijst. Voeg de naam toe als je het nog niet hebt vastgelegd.\n→ ' },
  { title: 'Doorlopend talent zoeken',
    body: 'We zoeken het hele jaar door. Vandaag een goed moment om je lijstje te checken en aan te vullen.\n→ ' },
  { title: 'Wie zag jij stralen?',
    body: 'Een collega of tegenstander die je deze week heeft verbaasd? Misschien iets voor jouw Workx-lijst.\n→ ' },
  { title: 'Update je lijst',
    body: 'Misschien hebben sommigen op je lijst inmiddels iets gewijzigd in werk. Tijd voor een check.\n→ ' },
  { title: 'Korte recruitment-stop',
    body: 'Neem 30 seconden om iemand toe te voegen of een status bij te werken in het recruitment-overzicht.\n→ ' },
]

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const now = new Date()
    const nlNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
    const nlDay = nlNow.getDay() // 1=ma..5=vr
    const nlHour = nlNow.getHours()

    // Mogelijke slots: Mon-Fri × 09:00-17:00 = 45 slots
    const slots: { dow: number; hour: number }[] = []
    for (let dow = 1; dow <= 5; dow++) {
      for (let hour = 9; hour <= 17; hour++) {
        slots.push({ dow, hour })
      }
    }
    const weekNum = isoWeekNumber(now)
    const slot = slots[weekNum % slots.length]
    const isOurSlot = nlDay === slot.dow && nlHour === slot.hour

    if (!isOurSlot) {
      return NextResponse.json({ skipped: 'niet het slot deze week', slot, nlDay, nlHour, weekNum })
    }

    const msg = MESSAGES[weekNum % MESSAGES.length]
    const url = `${DASHBOARD_BASE}/dashboard/recruitment`
    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `${msg.title}\n`, style: { bold: true } },
              { type: 'text', text: msg.body },
              { type: 'link', url, text: 'Open recruitment-lijst' },
            ],
          },
        ],
      },
    ]
    const fallback = `${msg.title} — ${url}`
    const ok = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)

    return NextResponse.json({ ok, slot, weekNum, messageIdx: weekNum % MESSAGES.length })
  } catch (err) {
    console.error('[cron/recruitment-weekly-nudge] mislukt:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
