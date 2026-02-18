import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lightweight version endpoint for stale-code detection.
 * Returns the build ID so the client can compare with its own build ID.
 * Response time: <10ms (no DB, no auth, no processing).
 */
export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID || '' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
