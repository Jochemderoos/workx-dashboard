// Eenmalige Slack-melding op 12 juni 2026: "Search bar is sterk verbeterd!"
// Cron draait dagelijks 09:00 NL maar verstuurt alleen op de target-datum,
// en alleen één keer (idempotent via Setting-flag in de DB).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const TARGET_DATE = '2026-06-12'  // morgen
const FLAG_KEY = 'slack-search-announce-2026-06-12'
const SLACK_CHANNEL = 'workx-algemeen'
const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Datum-gate
  const today = new Date().toISOString().slice(0, 10)
  if (today !== TARGET_DATE) {
    return NextResponse.json({ skipped: `niet ${TARGET_DATE} (vandaag: ${today})` })
  }

  // Idempotent-gate via Setting-tabel
  try {
    const flag = await prisma.appSetting.findUnique({ where: { key: FLAG_KEY } })
    if (flag?.value) {
      return NextResponse.json({ skipped: 'al verstuurd' })
    }
  } catch {
    // Setting-table check faalde — log en ga niet verder (veiliger dan dubbel sturen)
    return NextResponse.json({ error: 'Setting-tabel niet bereikbaar' }, { status: 500 })
  }

  const url = `${DASHBOARD_BASE}/dashboard`

  const blocks = [
    {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: '🔍 De zoekbalk in het dashboard is écht verbeterd!\n\n', style: { bold: true } },
            { type: 'text', text: 'Je vindt nu in één keer wat je zoekt — pagina\'s, hr-docs, kantoorgegevens (KvK / IBAN / BTW), én collega\'s. Typ bijvoorbeeld:\n' },
          ],
        },
        {
          type: 'rich_text_list',
          style: 'bullet',
          elements: [
            { type: 'rich_text_section', elements: [{ type: 'text', text: '"kantoor"' }, { type: 'text', text: ' → kantoorgegevens + Office + Workx docs' }] },
            { type: 'rich_text_section', elements: [{ type: 'text', text: '"IBAN"' }, { type: 'text', text: ' → bedrijfsrekening direct in beeld' }] },
            { type: 'rich_text_section', elements: [{ type: 'text', text: '"verlof"' }, { type: 'text', text: ' → vakantie aanvragen + handboek-hoofdstuk' }] },
            { type: 'rich_text_section', elements: [{ type: 'text', text: '"hanna"' }, { type: 'text', text: ' of een andere collega → direct naar het juiste overzicht' }] },
          ],
        },
        {
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: '\nDe grote zoekbalk staat bovenaan ' },
            { type: 'link', url, text: 'het dashboard' },
            { type: 'text', text: '. Geen idee waar iets staat? Begin gewoon te typen ✨' },
          ],
        },
      ],
    },
  ]

  const fallback = `🔍 De zoekbalk is verbeterd! Typ wat je zoekt (kantoor, IBAN, verlof, een collega...) en je krijgt direct het juiste resultaat. ${url}`

  try {
    const ok = await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)
    if (!ok) throw new Error('Slack returned false')

    // Markeer als verstuurd
    await prisma.appSetting.upsert({
      where: { key: FLAG_KEY },
      update: { value: 'sent' },
      create: { key: FLAG_KEY, value: 'sent' },
    })

    return NextResponse.json({ ok: true, sent: true })
  } catch (err) {
    console.error('slack-search-announce failed', err)
    return NextResponse.json({ error: 'Kon Slack-bericht niet sturen' }, { status: 500 })
  }
}
