// Eenmalige fix: alle rijen met 'waarborgsom', 'borgsom', 'deposito' of
// 'vooruitbetaling' in de description krijgen category=BALANS.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const candidates = await prisma.monthlyCost.findMany({
      where: {
        category: { not: 'BALANS' },
        OR: [
          { description: { contains: 'waarborgsom', mode: 'insensitive' } },
          { description: { contains: 'borgsom', mode: 'insensitive' } },
          { description: { contains: 'deposito', mode: 'insensitive' } },
          { description: { contains: 'vooruitbetaling', mode: 'insensitive' } },
        ],
      },
      select: { id: true, description: true, year: true, month: true, amount: true },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ updated: 0, items: [] })
    }

    await prisma.monthlyCost.updateMany({
      where: { id: { in: candidates.map(c => c.id) } },
      data: { category: 'BALANS' },
    })

    return NextResponse.json({
      updated: candidates.length,
      items: candidates,
    })
  } catch (error) {
    console.error('Error fixing balansposten:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
