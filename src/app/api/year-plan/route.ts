// Eigen jaarplan ophalen / aanmaken.
// GET → eigen plan voor opgegeven jaar (default huidig jaar) incl. items en evaluaties

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)

  try {
    let plan = await prisma.yearPlan.findUnique({
      where: { userId_year: { userId: session.user.id, year } },
      include: {
        items: { orderBy: [{ category: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] },
        evaluations: { orderBy: { evaluatedAt: 'desc' } },
      },
    })
    if (!plan) {
      plan = await prisma.yearPlan.create({
        data: { userId: session.user.id, year },
        include: { items: true, evaluations: true },
      })
    }
    return NextResponse.json(plan)
  } catch (err) {
    console.error('year-plan GET failed', err)
    return NextResponse.json({ error: 'Kon plan niet ophalen' }, { status: 500 })
  }
}
