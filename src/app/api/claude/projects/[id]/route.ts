import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper: check of user eigenaar of lid is
async function canAccessProject(projectId: string, userId: string) {
  const project = await prisma.aIProject.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
  })
  return project
}

// GET: project detail met conversations, documents en members
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const project = await prisma.aIProject.findFirst({
    where: {
      id: params.id,
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      conversations: {
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { messages: true } },
        },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { addedAt: 'asc' },
      },
      user: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
      },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
  }

  return NextResponse.json(project)
}

// PUT: project bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Verify access (owner or member)
  const existing = await canAccessProject(params.id, session.user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
  }

  const { title, description, status, icon, color, memberIds } = await req.json()

  // Update project fields
  const project = await prisma.aIProject.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(status !== undefined && { status }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
    },
  })

  // Update members (only owner can change members)
  if (Array.isArray(memberIds) && existing.userId === session.user.id) {
    // Get current members
    const currentMembers = await prisma.aIProjectMember.findMany({
      where: { projectId: params.id },
    })
    const currentMemberIds = currentMembers.map(m => m.userId)

    // Ensure owner is always included
    const newMemberIds = Array.from(new Set([session.user.id, ...memberIds]))

    // Remove members not in new list (except owner)
    const toRemove = currentMemberIds.filter(id => !newMemberIds.includes(id))
    if (toRemove.length > 0) {
      await prisma.aIProjectMember.deleteMany({
        where: { projectId: params.id, userId: { in: toRemove } },
      })
    }

    // Add new members
    const toAdd = newMemberIds.filter(id => !currentMemberIds.includes(id))
    if (toAdd.length > 0) {
      await prisma.aIProjectMember.createMany({
        data: toAdd.map(userId => ({
          projectId: params.id,
          userId,
          role: userId === session.user.id ? 'owner' : 'member',
          addedById: session.user.id,
        })),
        skipDuplicates: true,
      })
    }
  }

  return NextResponse.json(project)
}

// DELETE: project verwijderen (alleen eigenaar)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Only owner can delete
  const existing = await prisma.aIProject.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
  }

  await prisma.aIProject.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
