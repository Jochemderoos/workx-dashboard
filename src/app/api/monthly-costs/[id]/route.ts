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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: { amount?: number; description?: string } = {}
    if (body.amount !== undefined) data.amount = Number(body.amount)
    if (body.description !== undefined) data.description = String(body.description).trim()
    const updated = await prisma.monthlyCost.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating monthly cost:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    await prisma.monthlyCost.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting monthly cost:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
