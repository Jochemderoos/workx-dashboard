import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requirePartnerOrAdmin() {
  // Onboarding open voor iedereen ingelogd.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  return { session }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.role !== undefined) data.role = body.role ? String(body.role).trim() : null
    if (body.isArchived !== undefined) data.isArchived = !!body.isArchived
    const updated = await prisma.onboardingEmployee.update({
      where: { id: params.id },
      data,
      include: { items: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] } },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating onboarding employee:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    await prisma.onboardingEmployee.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting onboarding employee:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
