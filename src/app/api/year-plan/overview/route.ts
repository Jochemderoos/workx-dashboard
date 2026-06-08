// Overview van alle jaarplannen voor PARTNER/ADMIN + Hanna (OFFICE_MANAGER).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const allowed = me?.role === 'PARTNER' || me?.role === 'ADMIN' || me?.role === 'OFFICE_MANAGER'
  if (!allowed) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)

  try {
    const plans = await prisma.yearPlan.findMany({
      where: { year },
      include: {
        items: { orderBy: [{ category: 'asc' }, { position: 'asc' }] },
        evaluations: { orderBy: { evaluatedAt: 'desc' } },
      },
    })
    const userIds = plans.map(p => p.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const enriched = plans
      .map(p => ({ ...p, user: userMap.get(p.userId) || null }))
      .filter(p => p.user) // alleen actieve medewerkers
      .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('year-plan overview failed', err)
    return NextResponse.json({ error: 'Kon overzicht niet ophalen' }, { status: 500 })
  }
}
