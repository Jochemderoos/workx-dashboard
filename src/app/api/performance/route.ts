// Performance Management overzicht.
// GET → lijst van te beoordelen medewerkers + aggregate counts.
//
// Toegang: PARTNER + ADMIN. Hanna (ADMIN) ziet zichzelf NIET in de lijst.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canAccess(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const isAdmin = session.user.role === 'ADMIN'

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] },
        // Hanna (ADMIN) mag haar eigen pagina niet zien
        ...(isAdmin ? { id: { not: session.user.id } } : {}),
      },
      select: { id: true, name: true, role: true, startDate: true },
      orderBy: { name: 'asc' },
    })

    const userIds = users.map(u => u.id)
    const notes = await prisma.performanceNote.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, sentiment: true, discussed: true, noteDate: true, createdAt: true },
    })

    const stats = new Map<string, {
      total: number
      positive: number
      negative: number
      notDiscussed: number
      lastNoteDate: string | null
    }>()
    for (const id of userIds) stats.set(id, { total: 0, positive: 0, negative: 0, notDiscussed: 0, lastNoteDate: null })
    for (const n of notes) {
      const s = stats.get(n.userId)!
      s.total++
      if (n.sentiment === 'POSITIVE') s.positive++
      else if (n.sentiment === 'NEGATIVE') s.negative++
      if (!n.discussed) s.notDiscussed++
      const ts = n.noteDate.toISOString()
      if (!s.lastNoteDate || ts > s.lastNoteDate) s.lastNoteDate = ts
    }

    const rows = users.map(u => ({
      userId: u.id,
      name: u.name,
      role: u.role,
      ...stats.get(u.id)!,
    }))

    return NextResponse.json({ users: rows })
  } catch (error) {
    console.error('Error loading performance overview:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
