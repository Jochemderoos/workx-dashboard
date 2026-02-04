import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testSlackConnection, getSlackUsers } from '@/lib/slack'

// GET - Test Slack connection and list users
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'PARTNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test connection
    const connection = await testSlackConnection()

    if (!connection.ok) {
      return NextResponse.json({
        status: 'error',
        error: connection.error,
      }, { status: 500 })
    }

    // Get users
    const users = await getSlackUsers()
    const userList = Array.from(users.values()).map(u => ({
      name: u.realName,
      email: u.email,
    }))

    return NextResponse.json({
      status: 'connected',
      team: connection.team,
      bot: connection.bot,
      users: userList,
      userCount: userList.length,
    })
  } catch (error) {
    console.error('Error testing Slack:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
