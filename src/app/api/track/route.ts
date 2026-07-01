// Registreert een pagina-bezoek voor gebruiks-analytics.
// Alleen ingelogde gebruikers; userId wordt bewaard voor unieke tellingen maar
// NOOIT met naam getoond. Faalt stil zodat het navigeren nooit hindert.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Alleen echte dashboard-pagina's tellen (geen API/asset-paden).
function normalize(path: string): string | null {
  if (typeof path !== 'string') return null
  const clean = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/dashboard'
  if (!clean.startsWith('/dashboard')) return null
  if (clean.length > 200) return null
  return clean
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const path = normalize(body?.path)
    if (!path) return NextResponse.json({ ok: false }, { status: 400 })

    await prisma.pageView.create({ data: { path, userId: session.user.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('track pageview mislukt:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
