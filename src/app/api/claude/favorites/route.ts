import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: list user's favorites
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const favorites = await prisma.aIFavorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      message: {
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
          conversation: {
            select: { id: true, title: true, projectId: true },
          },
        },
      },
    },
  })

  return NextResponse.json(favorites)
}

// POST: toggle favorite on a message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { messageId, note } = await req.json()

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is verplicht' }, { status: 400 })
  }

  // Check if already favorited
  const existing = await prisma.aIFavorite.findUnique({
    where: { userId_messageId: { userId: session.user.id, messageId } },
  })

  if (existing) {
    // Remove favorite
    await prisma.aIFavorite.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false })
  }

  // Add favorite
  const favorite = await prisma.aIFavorite.create({
    data: {
      userId: session.user.id,
      messageId,
      note: note || null,
    },
  })

  return NextResponse.json({ favorited: true, id: favorite.id })
}
