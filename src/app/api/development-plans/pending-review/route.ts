// Lijst ingeleverde-maar-niet-besproken ontwikkelplannen voor het partner-widget.
// Alleen PARTNER/ADMIN/OFFICE_MANAGER.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isManagerRole(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!isManagerRole(me?.role)) return NextResponse.json([])

  try {
    const plans = await prisma.developmentPlan.findMany({
      where: {
        submittedForReviewAt: { not: null },
        reviewedAt: null,
      },
      select: {
        id: true,
        employeeName: true,
        year: true,
        submittedForReviewAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { items: true } },
      },
      orderBy: { submittedForReviewAt: 'asc' },
    })
    return NextResponse.json(plans)
  } catch (err) {
    console.error('development-plan pending-review failed', err)
    return NextResponse.json({ error: 'Kon overzicht niet ophalen' }, { status: 500 })
  }
}
