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

// POST - bulk-import van kostenposten uit MT940 preview
// body: { items: [{ year, month, amount, description, externalRef }] }
export async function POST(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    const { items } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Geen items ontvangen' }, { status: 400 })
    }

    // Filter dubbele externalRefs en check bestaande records
    const refs: string[] = items
      .map((i: { externalRef?: string }) => i.externalRef)
      .filter((r: string | undefined): r is string => typeof r === 'string' && r.length > 0)
    const existing = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const dupSet = new Set(existing.map(r => r.externalRef).filter(Boolean))

    let added = 0
    let skipped = 0

    // Per maand sortOrder bijhouden
    const sortByMonth: Record<string, number> = {}

    for (const it of items as Array<{ year: number; month: number; amount: number; description: string; externalRef?: string; rawKey?: string; category?: string }>) {
      if (it.externalRef && dupSet.has(it.externalRef)) {
        skipped++
        continue
      }
      if (!it.year || !it.month || it.amount == null || !it.description?.trim()) {
        skipped++
        continue
      }
      const key = `${it.year}-${it.month}`
      if (!(key in sortByMonth)) {
        const maxSort = await prisma.monthlyCost.aggregate({
          where: { year: it.year, month: it.month },
          _max: { sortOrder: true },
        })
        sortByMonth[key] = (maxSort._max.sortOrder ?? -1) + 1
      }
      await prisma.monthlyCost.create({
        data: {
          year: Number(it.year),
          month: Number(it.month),
          amount: Number(it.amount),
          description: String(it.description).trim(),
          category: it.category || null,
          externalRef: it.externalRef || null,
          rawKey: it.rawKey || null,
          sortOrder: sortByMonth[key]++,
        },
      })
      added++
    }

    return NextResponse.json({ added, skipped })
  } catch (error) {
    console.error('Error bulk-importing monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
