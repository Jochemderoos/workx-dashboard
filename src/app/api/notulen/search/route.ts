import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Zoekterm is verplicht' },
        { status: 400 }
      )
    }

    const [topics, actions] = await Promise.all([
      prisma.meetingTopic.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { remarks: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          week: {
            select: {
              id: true,
              dateLabel: true,
              month: {
                select: {
                  id: true,
                  label: true,
                  year: true,
                  month: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.meetingAction.findMany({
        where: {
          description: { contains: q, mode: 'insensitive' },
        },
        include: {
          week: {
            select: {
              id: true,
              dateLabel: true,
              month: {
                select: {
                  id: true,
                  label: true,
                  year: true,
                  month: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      topics: topics.map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        title: topic.title,
        remarks: topic.remarks,
        weekId: topic.week.id,
        weekLabel: topic.week.dateLabel,
        monthId: topic.week.month.id,
        monthLabel: topic.week.month.label,
      })),
      actions: actions.map((action) => ({
        type: 'action' as const,
        id: action.id,
        description: action.description,
        responsibleName: action.responsibleName,
        isCompleted: action.isCompleted,
        weekId: action.week.id,
        weekLabel: action.week.dateLabel,
        monthId: action.week.month.id,
        monthLabel: action.week.month.label,
      })),
    })
  } catch (error) {
    console.error('Error searching notulen:', error)
    return NextResponse.json(
      { error: 'Kon niet zoeken in notulen' },
      { status: 500 }
    )
  }
}
