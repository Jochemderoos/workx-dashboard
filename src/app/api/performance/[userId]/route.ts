// Performance Management — per medewerker.
// GET   → notities van die persoon (nieuwste eerst)
// POST  → nieuwe notitie toevoegen
//
// Toegang: PARTNER + ADMIN. Hanna (ADMIN) kan haar EIGEN pagina niet openen.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canAccess(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN'
}

function isForbiddenTarget(session: { user: { id: string; role: string } }, targetUserId: string): boolean {
  // Hanna (ADMIN) mag haar eigen pagina niet zien.
  return session.user.role === 'ADMIN' && targetUserId === session.user.id
}

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  if (isForbiddenTarget(session as any, params.userId)) {
    return NextResponse.json({ error: 'Geen toegang tot deze pagina' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, role: true, startDate: true },
    })
    if (!user) return NextResponse.json({ error: 'Medewerker niet gevonden' }, { status: 404 })

    const notes = await prisma.performanceNote.findMany({
      where: { userId: params.userId },
      orderBy: { noteDate: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ user, notes })
  } catch (error) {
    console.error('Error loading performance notes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  if (isForbiddenTarget(session as any, params.userId)) {
    return NextResponse.json({ error: 'Geen toegang tot deze pagina' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Notitie mag niet leeg zijn' }, { status: 400 })
    }
    const sentiment = body.sentiment === 'POSITIVE' || body.sentiment === 'NEGATIVE'
      ? body.sentiment
      : 'POSITIVE'
    let noteDate: Date = new Date()
    if (body.noteDate) {
      const d = new Date(body.noteDate)
      if (!isNaN(d.getTime())) noteDate = d
    }

    const note = await prisma.performanceNote.create({
      data: {
        userId: params.userId,
        authorId: session.user.id,
        noteDate,
        sentiment,
        content,
        discussed: false,
      },
      include: { author: { select: { id: true, name: true } } },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating performance note:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
