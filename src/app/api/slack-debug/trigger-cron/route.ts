// Slack-diagnose: triggert een cron-route handmatig (server-side fetch met CRON_SECRET).
// PARTNER + ADMIN.
//
// POST body: { path: '/api/cron/werkoverleg-reminder' }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ALLOWED_PATHS = new Set([
  '/api/cron/werkoverleg-reminder',
  '/api/cron/partneroverleg-reminder',
  '/api/cron/week-intake-reminder',
  '/api/cron/daily-tip',
  '/api/cron/birthday-alert',
  '/api/cron/onboarding-status',
  '/api/cron/weekly-personal-digest',
  '/api/cron/daily-personal-digest',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const path = String(body.path || '')
    if (!ALLOWED_PATHS.has(path)) {
      return NextResponse.json({ error: 'Onbekend cron-pad' }, { status: 400 })
    }

    const base = process.env.NEXTAUTH_URL || new URL(req.url).origin
    const secret = process.env.CRON_SECRET
    const headers: Record<string, string> = {}
    if (secret) headers['Authorization'] = `Bearer ${secret}`

    const startedAt = Date.now()
    const res = await fetch(`${base}${path}`, { headers, method: 'GET' })
    const durationMs = Date.now() - startedAt

    let payload: unknown = null
    try { payload = await res.json() } catch { /* non-json */ }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      durationMs,
      payload,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Server error',
    }, { status: 500 })
  }
}
