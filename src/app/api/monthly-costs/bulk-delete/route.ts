// Bulk-verwijderen van kostenposten (bv. om duplicaten op te schonen).
// body: { ids: string[] }

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
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Geen ids meegegeven' }, { status: 400 })
    }
    const result = await prisma.monthlyCost.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Error bulk-deleting costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
