// Dagelijkse cron om 07:00 NL: stuurt Slack-DM naar de persoon die vandaag
// de Infobox bijhoudt — TENZIJ Hanna (zij doet 't standaard, dan geen ping).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const now = new Date()
  // Vandaag in NL-datum als UTC date-only (zoals OfficePhoneDay opslaat).
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Skip weekend
  const dow = today.getUTCDay()
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ skipped: 'weekend' })
  }

  const entry = await prisma.officePhoneDay.findUnique({ where: { date: today } })
  const name = entry?.infoboxBy?.trim()

  if (!name) {
    return NextResponse.json({ skipped: 'geen infobox-toewijzing — Hanna doet het' })
  }
  if (name.toLowerCase().startsWith('hanna')) {
    return NextResponse.json({ skipped: 'Hanna toegewezen — geen melding' })
  }

  // Zoek user op naam
  const user = await prisma.user.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { email: true, name: true },
  })
  if (!user?.email) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden', name }, { status: 404 })
  }

  const url = `${DASHBOARD_BASE}/dashboard/office`
  const dateLabel = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  const blocks = [
    {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: '📋 Jij houdt vandaag de Infobox bij\n', style: { bold: true } },
            { type: 'text', text: `${dateLabel}. Houd 'm bij gedurende de dag — Hanna heeft jou hiervoor ingedeeld.\n\n→ ` },
            { type: 'link', url, text: 'Open Office in dashboard' },
          ],
        },
      ],
    },
  ]
  const fallback = `📋 Jij houdt vandaag (${dateLabel}) de Infobox bij. ${url}`

  try {
    const ok = await sendDirectMessage(user.email, fallback, blocks as any)
    return NextResponse.json({ ok, sentTo: user.name })
  } catch (err) {
    console.error('infobox reminder failed', err)
    return NextResponse.json({ error: 'Kon Slack-DM niet sturen' }, { status: 500 })
  }
}
