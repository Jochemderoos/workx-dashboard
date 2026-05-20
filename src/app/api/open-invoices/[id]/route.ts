import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - update reminder of primaryUserId
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json()
    const data: { reminderSentAt?: Date | null; primaryUserId?: string | null } = {}
    if (body.action === 'mark-reminded') data.reminderSentAt = new Date()
    if (body.action === 'reset-reminder') data.reminderSentAt = null
    if (body.primaryUserId !== undefined) data.primaryUserId = body.primaryUserId || null
    const updated = await prisma.openInvoice.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating open invoice:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - factuur weghalen (bv handmatig betaald)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  try {
    await prisma.openInvoice.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting open invoice:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
