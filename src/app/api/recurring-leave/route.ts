// Vaste terugkerende verlofdagen (bijv. elke maandag onbetaald ouderschapsverlof).
// - GET    : alle regels (met naam) — managers
// - POST   : regel aanmaken — managers
// - DELETE ?id : regel verwijderen — managers

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeVerlofType } from '@/lib/verlof-types'

function isManager(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!isManager(session.user.role)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const rules = await prisma.recurringLeave.findMany({ orderBy: { createdAt: 'desc' } })
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } })
  const nameById = new Map(users.map(u => [u.id, u.name]))
  return NextResponse.json({ rules: rules.map(r => ({ ...r, userName: nameById.get(r.userId) || '' })) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!isManager(session.user.role)) return NextResponse.json({ error: 'Alleen office/partners kunnen dit instellen' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const userId = typeof b.userId === 'string' ? b.userId : ''
  const type = normalizeVerlofType(b.type)
  const weekday = Number(b.weekday)
  const startDate = b.startDate ? new Date(b.startDate) : null
  if (!userId || !startDate || isNaN(startDate.getTime())) return NextResponse.json({ error: 'Medewerker en startdatum zijn verplicht' }, { status: 400 })
  if (!(weekday >= 1 && weekday <= 5)) return NextResponse.json({ error: 'Kies een werkdag (ma–vr)' }, { status: 400 })

  const isOuder = type === 'ouderschap_betaald' || type === 'ouderschap_onbetaald'
  const created = await prisma.recurringLeave.create({
    data: {
      userId,
      type,
      weekday,
      dayValue: typeof b.dayValue === 'number' && b.dayValue > 0 ? b.dayValue : 1,
      childNumber: isOuder ? (b.childNumber === 2 ? 2 : 1) : null,
      startDate,
      endDate: b.endDate ? new Date(b.endDate) : null,
      note: typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null,
      createdById: session.user.id,
    },
  })
  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!isManager(session.user.role)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  await prisma.recurringLeave.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ success: true })
}
