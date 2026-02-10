import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string; actionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { actionId } = params
    const { description, responsibleName, isCompleted, topicId } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (description !== undefined) updateData.description = description
    if (responsibleName !== undefined) updateData.responsibleName = responsibleName
    if (topicId !== undefined) updateData.topicId = topicId || null

    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted
      if (isCompleted === true) {
        updateData.completedAt = new Date()
      } else {
        updateData.completedAt = null
      }
    }

    const action = await prisma.meetingAction.update({
      where: { id: actionId },
      data: updateData,
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Error updating meeting action:', error)
    return NextResponse.json(
      { error: 'Kon actiepunt niet bijwerken' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string; actionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { actionId } = params

    await prisma.meetingAction.delete({
      where: { id: actionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting action:', error)
    return NextResponse.json(
      { error: 'Kon actiepunt niet verwijderen' },
      { status: 500 }
    )
  }
}
