import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: project detail met conversations en documents
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const project = await prisma.aIProject.findFirst({
    where: { id: params.id, userId: session.user.id },
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

  // Verify ownership
  const existing = await prisma.aIProject.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
  }

  const { title, description, status, icon, color } = await req.json()

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

  return NextResponse.json(project)
}

// DELETE: project verwijderen (cascade)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Verify ownership
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
