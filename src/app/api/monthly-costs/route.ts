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

// GET ?year=2026 - alle kostenposten voor jaar
export async function GET(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
    const costs = await prisma.monthlyCost.findMany({
      where: { year },
      orderBy: [{ month: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(costs)
  } catch (error) {
    console.error('Error fetching monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - nieuwe kostenpost
export async function POST(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    const { year, month, amount, description } = await req.json()
    if (!year || !month || amount == null || !description?.trim()) {
      return NextResponse.json({ error: 'year, month, amount en description zijn verplicht' }, { status: 400 })
    }
    const maxSort = await prisma.monthlyCost.aggregate({ where: { year, month }, _max: { sortOrder: true } })
    const created = await prisma.monthlyCost.create({
      data: {
        year: Number(year),
        month: Number(month),
        amount: Number(amount),
        description: String(description).trim(),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating monthly cost:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
