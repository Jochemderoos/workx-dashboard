import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const STANDARD_TOPICS = [
  { title: 'Uren afgelopen week', sortOrder: 0, isStandard: true },
  { title: 'Werkverdeling partners', sortOrder: 1, isStandard: true },
]

const DEFAULT_PARTNERS = ['Bas', 'Maaike', 'Jochem', 'Juliette']

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

export async function POST(
  req: NextRequest,
  { params }: { params: { monthId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { monthId } = params
    const { meetingDate, dateLabel } = await req.json()

    if (!meetingDate || !dateLabel) {
      return NextResponse.json(
        { error: 'Vergaderdatum en label zijn verplicht' },
        { status: 400 }
      )
    }

    // Verify selected month exists (mag niet Lustrum-tab zijn — die heeft eigen logica)
    const requestedMonth = await prisma.meetingMonth.findUnique({
      where: { id: monthId },
    })
    if (!requestedMonth) {
      return NextResponse.json({ error: 'Maand niet gevonden' }, { status: 404 })
    }

    // Bepaal de werkelijke maand obv meetingDate (lokale datum).
    // Als de gekozen meeting in een andere kalendermaand valt dan de
    // aangevraagde MeetingMonth, leg 'm in de juiste (en maak die aan
    // als die er nog niet is). Dit voorkomt dat een 1 juni-meeting
    // onder 'Mei 2026' terechtkomt.
    const date = new Date(meetingDate)
    const targetYear = date.getFullYear()
    const targetMonth = date.getMonth() + 1 // 1-12

    let effectiveMonthId = monthId
    let createdNewMonth = false
    if (
      !requestedMonth.isLustrum &&
      (requestedMonth.year !== targetYear || requestedMonth.month !== targetMonth)
    ) {
      // Zoek bestaand of maak nieuw aan (idempotent dankzij unique index)
      const correctMonth = await prisma.meetingMonth.upsert({
        where: {
          year_month_isLustrum: {
            year: targetYear,
            month: targetMonth,
            isLustrum: false,
          },
        },
        update: {},
        create: {
          year: targetYear,
          month: targetMonth,
          label: `${MONTH_NAMES[targetMonth]} ${targetYear}`,
          isLustrum: false,
        },
      })
      effectiveMonthId = correctMonth.id
      createdNewMonth = correctMonth.createdAt.getTime() > Date.now() - 5000
    }

    const week = await prisma.meetingWeek.create({
      data: {
        monthId: effectiveMonthId,
        meetingDate: date,
        dateLabel,
        topics: {
          create: STANDARD_TOPICS,
        },
        // NOTE: distributions (werkverdelingsgesprekken) worden NIET automatisch
        // gemaakt — die voegt de user expliciet toe.
      },
      include: {
        topics: {
          orderBy: { sortOrder: 'asc' },
        },
        actions: true,
        distributions: true,
      },
    })

    return NextResponse.json({
      ...week,
      _meta: {
        movedToMonthId: effectiveMonthId !== monthId ? effectiveMonthId : null,
        createdNewMonth,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting week:', error)
    return NextResponse.json(
      { error: 'Kon vergaderweek niet aanmaken' },
      { status: 500 }
    )
  }
}
