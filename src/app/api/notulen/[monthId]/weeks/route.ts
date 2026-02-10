import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const STANDARD_TOPICS = [
  { title: 'Uren afgelopen week', sortOrder: 0, isStandard: true },
  { title: 'Werkverdeling partners', sortOrder: 1, isStandard: true },
]

const DEFAULT_PARTNERS = ['Bas', 'Maaike', 'Jochem', 'Juliette']

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

    // Verify month exists
    const month = await prisma.meetingMonth.findUnique({
      where: { id: monthId },
    })

    if (!month) {
      return NextResponse.json(
        { error: 'Maand niet gevonden' },
        { status: 404 }
      )
    }

    const week = await prisma.meetingWeek.create({
      data: {
        monthId,
        meetingDate: new Date(meetingDate),
        dateLabel,
        topics: {
          create: STANDARD_TOPICS,
        },
        distributions: {
          create: DEFAULT_PARTNERS.map((partnerName) => ({
            partnerName,
            employeeName: '',
          })),
        },
      },
      include: {
        topics: {
          orderBy: { sortOrder: 'asc' },
        },
        actions: true,
        distributions: true,
      },
    })

    return NextResponse.json(week, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting week:', error)
    return NextResponse.json(
      { error: 'Kon vergaderweek niet aanmaken' },
      { status: 500 }
    )
  }
}
