// Eigen ontwikkelplan voor het opgegeven jaar (default huidig jaar).
// Maakt een leeg plan aan als er nog geen is — zo kan de pagina direct
// items toevoegen zonder eerst een admin nodig te hebben.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
  const all = searchParams.get('all') === 'true'

  try {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true },
    })
    if (!me) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

    // Alle eigen plannen — voor de rode-draad-view
    if (all) {
      const plans = await prisma.developmentPlan.findMany({
        where: { userId: me.id },
        include: {
          user: { select: { id: true, name: true, role: true } },
          items: { orderBy: [{ category: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] },
          evaluations: { orderBy: { evaluatedAt: 'desc' } },
        },
        orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
      })
      return NextResponse.json(plans)
    }

    let plan = await prisma.developmentPlan.findFirst({
      where: { userId: me.id, year },
      include: {
        user: { select: { id: true, name: true, role: true } },
        items: { orderBy: [{ category: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] },
        evaluations: { orderBy: { evaluatedAt: 'desc' } },
      },
    })

    if (!plan) {
      plan = await prisma.developmentPlan.create({
        data: {
          userId: me.id,
          employeeName: me.name,
          period: `${year}`,
          year,
          sections: '[]',
          status: 'actief',
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          items: true,
          evaluations: true,
        },
      })
    }

    return NextResponse.json(plan)
  } catch (err) {
    console.error('development-plans/me GET failed', err)
    return NextResponse.json({ error: 'Kon plan niet ophalen' }, { status: 500 })
  }
}
