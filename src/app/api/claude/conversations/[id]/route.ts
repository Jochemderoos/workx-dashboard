import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH: Move conversation to a project
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
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is verplicht' }, { status: 400 })
    }

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

    // Verify user has access to the target project
    const project = await prisma.aIProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden of geen toegang' }, { status: 403 })
    }

    // Move conversation to project
    const updated = await prisma.aIConversation.update({
      where: { id },
      data: { projectId },
    })

    return NextResponse.json({ success: true, conversationId: updated.id, projectId })
  } catch (error) {
    console.error('[conversations/PATCH] Error:', error)
    return NextResponse.json({ error: 'Kon gesprek niet verplaatsen' }, { status: 500 })
  }
}
