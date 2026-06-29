// Admin-only endpoint om legacy transitie-records (userId=null) toe te wijzen
// aan een eigenaar. POST body:
//   { matches: [{ employerPattern: 'Epex', userName: 'Juliette' }, ...] }
//
// employerPattern: substring (case-insensitive) op employerName
// userName: substring (case-insensitive) op user.name — eerste actieve match wint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'PARTNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const matches: { employerPattern: string; userName: string }[] = body.matches || []
    if (matches.length === 0) {
      return NextResponse.json({ error: 'Geen matches opgegeven' }, { status: 400 })
    }

    const results: { employerPattern: string; userName: string; matchedUser?: string; updatedCount: number; error?: string }[] = []

    for (const m of matches) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, name: { contains: m.userName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!user) {
        results.push({ ...m, updatedCount: 0, error: `Geen actieve user met naam "${m.userName}"` })
        continue
      }

      const update = await prisma.transitieCalculation.updateMany({
        where: {
          userId: null,
          employerName: { contains: m.employerPattern, mode: 'insensitive' },
        },
        data: { userId: user.id },
      })

      results.push({
        ...m,
        matchedUser: user.name,
        updatedCount: update.count,
      })
    }

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error('[transitie/claim-legacy] mislukt:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
