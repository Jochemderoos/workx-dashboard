import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId } = params
    const { dateLabel, meetingDate } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (dateLabel !== undefined) updateData.dateLabel = dateLabel
    if (meetingDate !== undefined) updateData.meetingDate = new Date(meetingDate)

    const week = await prisma.meetingWeek.update({
      where: { id: weekId },
      data: updateData,
      include: {
        topics: {
          orderBy: { sortOrder: 'asc' },
        },
        actions: true,
        distributions: true,
      },
    })

    return NextResponse.json(week)
  } catch (error) {
    console.error('Error updating meeting week:', error)
    return NextResponse.json(
      { error: 'Kon vergaderweek niet bijwerken' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId } = params

    await prisma.meetingWeek.delete({
      where: { id: weekId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting week:', error)
    return NextResponse.json(
      { error: 'Kon vergaderweek niet verwijderen' },
      { status: 500 }
    )
  }
}
