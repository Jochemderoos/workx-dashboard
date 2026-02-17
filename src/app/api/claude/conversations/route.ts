import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: List conversations for the current user (with search and pagination)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || ''
  const cursor = searchParams.get('cursor') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      OR: [
        { userId: session.user.id },
        { project: { members: { some: { userId: session.user.id } } } },
      ],
    }

    // Add search filter
    if (search) {
      where.AND = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
        ],
      }
    }

    const conversations = await prisma.aIConversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1, // Fetch one extra to detect if there are more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        projectId: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        project: { select: { title: true, icon: true, color: true } },
      },
    })

    const hasMore = conversations.length > limit
    const results = hasMore ? conversations.slice(0, limit) : conversations
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined

    return NextResponse.json({
      conversations: results,
      nextCursor,
      hasMore,
    })
  } catch (error) {
    console.error('[conversations/GET] Error:', error)
    return NextResponse.json({ error: 'Kon gesprekken niet ophalen' }, { status: 500 })
  }
}
