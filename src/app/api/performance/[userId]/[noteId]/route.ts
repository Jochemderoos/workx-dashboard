// Performance Management — notitie bewerken/verwijderen.
// PATCH  → content, sentiment, noteDate, discussed
// DELETE → notitie verwijderen
//
// Toegang: PARTNER + ADMIN. Hanna (ADMIN) niet voor haar eigen pagina.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canAccess(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN'
}

function isForbiddenTarget(session: { user: { id: string; role: string } }, targetUserId: string): boolean {
  return session.user.role === 'ADMIN' && targetUserId === session.user.id
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string; noteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  if (isForbiddenTarget(session as any, params.userId)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const note = await prisma.performanceNote.findUnique({ where: { id: params.noteId } })
    if (!note || note.userId !== params.userId) {
      return NextResponse.json({ error: 'Notitie niet gevonden' }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof body.content === 'string') {
      const trimmed = body.content.trim()
      if (!trimmed) return NextResponse.json({ error: 'Notitie mag niet leeg zijn' }, { status: 400 })
      data.content = trimmed
    }
    if (body.sentiment === 'POSITIVE' || body.sentiment === 'NEGATIVE') {
      data.sentiment = body.sentiment
    }
    if (body.noteDate) {
      const d = new Date(body.noteDate)
      if (!isNaN(d.getTime())) data.noteDate = d
    }
    if (typeof body.discussed === 'boolean') {
      data.discussed = body.discussed
      data.discussedAt = body.discussed ? new Date() : null
    }

    const updated = await prisma.performanceNote.update({
      where: { id: params.noteId },
      data,
      include: { author: { select: { id: true, name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating performance note:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string; noteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  if (isForbiddenTarget(session as any, params.userId)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const note = await prisma.performanceNote.findUnique({ where: { id: params.noteId } })
    if (!note || note.userId !== params.userId) {
      return NextResponse.json({ error: 'Notitie niet gevonden' }, { status: 404 })
    }

    await prisma.performanceNote.delete({ where: { id: params.noteId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting performance note:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
