import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: List recent conversations for the current user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const conversations = await prisma.aIConversation.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { project: { members: { some: { userId: session.user.id } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        projectId: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        project: { select: { title: true, icon: true, color: true } },
      },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('[conversations/GET] Error:', error)
    return NextResponse.json({ error: 'Kon gesprekken niet ophalen' }, { status: 500 })
  }
}
