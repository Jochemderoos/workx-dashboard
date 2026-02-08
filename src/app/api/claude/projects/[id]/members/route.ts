import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: huidige leden van een project
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Check access
  const project = await prisma.aIProject.findFirst({
    where: {
      id: params.id,
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
  }

  const members = await prisma.aIProjectMember.findMany({
    where: { projectId: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { addedAt: 'asc' },
  })

  return NextResponse.json(members)
}

// POST: lid toevoegen aan project (alleen eigenaar)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Only owner can add members
  const project = await prisma.aIProject.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!project) {
    return NextResponse.json({ error: 'Alleen de eigenaar kan leden toevoegen' }, { status: 403 })
  }

  const { userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId is verplicht' }, { status: 400 })
  }

  const member = await prisma.aIProjectMember.upsert({
    where: {
      projectId_userId: { projectId: params.id, userId },
    },
    create: {
      projectId: params.id,
      userId,
      role: 'member',
      addedById: session.user.id,
    },
    update: {},
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  })

  return NextResponse.json(member, { status: 201 })
}

// DELETE: lid verwijderen uit project (alleen eigenaar)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Only owner can remove members
  const project = await prisma.aIProject.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!project) {
    return NextResponse.json({ error: 'Alleen de eigenaar kan leden verwijderen' }, { status: 403 })
  }

  const { userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId is verplicht' }, { status: 400 })
  }

  // Can't remove owner
  if (userId === project.userId) {
    return NextResponse.json({ error: 'De eigenaar kan niet verwijderd worden' }, { status: 400 })
  }

  await prisma.aIProjectMember.deleteMany({
    where: { projectId: params.id, userId },
  })

  return NextResponse.json({ success: true })
}
