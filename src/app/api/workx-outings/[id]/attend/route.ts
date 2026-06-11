// Inschrijven / wijzigen / afmelden voor een uitje.
// POST: in/misschien (upsert eigen attendance)
// DELETE: afmelden (verwijder eigen attendance)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_RESPONSES = ['in', 'misschien'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const response = VALID_RESPONSES.includes(body.response) ? body.response : 'in'
    const plusOnes = typeof body.plusOnes === 'number' ? Math.max(0, Math.min(10, Math.round(body.plusOnes))) : 0
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null

    const outing = await prisma.workxOuting.findUnique({ where: { id: params.id } })
    if (!outing) return NextResponse.json({ error: 'Uitje niet gevonden' }, { status: 404 })

    const attendance = await prisma.workxOutingAttendance.upsert({
      where: { outingId_userId: { outingId: params.id, userId: session.user.id } },
      update: { response, plusOnes, note },
      create: { outingId: params.id, userId: session.user.id, response, plusOnes, note },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    return NextResponse.json(attendance)
  } catch (err) {
    console.error('workx-outings/attend POST failed', err)
    return NextResponse.json({ error: 'Kon inschrijving niet opslaan' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    await prisma.workxOutingAttendance.deleteMany({
      where: { outingId: params.id, userId: session.user.id },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('workx-outings/attend DELETE failed', err)
    return NextResponse.json({ error: 'Kon afmelden niet opslaan' }, { status: 500 })
  }
}
