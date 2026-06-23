// Tussentijdse werkverdeling-update van een medewerker aan de partners.
// Werkt ook buiten het invul-venster (situatie kan midden in de week wijzigen).
// - GET  → eigen recente updates (laatste 21 dagen), voor teruglezen
// - POST body: { message } → slaat op, Slack naar #mt-groot, dashboard-melding partners

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'
import { getMondayOf, toDateOnly } from '@/lib/week-intake'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const MT_CHANNEL = 'mt-groot'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  const updates = await prisma.workDistributionUpdate.findMany({
    where: { userId: session.user.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(updates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'Bericht mag niet leeg zijn' }, { status: 400 })
    }

    const now = new Date()
    const weekStartDate = toDateOnly(getMondayOf(now))

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })

    const update = await prisma.workDistributionUpdate.create({
      data: { userId: session.user.id, weekStartDate, message },
    })

    // Slack naar #mt-groot (partners + Hanna). Niet-blokkerend.
    try {
      const url = `${DASHBOARD_BASE}/dashboard/partners/werkverdelingsgesprekken`
      const who = me?.name || 'Een collega'
      const blocks = [
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: `🔄 Werkverdeling-update van ${who}\n`, style: { bold: true } },
                { type: 'text', text: message },
                { type: 'text', text: `\n\n→ ` },
                { type: 'link', url, text: 'Bekijk werkverdeling' },
              ],
            },
          ],
        },
      ]
      const fallback = `🔄 Werkverdeling-update van ${who}: ${message}\n${url}`
      await sendChannelMessage(MT_CHANNEL, fallback, blocks as any)
    } catch (e) {
      console.error('Slack mt-groot post (werkverdeling-update) mislukt', e)
    }

    return NextResponse.json(update)
  } catch (error) {
    console.error('Error saving work distribution update:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
