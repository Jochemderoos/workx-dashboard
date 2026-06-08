// Markeer ontwikkelplan als besproken — alleen PARTNER/ADMIN/OFFICE_MANAGER.
// Verwijdert daarna de bespreek-widget van het partner-dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isManagerRole(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!isManagerRole(me?.role)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const plan = await prisma.developmentPlan.findUnique({
      where: { id: params.id },
      select: { id: true, submittedForReviewAt: true },
    })
    if (!plan) return NextResponse.json({ error: 'Plan niet gevonden' }, { status: 404 })
    if (!plan.submittedForReviewAt) {
      return NextResponse.json({ error: 'Plan is nog niet ingeleverd' }, { status: 400 })
    }

    const updated = await prisma.developmentPlan.update({
      where: { id: params.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    })
    return NextResponse.json({ ok: true, plan: updated })
  } catch (err) {
    console.error('development-plan mark-reviewed failed', err)
    return NextResponse.json({ error: 'Kon plan niet markeren' }, { status: 500 })
  }
}
