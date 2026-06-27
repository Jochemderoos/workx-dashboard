// Alle week-intakes voor een specifieke target-week (partners + admin).
// GET ?weekStartDate=YYYY-MM-DD → list

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toDateOnly } from '@/lib/week-intake'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const param = url.searchParams.get('weekStartDate')
    if (!param) {
      return NextResponse.json({ error: 'weekStartDate verplicht (YYYY-MM-DD)' }, { status: 400 })
    }
    const d = new Date(param)
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
    }
    const dateOnly = toDateOnly(d)

    // Lijsten die echt voor deze week zijn ingevuld/bijgewerkt.
    const current = await prisma.weekIntake.findMany({
      where: { weekStartDate: dateOnly },
      include: { user: { select: { id: true, name: true } } },
    })
    const currentUserIds = current.map(i => i.userId)

    // Voor medewerkers zonder lijst voor deze week: val terug op hun meest
    // recente eerdere lijst, gemarkeerd als 'niet bijgewerkt deze week'.
    const previous = await prisma.weekIntake.findMany({
      where: {
        weekStartDate: { lt: dateOnly },
        ...(currentUserIds.length ? { userId: { notIn: currentUserIds } } : {}),
      },
      orderBy: { weekStartDate: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    })
    const seen = new Set<string>()
    const latestPrev = previous.filter(p => {
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })

    const intakes = [
      ...current.map(i => ({ ...i, isCurrent: true })),
      ...latestPrev.map(i => ({ ...i, isCurrent: false })),
    ]

    return NextResponse.json({ intakes })
  } catch (error) {
    console.error('Error loading week intakes by week:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
