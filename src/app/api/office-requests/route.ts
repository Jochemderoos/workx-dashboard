// CRUD voor verzoeken aan Office team.
// - GET: lijst (open + afgerond binnen 7 dagen). Vertrouwelijke alleen voor Hanna+partners.
// - POST: nieuw verzoek. Iedereen mag. Partners kunnen 'confidential' zetten.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canSeeConfidential(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  // Lijst: open verzoeken + afgeronde van laatste 7 dagen
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const requests = await prisma.officeRequest.findMany({
    where: {
      OR: [
        { completedAt: null },
        { completedAt: { gte: sevenDaysAgo } },
      ],
    },
    include: {
      requester: { select: { id: true, name: true, avatarUrl: true, role: true } },
    },
    orderBy: [
      { completedAt: { sort: 'asc', nulls: 'first' } },
      { createdAt: 'desc' },
    ],
  })

  // Filter vertrouwelijke voor non-managers
  const filtered = requests.filter(r => {
    if (!r.confidential) return true
    if (canSeeConfidential(session.user.role)) return true
    if (r.requesterId === session.user.id) return true
    return false
  })

  return NextResponse.json({ requests: filtered })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    const description = body.description ? String(body.description).trim() : null
    const confidential = Boolean(body.confidential)
    // Office team mag namens iemand anders invoeren (mondelinge verzoeken)
    const onBehalfOf = typeof body.requesterId === 'string' && body.requesterId.trim() ? body.requesterId : null
    const userRole = session.user.role
    const isOffice = userRole === 'ADMIN' || userRole === 'OFFICE_MANAGER'

    let requesterId = session.user.id
    if (onBehalfOf && isOffice) {
      const existsUser = await prisma.user.findUnique({ where: { id: onBehalfOf }, select: { id: true } })
      if (existsUser) requesterId = onBehalfOf
    }

    if (!title) return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })

    // Alleen partners mogen vertrouwelijk kiezen
    const allowConfidential = canSeeConfidential(session.user.role)
    const finalConfidential = confidential && allowConfidential

    const created = await prisma.officeRequest.create({
      data: {
        requesterId,
        title,
        description: description || null,
        confidential: finalConfidential,
      },
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    })

    return NextResponse.json(created)
  } catch (err) {
    console.error('office-requests POST failed', err)
    return NextResponse.json({ error: 'Kon verzoek niet aanmaken' }, { status: 500 })
  }
}
