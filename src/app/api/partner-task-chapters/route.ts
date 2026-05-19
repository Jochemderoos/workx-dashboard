import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requirePartnerOrAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session, user }
}

// POST - nieuw hoofdstuk toevoegen
export async function POST(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })
    const maxSort = await prisma.partnerTaskChapter.aggregate({ _max: { sortOrder: true } })
    const created = await prisma.partnerTaskChapter.create({
      data: { name: name.trim(), sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
    })
    return NextResponse.json({ ...created, tasks: [] })
  } catch (error) {
    console.error('Error creating chapter:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
