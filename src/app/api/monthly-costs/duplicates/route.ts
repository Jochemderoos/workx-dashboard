// Detecteer mogelijke dubbele kostenposten.
// Groepeert op (year, month, abs(amount), description-normalized).
// Returns alle groepen met >= 2 records.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAccess() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

function normalizeDesc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function GET(_req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error

  try {
    const costs = await prisma.monthlyCost.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { sortOrder: 'asc' }],
    })

    // Groepeer per (year, month, abs(amount), normalized description)
    const groups = new Map<string, typeof costs>()
    for (const c of costs) {
      const key = `${c.year}-${c.month}|${Math.abs(c.amount).toFixed(2)}|${normalizeDesc(c.description)}`
      const arr = groups.get(key) || []
      arr.push(c)
      groups.set(key, arr)
    }

    // Filter groepen met >= 2 records
    const duplicates = Array.from(groups.entries())
      .filter(([, items]) => items.length >= 2)
      .map(([key, items]) => ({
        key,
        year: items[0].year,
        month: items[0].month,
        amount: items[0].amount,
        description: items[0].description,
        count: items.length,
        items: items.map(i => ({
          id: i.id,
          amount: i.amount,
          description: i.description,
          category: i.category,
          externalRef: i.externalRef,
          createdAt: i.createdAt,
        })),
      }))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month))

    const totalDuplicateRows = duplicates.reduce((s, g) => s + (g.count - 1), 0)

    return NextResponse.json({ groups: duplicates, totalDuplicateRows })
  } catch (error) {
    console.error('Error finding duplicates:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
