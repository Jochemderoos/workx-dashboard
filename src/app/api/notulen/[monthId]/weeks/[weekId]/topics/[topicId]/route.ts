import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
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

    const { topicId } = params
    const { title, remarks, sortOrder } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (remarks !== undefined) updateData.remarks = remarks
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const topic = await prisma.meetingTopic.update({
      where: { id: topicId },
      data: updateData,
    })

    return NextResponse.json(topic)
  } catch (error) {
    console.error('Error updating meeting topic:', error)
    return NextResponse.json(
      { error: 'Kon agendapunt niet bijwerken' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
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

    const { topicId } = params

    await prisma.meetingTopic.delete({
      where: { id: topicId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting topic:', error)
    return NextResponse.json(
      { error: 'Kon agendapunt niet verwijderen' },
      { status: 500 }
    )
  }
}
