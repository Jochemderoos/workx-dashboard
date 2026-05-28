// Coaching-budget per medewerker.
// GET  → eigen record (auto-create bij eerste call met periodStart = vandaag of hire-datum)
// PATCH → update usedAmount / notes / periodStart (reset bij nieuwe 3-jaars periode)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BUDGET_TOTAL_EX_BTW = 1500 // € per 3-jaars periode (Way it Workx 5.1)
const PERIOD_YEARS = 3

async function getOrCreate(userId: string) {
  let record = await prisma.coachingBudget.findUnique({ where: { userId } })
  if (!record) {
    record = await prisma.coachingBudget.create({
      data: { userId, periodStart: new Date(), usedAmount: 0 },
    })
  }
  return record
}

function periodEnd(start: Date): Date {
  const d = new Date(start)
  d.setFullYear(d.getFullYear() + PERIOD_YEARS)
  return d
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  try {
    const record = await getOrCreate(session.user.id)
    return NextResponse.json({
      ...record,
      totalBudget: BUDGET_TOTAL_EX_BTW,
      remaining: Math.max(0, BUDGET_TOTAL_EX_BTW - record.usedAmount),
      periodEnd: periodEnd(record.periodStart).toISOString(),
    })
  } catch (error) {
    console.error('Error loading coaching budget:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body.usedAmount === 'number' && body.usedAmount >= 0) {
      data.usedAmount = body.usedAmount
    }
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes) : null
    }
    if (body.periodStart) {
      const d = new Date(body.periodStart)
      if (!isNaN(d.getTime())) data.periodStart = d
    }
    if (body.resetPeriod === true) {
      // Nieuwe 3-jaars periode starten — usedAmount op 0
      data.periodStart = new Date()
      data.usedAmount = 0
      data.notes = null
    }
    await getOrCreate(session.user.id)
    const updated = await prisma.coachingBudget.update({
      where: { userId: session.user.id },
      data,
    })
    return NextResponse.json({
      ...updated,
      totalBudget: BUDGET_TOTAL_EX_BTW,
      remaining: Math.max(0, BUDGET_TOTAL_EX_BTW - updated.usedAmount),
      periodEnd: periodEnd(updated.periodStart).toISOString(),
    })
  } catch (error) {
    console.error('Error updating coaching budget:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
