// CRUD voor items binnen een ontwikkelplan.
// Werknemers mogen items van hun eigen plan beheren; PARTNER/ADMIN/OFFICE_MANAGER
// mogen items van iedereen beheren (incl. evaluation-veld invullen).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CATEGORIES = ['inhoud-theorie', 'inhoud-praktijk', 'eigen-praktijk', 'intern'] as const
type Category = typeof CATEGORIES[number]

async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  })
}

function isManagerRole(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

async function canEditPlan(meId: string, role: string | null | undefined, planId: string) {
  const plan = await prisma.developmentPlan.findUnique({
    where: { id: planId },
    select: { userId: true },
  })
  if (!plan) return { ok: false as const, reason: 'notfound' }
  if (isManagerRole(role)) return { ok: true as const, plan }
  if (plan.userId === meId) return { ok: true as const, plan }
  return { ok: false as const, reason: 'forbidden' }
}

async function getOrCreateOwnPlan(userId: string, name: string, year: number) {
  // Probeer een bestaand plan voor dit jaar te vinden (1 per user/year)
  const existing = await prisma.developmentPlan.findFirst({
    where: { userId, year },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing
  return prisma.developmentPlan.create({
    data: {
      userId,
      employeeName: name,
      period: `${year}`,
      year,
      sections: '[]',
      status: 'actief',
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const me = await getMe(session.user.id)
  if (!me) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    if (!CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Onbekende categorie' }, { status: 400 })
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })
    }

    let planId: string | null = body.planId || null
    if (!planId) {
      const year = body.year || new Date().getFullYear()
      const plan = await getOrCreateOwnPlan(me.id, me.name, year)
      planId = plan.id
    } else {
      const check = await canEditPlan(me.id, me.role, planId)
      if (!check.ok) {
        return NextResponse.json({ error: check.reason === 'notfound' ? 'Plan niet gevonden' : 'Geen toegang' }, { status: check.reason === 'notfound' ? 404 : 403 })
      }
    }

    // Volgende position binnen categorie
    const last = await prisma.developmentPlanItem.findFirst({
      where: { planId, category: body.category as Category },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const item = await prisma.developmentPlanItem.create({
      data: {
        planId,
        category: body.category,
        title: body.title.trim(),
        goals: body.goals?.trim() || null,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    })
    return NextResponse.json(item)
  } catch (err) {
    console.error('development-plan item POST failed', err)
    return NextResponse.json({ error: 'Kon item niet aanmaken' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const me = await getMe(session.user.id)
  if (!me) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

    const existing = await prisma.developmentPlanItem.findUnique({
      where: { id: body.id },
      include: { plan: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const owns = existing.plan.userId === me.id
    const isManager = isManagerRole(me.role)
    if (!owns && !isManager) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

    // "evaluation" is de zelfevaluatie van de medewerker; de partner heeft een
    // eigen veld. Alleen een manager-rol mag daarin schrijven, en we leggen
    // vast wie het schreef zodat de herkomst zichtbaar blijft.
    if (body.partnerEvaluation !== undefined && !isManager) {
      return NextResponse.json({ error: 'Alleen partners kunnen partner-input invullen' }, { status: 403 })
    }
    const partnerTekst = body.partnerEvaluation?.trim() || null

    const status = body.status as 'todo' | 'doing' | 'done' | undefined
    const progress = typeof body.progress === 'number' ? Math.max(0, Math.min(100, Math.round(body.progress))) : undefined

    const updated = await prisma.developmentPlanItem.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.goals !== undefined && { goals: body.goals?.trim() || null }),
        ...(body.evaluation !== undefined && { evaluation: body.evaluation?.trim() || null }),
        ...(body.partnerEvaluation !== undefined && {
          partnerEvaluation: partnerTekst,
          // Naam en datum alleen bijhouden zolang er tekst staat; leeggemaakt
          // veld laat geen spookondertekening achter.
          partnerEvaluationBy: partnerTekst ? me.name : null,
          partnerEvaluationAt: partnerTekst ? new Date() : null,
        }),
        ...(status && { status }),
        ...(progress !== undefined && { progress }),
        ...(body.targetDate !== undefined && { targetDate: body.targetDate ? new Date(body.targetDate) : null }),
        ...(body.category !== undefined && CATEGORIES.includes(body.category) && { category: body.category }),
        ...(status === 'done' && !existing.completedAt && { completedAt: new Date(), progress: 100 }),
        ...(status && status !== 'done' && existing.completedAt && { completedAt: null }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('development-plan item PATCH failed', err)
    return NextResponse.json({ error: 'Kon item niet bijwerken' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const me = await getMe(session.user.id)
  if (!me) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  try {
    const existing = await prisma.developmentPlanItem.findUnique({
      where: { id },
      include: { plan: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const owns = existing.plan.userId === me.id
    const isManager = isManagerRole(me.role)
    if (!owns && !isManager) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

    await prisma.developmentPlanItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('development-plan item DELETE failed', err)
    return NextResponse.json({ error: 'Kon item niet verwijderen' }, { status: 500 })
  }
}
