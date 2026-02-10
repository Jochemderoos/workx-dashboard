import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
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
    const { title, remarks, sortOrder } = await req.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Titel is verplicht' },
        { status: 400 }
      )
    }

    // If no sortOrder provided, put it at the end
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined) {
      const lastTopic = await prisma.meetingTopic.findFirst({
        where: { weekId },
        orderBy: { sortOrder: 'desc' },
      })
      finalSortOrder = (lastTopic?.sortOrder ?? -1) + 1
    }

    const topic = await prisma.meetingTopic.create({
      data: {
        weekId,
        title,
        remarks: remarks ?? null,
        isStandard: false,
        sortOrder: finalSortOrder,
      },
    })

    return NextResponse.json(topic, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting topic:', error)
    return NextResponse.json(
      { error: 'Kon agendapunt niet aanmaken' },
      { status: 500 }
    )
  }
}
