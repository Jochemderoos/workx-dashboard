// Verwijder alle kostenposten van een specifieke maand.
// body: { year: number, month: number }

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

export async function POST(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error

  try {
    const { year, month } = await req.json()
    if (typeof year !== 'number' || typeof month !== 'number') {
      return NextResponse.json({ error: 'year en month verplicht' }, { status: 400 })
    }
    const result = await prisma.monthlyCost.deleteMany({ where: { year, month } })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Error clearing month:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
