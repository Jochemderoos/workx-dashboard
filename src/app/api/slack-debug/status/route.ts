// Slack-diagnose: token-status, bot-info, lijst van channels waar bot in zit.
// PARTNER + ADMIN.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testSlackConnection, listSlackChannels } from '@/lib/slack'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const tokenSet = !!process.env.SLACK_BOT_TOKEN
  const cronSecretSet = !!process.env.CRON_SECRET
  const nextauthUrl = process.env.NEXTAUTH_URL || null

  let auth: Awaited<ReturnType<typeof testSlackConnection>> | null = null
  let channels: Awaited<ReturnType<typeof listSlackChannels>> = []

  if (tokenSet) {
    try {
      auth = await testSlackConnection()
    } catch (err) {
      auth = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
    try {
      channels = await listSlackChannels()
    } catch {
      channels = []
    }
  }

  return NextResponse.json({
    tokenSet,
    cronSecretSet,
    nextauthUrl,
    auth,
    channels: channels.sort((a, b) => a.name.localeCompare(b.name)),
  })
}
