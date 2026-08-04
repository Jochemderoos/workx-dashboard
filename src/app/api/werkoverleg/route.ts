import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Lijst alle vergaderdagen (desc op datum)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const days = await prisma.werkoverlegDay.findMany({
      orderBy: { meetingDate: 'desc' },
      include: {
        _count: {
          select: { agendaItems: true, actionItems: true },
        },
      },
    })

    return NextResponse.json(days)
  } catch (error) {
    console.error('GET /api/werkoverleg error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST - Nieuwe vergaderdag aanmaken
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await request.json()
    const { meetingDate, chairperson } = body

    if (!meetingDate) {
      return NextResponse.json({ error: 'meetingDate is verplicht' }, { status: 400 })
    }

    const date = new Date(meetingDate)

    // Genereer dateLabel: "Dinsdag 25 maart 2026"
    const dateLabel = date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Amsterdam',
    })
    const formattedLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

    // Check of deze datum al bestaat
    const existing = await prisma.werkoverlegDay.findFirst({
      where: {
        meetingDate: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Er bestaat al een vergaderdag op deze datum' }, { status: 409 })
    }

    const day = await prisma.werkoverlegDay.create({
      data: {
        meetingDate: date,
        dateLabel: formattedLabel,
        chairperson: chairperson || null,
        agendaItems: {
          create: [
            { title: 'Wie wordt voorzitter (komende 2 werkoverleggen)?', sortOrder: 1 },
            { title: 'Wie maakt de actielijst?', sortOrder: 2 },
            { title: 'Actielijst vorige week', sortOrder: 3 },
            { title: 'Terugkoppeling partneroverleg', sortOrder: 4 },
            { title: 'Ingebrachte onderwerpen', sortOrder: 5 },
            { title: 'WVTTK', sortOrder: 6 },
          ],
        },
      },
    })

    return NextResponse.json(day, { status: 201 })
  } catch (error) {
    console.error('POST /api/werkoverleg error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
