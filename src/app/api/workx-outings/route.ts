// CRUD voor Workx-uitjes.
// - GET: lijst (alle aankomende + recent verleden).
// - POST: nieuw uitje (iedereen). Stuurt Slack-melding naar #workx-algemeen.
// - PATCH/DELETE: alleen organisator of admin.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'
import { syncOutingToCalendar, deleteCalendarEventForOuting, syncOutingToYearAgenda, removeOutingFromYearAgenda } from '@/lib/workx-outing-sync'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'workx-algemeen'

const OUTING_TYPES = ['borrel-kantoor', 'borrel-elders', 'etentje', 'film', 'suppen', 'jeu-de-boules', 'opera', 'voorstelling', 'bowling', 'padel', 'bierfiets', 'rollerdisco', 'overig'] as const

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

const TYPE_LABEL: Record<string, string> = {
  'borrel-kantoor': 'Borrel op kantoor',
  'borrel-elders': 'Terras-borrel',
  'etentje': 'Etentje',
  'film': 'Film',
  'suppen': 'Suppen',
  'jeu-de-boules': 'Jeu de boules',
  'opera': 'Opera',
  'voorstelling': 'Voorstelling',
  'bowling': 'Bowling',
  'padel': 'Padel',
  'bierfiets': 'Bierfiets',
  'rollerdisco': 'Rollerdisco',
  'overig': 'Iets leuks',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all' // 'upcoming' | 'past' | 'all'

  try {
    const where: Record<string, unknown> = {}
    if (filter === 'upcoming') {
      where.date = { gte: new Date() }
    } else if (filter === 'past') {
      where.date = { lt: new Date() }
    }
    const outings = await prisma.workxOuting.findMany({
      where,
      include: {
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        attendances: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { date: filter === 'past' ? 'desc' : 'asc' },
    })
    return NextResponse.json(outings)
  } catch (err) {
    console.error('workx-outings GET failed', err)
    return NextResponse.json({ error: 'Kon uitjes niet ophalen' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.title?.trim() || !body.type || !body.date) {
      return NextResponse.json({ error: 'Titel, type en datum zijn verplicht' }, { status: 400 })
    }
    if (!OUTING_TYPES.includes(body.type)) {
      return NextResponse.json({ error: 'Onbekend type uitje' }, { status: 400 })
    }

    const outing = await prisma.workxOuting.create({
      data: {
        title: body.title.trim(),
        type: body.type,
        date: new Date(body.date),
        location: body.location?.trim() || null,
        description: body.description?.trim() || null,
        organizerId: session.user.id,
        imageUrl: body.imageUrl?.trim() || null,
      },
      include: {
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        attendances: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    })

    // Auto-sync naar Agenda + Jaaragenda (niet-blokkerend)
    try {
      await syncOutingToCalendar({
        id: outing.id,
        title: outing.title,
        type: outing.type,
        date: outing.date,
        location: outing.location,
        description: outing.description,
        organizerId: outing.organizerId,
        calendarEventId: null,
      })
    } catch (e) {
      console.error('Auto-sync naar agenda mislukt', e)
    }
    try {
      await syncOutingToYearAgenda({
        title: outing.title,
        type: outing.type,
        date: outing.date,
        location: outing.location,
      })
    } catch (e) {
      console.error('Auto-sync naar jaaragenda mislukt', e)
    }

    // Slack-melding naar #workx-algemeen
    try {
      const dateLabel = new Date(outing.date).toLocaleDateString('nl-NL', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
      const url = `${DASHBOARD_BASE}/dashboard/workx-uitjes`
      const emoji = TYPE_EMOJI[outing.type] || '✨'
      const typeLabel = TYPE_LABEL[outing.type] || outing.type
      const blocks = [
        {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: `${emoji} Nieuw Workx-uitje: ${outing.title}\n`, style: { bold: true } },
                { type: 'text', text: `${typeLabel} · ${dateLabel}` },
                ...(outing.location ? [{ type: 'text', text: ` · ${outing.location}` }] : []),
                { type: 'text', text: `\nOrganisator: ${outing.organizer.name}\n\n→ ` },
                { type: 'link', url, text: 'Schrijf je in' },
              ],
            },
          ],
        },
      ]
      const fallback = `${emoji} ${outing.title} — ${dateLabel}. Schrijf je in: ${url}`
      await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)
      await prisma.workxOuting.update({
        where: { id: outing.id },
        data: { slackNoticedAt: new Date() },
      })
    } catch (e) {
      console.error('Slack post failed', e)
    }

    return NextResponse.json(outing)
  } catch (err) {
    console.error('workx-outings POST failed', err)
    return NextResponse.json({ error: 'Kon uitje niet aanmaken' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

    const existing = await prisma.workxOuting.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isManager = me?.role === 'PARTNER' || me?.role === 'ADMIN' || me?.role === 'OFFICE_MANAGER'
    if (existing.organizerId !== session.user.id && !isManager) {
      return NextResponse.json({ error: 'Alleen organisator of admin' }, { status: 403 })
    }

    const updated = await prisma.workxOuting.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.type !== undefined && OUTING_TYPES.includes(body.type) && { type: body.type }),
        ...(body.date !== undefined && { date: new Date(body.date) }),
        ...(body.location !== undefined && { location: body.location?.trim() || null }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl?.trim() || null }),
      },
      include: {
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        attendances: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    })

    // Sync wijzigingen naar Agenda + Jaaragenda
    try {
      await syncOutingToCalendar({
        id: updated.id,
        title: updated.title,
        type: updated.type,
        date: updated.date,
        location: updated.location,
        description: updated.description,
        organizerId: updated.organizerId,
        calendarEventId: updated.calendarEventId,
      })
    } catch (e) {
      console.error('Auto-sync naar agenda mislukt', e)
    }
    try {
      // Als de datum verschoven is naar een ander jaar/maand: verwijder oude eerst
      if (existing.date.getFullYear() !== updated.date.getFullYear() ||
          existing.date.getMonth() !== updated.date.getMonth() ||
          existing.title !== updated.title) {
        await removeOutingFromYearAgenda({ title: existing.title, date: existing.date })
      }
      await syncOutingToYearAgenda({
        title: updated.title,
        type: updated.type,
        date: updated.date,
        location: updated.location,
      }, existing.title !== updated.title ? existing.title : undefined)
    } catch (e) {
      console.error('Auto-sync naar jaaragenda mislukt', e)
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('workx-outings PATCH failed', err)
    return NextResponse.json({ error: 'Kon uitje niet bijwerken' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  try {
    const existing = await prisma.workxOuting.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isManager = me?.role === 'PARTNER' || me?.role === 'ADMIN' || me?.role === 'OFFICE_MANAGER'
    if (existing.organizerId !== session.user.id && !isManager) {
      return NextResponse.json({ error: 'Alleen organisator of admin' }, { status: 403 })
    }
    // Clean-up Agenda + Jaaragenda eerst
    try {
      await deleteCalendarEventForOuting({ calendarEventId: existing.calendarEventId })
    } catch (e) { console.error('Calendar cleanup mislukt', e) }
    try {
      await removeOutingFromYearAgenda({ title: existing.title, date: existing.date })
    } catch (e) { console.error('Jaaragenda cleanup mislukt', e) }

    await prisma.workxOuting.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('workx-outings DELETE failed', err)
    return NextResponse.json({ error: 'Kon uitje niet verwijderen' }, { status: 500 })
  }
}
