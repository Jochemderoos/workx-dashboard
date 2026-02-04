import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testSlackConnection, getSlackUsers, sendDirectMessage, notifyNewZaakAssignment } from '@/lib/slack'

// GET - Test Slack connection and list users
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'PARTNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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

// POST - Send test notification to a user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'PARTNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { email, type = 'simple' } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is verplicht' }, { status: 400 })
    }

    let success = false

    if (type === 'zaak') {
      // Send a test zaak notification
      const testZaak = {
        id: 'test-123',
        title: '🧪 Test zaak - Arbeidsconflict ontslagvergoeding',
        clientName: 'Test B.V.',
        createdByName: session.user.name || 'Dashboard',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // +2 hours
      }

      success = await notifyNewZaakAssignment(email, testZaak)
    } else {
      // Send a simple test message
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '👋 Test bericht van Workx Dashboard',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Dit is een testbericht om te controleren of de Slack integratie werkt.\n\n*Verzonden door:* ${session.user.name}\n*Tijd:* ${new Date().toLocaleString('nl-NL')}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '✅ Als je dit bericht ziet, werkt de Slack integratie correct!',
            },
          ],
        },
      ]

      success = await sendDirectMessage(
        email,
        `Test bericht van Workx Dashboard - verzonden door ${session.user.name}`,
        blocks
      )
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test ${type === 'zaak' ? 'zaak notificatie' : 'bericht'} verzonden naar ${email}`,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `Kon geen bericht versturen naar ${email}. Controleer of het email adres bekend is in Slack.`,
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error sending test message:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    }, { status: 500 })
  }
}
