import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Actiepunt bijwerken/togglen
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string; actionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { actionId } = await params
    const body = await request.json()
    const { description, responsibleName, deadline, isCompleted } = body

    const data: any = {}
    if (description !== undefined) data.description = description
    if (responsibleName !== undefined) data.responsibleName = responsibleName
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
    if (isCompleted !== undefined) {
      data.isCompleted = isCompleted
      data.completedAt = isCompleted ? new Date() : null
    }

    const action = await prisma.werkoverlegAction.update({
      where: { id: actionId },
      data,
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('PATCH /api/werkoverleg/[dayId]/actions/[actionId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// DELETE - Actiepunt verwijderen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ dayId: string; actionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { actionId } = await params

    await prisma.werkoverlegAction.delete({
      where: { id: actionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/werkoverleg/[dayId]/actions/[actionId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
