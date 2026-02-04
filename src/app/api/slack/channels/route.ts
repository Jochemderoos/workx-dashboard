import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listSlackChannels, getChannelHistory, postToChannel, joinChannel } from '@/lib/slack'

// GET - List Slack channels or get messages from a channel
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    // If channelId provided, get messages
    if (channelId) {
      // Try to join the channel first (for public channels)
      await joinChannel(channelId)

      const limit = parseInt(searchParams.get('limit') || '20')
      const messages = await getChannelHistory(channelId, limit)
      return NextResponse.json({ messages })
    }

    // Otherwise list channels
    const channels = await listSlackChannels()
    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Error with Slack channels:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    )
  }
}

// POST - Send message to Slack channel
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, message } = await req.json()

    if (!channelId || !message) {
      return NextResponse.json(
        { error: 'channelId and message are required' },
        { status: 400 }
      )
    }

    const success = await postToChannel(channelId, message, session.user.name)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error posting to Slack:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    )
  }
}
