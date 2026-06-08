// Evaluaties toevoegen aan een jaarplan — alleen PARTNER/ADMIN/OFFICE_MANAGER.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  })
  const allowed = me?.role === 'PARTNER' || me?.role === 'ADMIN' || me?.role === 'OFFICE_MANAGER'
  if (!allowed) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.planId || !body.notes?.trim()) {
      return NextResponse.json({ error: 'planId en notes verplicht' }, { status: 400 })
    }
    const evaluation = await prisma.yearPlanEvaluation.create({
      data: {
        planId: body.planId,
        evaluatorId: session.user.id,
        evaluatorName: me?.name || 'Onbekend',
        notes: body.notes.trim(),
      },
    })
    return NextResponse.json(evaluation)
  } catch (err) {
    console.error('year-plan evaluation POST failed', err)
    return NextResponse.json({ error: 'Kon evaluatie niet toevoegen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  try {
    const existing = await prisma.yearPlanEvaluation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    // Alleen de evaluator zelf mag z'n eigen evaluatie verwijderen
    if (existing.evaluatorId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
    await prisma.yearPlanEvaluation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('year-plan evaluation DELETE failed', err)
    return NextResponse.json({ error: 'Kon evaluatie niet verwijderen' }, { status: 500 })
  }
}
