import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH: Update conversation (move to project, rename)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id

  try {
    const body = await req.json()

    // Verify user owns the conversation
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { project: { members: { some: { userId } } } },
        ],
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Gesprek niet gevonden' }, { status: 404 })
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // Rename conversation
    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ error: 'Titel mag niet leeg zijn' }, { status: 400 })
      }
      updateData.title = body.title.trim().slice(0, 200)
    }

    // Move to project
    if (body.projectId !== undefined) {
      if (body.projectId) {
        const project = await prisma.aIProject.findFirst({
          where: {
            id: body.projectId,
            OR: [
              { userId },
              { members: { some: { userId } } },
            ],
          },
        })
        if (!project) {
          return NextResponse.json({ error: 'Project niet gevonden of geen toegang' }, { status: 403 })
        }
      }
      updateData.projectId = body.projectId || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 })
    }

    const updated = await prisma.aIConversation.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, conversationId: updated.id, title: updated.title, projectId: updated.projectId })
  } catch (error) {
    console.error('[conversations/PATCH] Error:', error)
    return NextResponse.json({ error: 'Kon gesprek niet bijwerken' }, { status: 500 })
  }
}

// DELETE: Delete a conversation and all its messages
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id

  try {
    // Verify user owns the conversation
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { project: { members: { some: { userId } } } },
        ],
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Gesprek niet gevonden' }, { status: 404 })
    }

    // Delete conversation (cascade deletes messages, favorites, annotations)
    await prisma.aIConversation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[conversations/DELETE] Error:', error)
    return NextResponse.json({ error: 'Kon gesprek niet verwijderen' }, { status: 500 })
  }
}
