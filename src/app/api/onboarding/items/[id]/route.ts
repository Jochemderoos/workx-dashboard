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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
    if (body.category !== undefined) data.category = String(body.category).trim()
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null
    if (body.isCompleted !== undefined) {
      data.isCompleted = !!body.isCompleted
      if (body.isCompleted) {
        data.completedAt = new Date()
        data.completedBy = guard.session?.user?.id || null
      } else {
        data.completedAt = null
        data.completedBy = null
      }
    }
    const updated = await prisma.onboardingItem.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating onboarding item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    await prisma.onboardingItem.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting onboarding item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
