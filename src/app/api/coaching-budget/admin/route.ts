// Coaching-budget beheer voor PARTNER/ADMIN.
// GET   → alle actieve medewerkers + bestaand CoachingBudget record (indien aanwezig).
// PATCH → upsert voor specifieke userId (usedAmount, notes, periodStart).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BUDGET_TOTAL_EX_BTW = 1500
const PERIOD_YEARS = 3

function periodEnd(start: Date): Date {
  const d = new Date(start)
  d.setFullYear(d.getFullYear() + PERIOD_YEARS)
  return d
}

function hasAccess(role?: string | null): boolean {
  return role === 'ADMIN'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!hasAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['EMPLOYEE', 'PARTNER', 'ADMIN'] } },
      select: { id: true, name: true, role: true, startDate: true },
      orderBy: { name: 'asc' },
    })

    const budgets = await prisma.coachingBudget.findMany()
    const byUser = new Map(budgets.map(b => [b.userId, b]))

    const rows = users.map(u => {
      const b = byUser.get(u.id)
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        startDate: u.startDate?.toISOString() ?? null,
        usedAmount: b?.usedAmount ?? 0,
        notes: b?.notes ?? '',
        periodStart: b?.periodStart?.toISOString() ?? null,
        periodEnd: b ? periodEnd(b.periodStart).toISOString() : null,
        totalBudget: BUDGET_TOTAL_EX_BTW,
        remaining: BUDGET_TOTAL_EX_BTW - (b?.usedAmount ?? 0),
        hasRecord: !!b,
      }
    })

    return NextResponse.json({ budgets: rows, totalBudget: BUDGET_TOTAL_EX_BTW })
  } catch (error) {
    console.error('Error loading coaching budgets (admin):', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!hasAccess(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const userId = typeof body.userId === 'string' ? body.userId : null
    if (!userId) {
      return NextResponse.json({ error: 'userId is verplicht' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, startDate: true } })
    if (!user) {
      return NextResponse.json({ error: 'Medewerker niet gevonden' }, { status: 404 })
    }

    const usedAmount = typeof body.usedAmount === 'number' && body.usedAmount >= 0
      ? body.usedAmount
      : undefined
    const notes = body.notes === null || body.notes === '' ? null
      : typeof body.notes === 'string' ? body.notes
      : undefined
    let periodStart: Date | undefined
    if (body.periodStart) {
      const d = new Date(body.periodStart)
      if (!isNaN(d.getTime())) periodStart = d
    }

    // Voor nieuwe records: pak hire-date als periodStart, val terug op vandaag.
    const defaultStart = user.startDate ?? new Date()

    const updated = await prisma.coachingBudget.upsert({
      where: { userId },
      create: {
        userId,
        periodStart: periodStart ?? defaultStart,
        usedAmount: usedAmount ?? 0,
        notes: notes ?? null,
      },
      update: {
        ...(usedAmount !== undefined ? { usedAmount } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(periodStart !== undefined ? { periodStart } : {}),
      },
    })

    return NextResponse.json({
      userId: updated.userId,
      usedAmount: updated.usedAmount,
      notes: updated.notes ?? '',
      periodStart: updated.periodStart.toISOString(),
      periodEnd: periodEnd(updated.periodStart).toISOString(),
      totalBudget: BUDGET_TOTAL_EX_BTW,
      remaining: BUDGET_TOTAL_EX_BTW - updated.usedAmount,
      hasRecord: true,
    })
  } catch (error) {
    console.error('Error updating coaching budget (admin):', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
