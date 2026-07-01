// Cron: woensdagochtend Slack-DM naar wie deze week de infobox checkt.
// Schedule staat op woensdag 06:00 UTC (= 08:00 Amsterdam) in vercel.json.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'
import { weekStartISO } from '@/lib/infobox-week'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const now = new Date()
  const dry = new URL(req.url).searchParams.get('dry') === 'true'

  // Vangnet: alleen op woensdag (Amsterdam)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).format(now)
  if (!dry && wd !== 'Wed') return NextResponse.json({ skipped: `niet woensdag (${wd})` })

  const week = await prisma.infoboxWeek.findUnique({ where: { weekStart: weekStartISO(now) } })
  if (!week?.assigneeId) return NextResponse.json({ skipped: 'niemand toegewezen deze week' })

  const user = await prisma.user.findUnique({ where: { id: week.assigneeId }, select: { email: true, name: true } })
  if (!user?.email) return NextResponse.json({ skipped: 'geen e-mail voor toegewezen persoon' })

  const url = `${DASHBOARD_BASE}/dashboard/office`
  const message = `*Infobox deze week* 📬\nJij bent deze week aan de beurt om de infobox te checken. Vergeet 'm vandaag niet even door te nemen.\n\n<${url}|Naar Office>`

  if (dry) return NextResponse.json({ ok: true, dryRun: true, to: user.name, email: user.email })

  const ok = await sendDirectMessage(user.email, message)
  return NextResponse.json({ ok, to: user.name })
}
