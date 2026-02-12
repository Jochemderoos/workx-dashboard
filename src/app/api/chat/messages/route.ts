import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch messages for a channel
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const cursor = searchParams.get('cursor') // Message ID for cursor-based pagination
    const direction = searchParams.get('direction') || 'before' // 'before' or 'after'

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is verplicht' }, { status: 400 })
    }

    // Verify channel exists and user has access
    const channel = await prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { isPrivate: true }
    })
    if (!channel) {
      return NextResponse.json({ error: 'Kanaal niet gevonden' }, { status: 404 })
    }
    if (channel.isPrivate) {
      const membership = await prisma.channelMember.findUnique({
        where: { userId_channelId: { userId: session.user.id, channelId } }
      })
      if (!membership) {
        return NextResponse.json({ error: 'Geen toegang tot dit kanaal' }, { status: 403 })
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { channelId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1, // Fetch one extra to detect hasMore
      ...(cursor ? {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      } : {}),
    })

    const hasMore = messages.length > limit
    const resultMessages = hasMore ? messages.slice(0, limit) : messages

    return NextResponse.json({
      messages: resultMessages,
      hasMore,
      nextCursor: hasMore ? resultMessages[resultMessages.length - 1]?.id : null,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Kon niet ophalen messages' }, { status: 500 })
  }
}

// POST - Send a new message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { content, channelId } = await req.json()
    if (!content || !channelId) {
      return NextResponse.json({ error: 'Content and channel ID are required' }, { status: 400 })
    }

    // Add user as member if not already
    await prisma.channelMember.upsert({
      where: { userId_channelId: { userId: session.user.id, channelId } },
      create: { userId: session.user.id, channelId },
      update: {}
    })

    const message = await prisma.chatMessage.create({
      data: { content, senderId: session.user.id, channelId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } }
    })
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
