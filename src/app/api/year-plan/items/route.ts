// CRUD voor items binnen het eigen jaarplan.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CATEGORIES = ['theorie', 'praktijk', 'acquisitie', 'intern'] as const

async function getOwnPlan(userId: string, year: number) {
  return prisma.yearPlan.upsert({
    where: { userId_year: { userId, year } },
    update: {},
    create: { userId, year },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json()
    if (!CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Onbekende categorie' }, { status: 400 })
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })
    }
    const year = body.year || new Date().getFullYear()
    const plan = await getOwnPlan(session.user.id, year)

    // Volgende position binnen categorie
    const last = await prisma.yearPlanItem.findFirst({
      where: { planId: plan.id, category: body.category },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const item = await prisma.yearPlanItem.create({
      data: {
        planId: plan.id,
        category: body.category,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    })
    return NextResponse.json(item)
  } catch (err) {
    console.error('year-plan item POST failed', err)
    return NextResponse.json({ error: 'Kon item niet aanmaken' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

    // Owner-check: item moet bij eigen plan horen
    const existing = await prisma.yearPlanItem.findUnique({
      where: { id: body.id },
      include: { plan: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    if (existing.plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const status = body.status as 'todo' | 'doing' | 'done' | undefined
    const progress = typeof body.progress === 'number' ? Math.max(0, Math.min(100, Math.round(body.progress))) : undefined

    const updated = await prisma.yearPlanItem.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(status && { status }),
        ...(progress !== undefined && { progress }),
        ...(body.targetDate !== undefined && { targetDate: body.targetDate ? new Date(body.targetDate) : null }),
        ...(status === 'done' && !existing.completedAt && { completedAt: new Date(), progress: 100 }),
        ...(status && status !== 'done' && existing.completedAt && { completedAt: null }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('year-plan item PATCH failed', err)
    return NextResponse.json({ error: 'Kon item niet bijwerken' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  try {
    const existing = await prisma.yearPlanItem.findUnique({
      where: { id },
      include: { plan: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    if (existing.plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
    await prisma.yearPlanItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('year-plan item DELETE failed', err)
    return NextResponse.json({ error: 'Kon item niet verwijderen' }, { status: 500 })
  }
}
