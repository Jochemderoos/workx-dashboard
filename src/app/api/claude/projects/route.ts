import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: lijst van projecten voor de ingelogde gebruiker (eigen + gedeeld)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const projects = await prisma.aIProject.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      user: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(projects)
}

// POST: nieuw project aanmaken
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { title, description, icon, color, memberIds } = await req.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
  }

  const project = await prisma.aIProject.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      icon: icon || 'folder',
      color: color || '#f9ff85',
      userId: session.user.id,
      members: {
        create: [
          // Owner as member
          {
            userId: session.user.id,
            role: 'owner',
            addedById: session.user.id,
          },
          // Additional members
          ...(Array.isArray(memberIds)
            ? memberIds
                .filter((id: string) => id !== session.user.id)
                .map((id: string) => ({
                  userId: id,
                  role: 'member' as const,
                  addedById: session.user.id,
                }))
            : []),
        ],
      },
    },
    include: {
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      user: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(project, { status: 201 })
}
