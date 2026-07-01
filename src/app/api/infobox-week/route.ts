// Wekelijkse infobox-toewijzing.
// - GET  : huidige week (toegewezen persoon) + keuzelijst (partners + Hanna).
//          Iedere ingelogde gebruiker mag lezen (voor de homepage-widget).
// - POST : toewijzen voor de huidige week (alleen PARTNER/ADMIN).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { weekStartISO } from '@/lib/infobox-week'

const HANNA_EMAIL = 'hanna.blaauboer@workxadvocaten.nl'

async function eligiblePeople() {
  return prisma.user.findMany({
    where: { isActive: true, OR: [{ role: 'PARTNER' }, { email: HANNA_EMAIL }] },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const weekStart = weekStartISO()
  const [current, eligible] = await Promise.all([
    prisma.infoboxWeek.findUnique({ where: { weekStart } }),
    eligiblePeople(),
  ])

  return NextResponse.json({
    weekStart,
    assignee: current ? { name: current.assignee, userId: current.assigneeId } : null,
    eligible,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const role = (session.user.role || '') as string
  if (role !== 'PARTNER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const weekStart = weekStartISO()
  const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId.trim() : ''

  // Leegmaken
  if (!assigneeId) {
    await prisma.infoboxWeek.deleteMany({ where: { weekStart } })
    return NextResponse.json({ weekStart, assignee: null })
  }

  // Alleen toegestane personen (partners + Hanna)
  const eligible = await eligiblePeople()
  const person = eligible.find(p => p.id === assigneeId)
  if (!person) return NextResponse.json({ error: 'Ongeldige keuze' }, { status: 400 })

  const saved = await prisma.infoboxWeek.upsert({
    where: { weekStart },
    update: { assignee: person.name, assigneeId: person.id, updatedById: session.user.id },
    create: { weekStart, assignee: person.name, assigneeId: person.id, updatedById: session.user.id },
  })

  return NextResponse.json({ weekStart, assignee: { name: saved.assignee, userId: saved.assigneeId } })
}
