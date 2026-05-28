import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requirePartnerOrAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  return { session }
}

// POST — handmatig item toevoegen aan een medewerker
export async function POST(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    if (!body.employeeId || !body.title?.trim() || !body.category?.trim()) {
      return NextResponse.json({ error: 'employeeId, title en category zijn verplicht' }, { status: 400 })
    }
    const max = await prisma.onboardingItem.aggregate({
      _max: { sortOrder: true },
      where: { employeeId: body.employeeId, category: body.category },
    })
    const item = await prisma.onboardingItem.create({
      data: {
        employeeId: String(body.employeeId),
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        category: String(body.category).trim(),
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating onboarding item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
