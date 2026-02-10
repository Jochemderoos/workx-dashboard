import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
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

    const actions = await prisma.meetingAction.findMany({
      where: { weekId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(actions)
  } catch (error) {
    console.error('Error fetching meeting actions:', error)
    return NextResponse.json(
      { error: 'Kon actiepunten niet ophalen' },
      { status: 500 }
    )
  }
}

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
    const { description, responsibleName, topicId } = await req.json()

    if (!description || !responsibleName) {
      return NextResponse.json(
        { error: 'Beschrijving en verantwoordelijke zijn verplicht' },
        { status: 400 }
      )
    }

    const action = await prisma.meetingAction.create({
      data: {
        weekId,
        description,
        responsibleName,
        topicId: topicId || null,
        isCompleted: false,
      },
    })

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting action:', error)
    return NextResponse.json(
      { error: 'Kon actiepunt niet aanmaken' },
      { status: 500 }
    )
  }
}
