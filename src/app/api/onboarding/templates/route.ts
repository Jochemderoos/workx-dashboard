import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requirePartnerOrAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const templates = await prisma.onboardingTemplate.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    if (!body.title?.trim() || !body.category?.trim()) {
      return NextResponse.json({ error: 'Title en category zijn verplicht' }, { status: 400 })
    }
    const max = await prisma.onboardingTemplate.aggregate({
      _max: { sortOrder: true },
      where: { category: body.category },
    })
    const tpl = await prisma.onboardingTemplate.create({
      data: {
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        category: String(body.category).trim(),
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(tpl, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
