// Tijdelijk debug-endpoint: laat zien wat er in de DB staat voor de huidige
// gebruiker. Helpt verifiëren waarom een lijst leeg is.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const userId = session.user.id

  const [totalCount, ownCount, legacyCount, all] = await Promise.all([
    prisma.transitieCalculation.count(),
    prisma.transitieCalculation.count({ where: { userId } }),
    prisma.transitieCalculation.count({ where: { userId: null } }),
    prisma.transitieCalculation.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, userId: true, employeeName: true, employerName: true, amount: true, createdAt: true, hiddenFor: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const hiddenForMe = all.filter(c => {
    if (!c.hiddenFor) return false
    try { return JSON.parse(c.hiddenFor).includes(userId) } catch { return false }
  }).length

  return NextResponse.json({
    you: { id: userId, email: session.user.email, name: session.user.name },
    counts: {
      totalInDb: totalCount,
      yoursWithUserId: ownCount,
      legacyNoUserId: legacyCount,
      hiddenByYou: hiddenForMe,
      visibleToYou: all.length - hiddenForMe,
    },
    sample: all.slice(0, 20).map(c => ({
      id: c.id,
      isYours: c.userId === userId,
      isLegacy: c.userId === null,
      employee: c.employeeName,
      employer: c.employerName,
      amount: c.amount,
      createdAt: c.createdAt,
      hiddenForYou: c.hiddenFor ? (() => {
        try { return JSON.parse(c.hiddenFor).includes(userId) } catch { return false }
      })() : false,
    })),
  })
}
