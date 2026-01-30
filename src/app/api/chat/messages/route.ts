import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEV_USER } from '@/lib/dev-auth'

// GET - Fetch messages for a channel
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { channelId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST - Send a new message
export async function POST(req: NextRequest) {
  try {
    const { content, channelId } = await req.json()
    if (!content || !channelId) {
      return NextResponse.json({ error: 'Content and channel ID are required' }, { status: 400 })
    }

    // Add user as member if not already
    await prisma.channelMember.upsert({
      where: { userId_channelId: { userId: DEV_USER.id, channelId } },
      create: { userId: DEV_USER.id, channelId },
      update: {}
    })

    const message = await prisma.chatMessage.create({
      data: { content, senderId: DEV_USER.id, channelId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } }
    })
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
