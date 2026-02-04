import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { slack } from '@/lib/slack'

// Debug endpoint to see raw Slack data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get raw channel list (public only - we don't have groups:read scope)
    const result = await slack.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 100,
    })

    return NextResponse.json({
      ok: result.ok,
      channelCount: result.channels?.length || 0,
      channels: result.channels?.map(c => ({
        id: c.id,
        name: c.name,
        is_member: c.is_member,
        is_private: c.is_private,
        num_members: c.num_members,
      })),
      response_metadata: result.response_metadata,
    })
  } catch (error) {
    console.error('Slack debug error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error,
    }, { status: 500 })
  }
}
