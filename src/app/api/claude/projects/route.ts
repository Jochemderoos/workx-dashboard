import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: lijst van projecten voor de ingelogde gebruiker
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const projects = await prisma.aIProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
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

  const { title, description, icon, color } = await req.json()

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
    },
    include: {
      _count: {
        select: {
          conversations: true,
          documents: true,
        },
      },
    },
  })

  return NextResponse.json(project, { status: 201 })
}
