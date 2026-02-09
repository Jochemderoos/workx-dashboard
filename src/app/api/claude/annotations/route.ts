import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: list annotations for a message
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const messageId = searchParams.get('messageId')

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is verplicht' }, { status: 400 })
  }

  const annotations = await prisma.aIAnnotation.findMany({
    where: { messageId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  })

  return NextResponse.json(annotations)
}

// POST: add annotation to a message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { messageId, content, type } = await req.json()

  if (!messageId || !content?.trim()) {
    return NextResponse.json({ error: 'messageId en content zijn verplicht' }, { status: 400 })
  }

  const annotation = await prisma.aIAnnotation.create({
    data: {
      userId: session.user.id,
      messageId,
      content: content.trim(),
      type: type || 'comment',
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  })

  return NextResponse.json(annotation)
}
