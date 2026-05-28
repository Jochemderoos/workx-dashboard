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

// GET — alle medewerkers (niet gearchiveerd) + voortgang per medewerker
export async function GET(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const url = new URL(req.url)
    const includeArchived = url.searchParams.get('includeArchived') === '1'
    const employees = await prisma.onboardingEmployee.findMany({
      where: includeArchived ? {} : { isArchived: false },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error fetching onboarding employees:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — nieuwe medewerker aanmaken + automatisch alle actieve templates kopiëren
export async function POST(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    const employee = await prisma.onboardingEmployee.create({
      data: {
        name: String(body.name).trim(),
        email: body.email ? String(body.email).trim() : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        role: body.role ? String(body.role).trim() : null,
      },
    })

    // Kopieer alle actieve templates als items
    const templates = await prisma.onboardingTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    if (templates.length > 0) {
      await prisma.onboardingItem.createMany({
        data: templates.map(t => ({
          employeeId: employee.id,
          templateId: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          sortOrder: t.sortOrder,
        })),
      })
    }

    const created = await prisma.onboardingEmployee.findUnique({
      where: { id: employee.id },
      include: {
        items: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] },
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating onboarding employee:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
