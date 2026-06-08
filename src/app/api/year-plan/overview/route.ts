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
    // Alle actieve teamleden (advocaten + partners + office), excl. ADMIN-only
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['EMPLOYEE', 'PARTNER', 'OFFICE_MANAGER'] },
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' },
    })

    const plans = await prisma.yearPlan.findMany({
      where: { year },
      include: {
        items: { orderBy: [{ category: 'asc' }, { position: 'asc' }] },
        evaluations: { orderBy: { evaluatedAt: 'desc' } },
      },
    })
    const planByUser = new Map(plans.map(p => [p.userId, p]))

    const enriched = users.map(u => ({
      user: u,
      plan: planByUser.get(u.id) || null,
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('year-plan overview failed', err)
    return NextResponse.json({ error: 'Kon overzicht niet ophalen' }, { status: 500 })
  }
}
