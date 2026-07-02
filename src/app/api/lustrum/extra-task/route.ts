// Toewijzing van verantwoordelijke(n) voor een losse organiseer-taak
// (bv. 'spelletjes-weekend'). Alleen PARTNER/ADMIN.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const role = (session.user.role || '') as string
  if (role !== 'PARTNER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  const responsible = Array.isArray(body.responsible) ? body.responsible.filter((n: unknown) => typeof n === 'string') : []
  if (!key) return NextResponse.json({ error: 'key is verplicht' }, { status: 400 })

  const json = JSON.stringify(responsible)
  await prisma.lustrumExtraTask.upsert({
    where: { key },
    update: { responsible: json, updatedById: session.user.id },
    create: { key, responsible: json, updatedById: session.user.id },
  })

  return NextResponse.json({ key, responsible })
}
