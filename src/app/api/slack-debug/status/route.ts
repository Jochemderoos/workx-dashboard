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

  // Diagnostiek: welke env-vars zijn beschikbaar in de runtime?
  // Toont alleen of de var aanwezig is + lengte (niet de waarde zelf).
  const envCheck: Record<string, { set: boolean; length: number }> = {}
  for (const key of [
    'SLACK_BOT_TOKEN',
    'CRON_SECRET',
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'ANTHROPIC_API_KEY',
    'BLOB_READ_WRITE_TOKEN',
    'VAPID_PRIVATE_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
  ]) {
    const v = process.env[key]
    envCheck[key] = { set: !!v, length: v ? v.length : 0 }
  }

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
    envCheck,
    deploymentInfo: {
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelUrl: process.env.VERCEL_URL || null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    },
  })
}
