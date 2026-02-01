import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all channels
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channels = await prisma.chatChannel.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { members: { some: { userId: session.user.id } } }
        ]
      },
      include: {
        _count: { select: { messages: true, members: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json(channels)
  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

// POST - Create a new channel
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, isPrivate } = await req.json()
    if (!name) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    const existingChannel = await prisma.chatChannel.findFirst({
      where: { name: name.toLowerCase() }
    })
    if (existingChannel) {
      return NextResponse.json({ error: 'Er bestaat al een kanaal met deze naam' }, { status: 400 })
    }

    const channel = await prisma.chatChannel.create({
      data: {
        name: name.toLowerCase(),
        description,
        isPrivate: isPrivate || false,
        members: { create: { userId: session.user.id } }
      },
      include: { _count: { select: { messages: true, members: true } } }
    })
    return NextResponse.json(channel, { status: 201 })
  } catch (error) {
    console.error('Error creating channel:', error)
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }
}
