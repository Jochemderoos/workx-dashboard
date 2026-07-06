// Reservering van de vergaderruimte (via Appjeplekje).
// - GET    ?date=YYYY-MM-DD  → reserveringen voor die dag
//          ?startDate&endDate → reserveringen in een reeks (gegroepeerd per dag)
// - POST   → reserveren { date, startTime, endTime, title? } (iedereen)
// - DELETE ?id → eigen reservering (of PARTNER/ADMIN)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

// Zet 'YYYY-MM-DD' + 'HH:MM' (Amsterdam-wandkloktijd) om naar het juiste UTC-moment.
function amsterdamToUtc(dateStr: string, hhmm: string): Date {
  const [Y, M, D] = dateStr.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const wall = Date.UTC(Y, M - 1, D, h, mi)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(wall))
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const localAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  const offset = localAsUtc - wall
  return new Date(wall - offset)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (startDate && endDate) {
    const rows = await prisma.meetingRoomBooking.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
    const byDate: Record<string, typeof rows> = {}
    for (const r of rows) (byDate[r.date] ||= []).push(r)
    return NextResponse.json({ byDate })
  }

  const d = date || new Date().toISOString().slice(0, 10)
  const bookings = await prisma.meetingRoomBooking.findMany({
    where: { date: d },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json({ date: d, bookings })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const date = typeof body.date === 'string' ? body.date : ''
  const startTime = body.startTime
  const endTime = body.endTime
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isTime(startTime) || !isTime(endTime)) {
    return NextResponse.json({ error: 'Ongeldige datum of tijd' }, { status: 400 })
  }
  if (endTime <= startTime) {
    return NextResponse.json({ error: 'Eindtijd moet na de starttijd liggen' }, { status: 400 })
  }

  // Dubbelboeking-check: overlap met bestaande reservering op dezelfde dag
  const sameDay = await prisma.meetingRoomBooking.findMany({ where: { date } })
  const overlap = sameDay.find(b => startTime < b.endTime && endTime > b.startTime)
  if (overlap) {
    return NextResponse.json(
      { error: `Al gereserveerd van ${overlap.startTime}–${overlap.endTime}${overlap.title ? ` (${overlap.title})` : ''} door ${overlap.userName}` },
      { status: 409 },
    )
  }

  // Koppel-event in de Agenda aanmaken (zodat het ook daar zichtbaar is).
  let calendarEventId: string | null = null
  try {
    const event = await prisma.calendarEvent.create({
      data: {
        title: `Vergaderruimte${title ? ` — ${title}` : ''}`,
        description: `Reservering vergaderruimte door ${session.user.name || 'onbekend'}`,
        startTime: amsterdamToUtc(date, startTime),
        endTime: amsterdamToUtc(date, endTime),
        location: 'Vergaderruimte',
        color: '#fb7185', // rose — valt op in de agenda
        category: 'MEETING_ROOM',
        createdById: session.user.id,
      },
    })
    calendarEventId = event.id
  } catch (e) {
    console.error('Kon agenda-event niet aanmaken voor vergaderruimte:', e)
  }

  const booking = await prisma.meetingRoomBooking.create({
    data: { date, startTime, endTime, title, userId: session.user.id, userName: session.user.name || 'Onbekend', calendarEventId },
  })
  return NextResponse.json(booking)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const booking = await prisma.meetingRoomBooking.findUnique({ where: { id } })
  if (!booking) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const role = (session.user.role || '') as string
  const isManager = role === 'PARTNER' || role === 'ADMIN'
  if (booking.userId !== session.user.id && !isManager) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  // Ook het gekoppelde agenda-event opruimen
  if (booking.calendarEventId) {
    await prisma.calendarEvent.delete({ where: { id: booking.calendarEventId } }).catch(() => {})
  }
  await prisma.meetingRoomBooking.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
