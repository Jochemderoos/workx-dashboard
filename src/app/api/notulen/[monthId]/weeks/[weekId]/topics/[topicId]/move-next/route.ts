import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — kopieer een agendapunt naar de eerstvolgende geplande
// vergaderweek (smallest meetingDate > huidige meetingDate). Geeft een
// 404 terug als er nog geen volgende week is.
export async function POST(
  _req: Request,
  { params }: { params: { monthId: string; weekId: string; topicId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { topicId, weekId } = params

    const topic = await prisma.meetingTopic.findUnique({
      where: { id: topicId },
      include: {
        week: { select: { id: true, meetingDate: true } },
      },
    })

    if (!topic) {
      return NextResponse.json({ error: 'Agendapunt niet gevonden' }, { status: 404 })
    }

    // Zoek eerstvolgende vergaderweek (over alle maanden heen)
    const nextWeek = await prisma.meetingWeek.findFirst({
      where: {
        meetingDate: { gt: topic.week.meetingDate },
      },
      orderBy: { meetingDate: 'asc' },
      include: {
        topics: {
          orderBy: { sortOrder: 'desc' },
          take: 1,
          select: { sortOrder: true },
        },
        month: { select: { id: true, label: true } },
      },
    })

    if (!nextWeek) {
      return NextResponse.json(
        { error: 'Geen volgende vergaderweek gevonden. Maak eerst een nieuwe week aan.' },
        { status: 404 }
      )
    }

    const nextSortOrder = (nextWeek.topics[0]?.sortOrder ?? -1) + 1

    const created = await prisma.meetingTopic.create({
      data: {
        weekId: nextWeek.id,
        title: topic.title,
        remarks: null,
        isStandard: false,
        sortOrder: nextSortOrder,
      },
    })

    return NextResponse.json({
      topic: created,
      targetWeek: {
        id: nextWeek.id,
        dateLabel: nextWeek.dateLabel,
        meetingDate: nextWeek.meetingDate,
        monthId: nextWeek.month.id,
        monthLabel: nextWeek.month.label,
      },
      sourceWeekId: weekId,
    }, { status: 201 })
  } catch (error) {
    console.error('Error moving topic to next week:', error)
    return NextResponse.json(
      { error: 'Kon agendapunt niet doorzetten' },
      { status: 500 }
    )
  }
}
