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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const { name, sortOrder } = await req.json()
    const updated = await prisma.partnerTaskChapter.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating chapter:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    // Verwijder gepubliceerde Responsibility-links voordat het hoofdstuk weggaat
    const tasks = await prisma.partnerTask.findMany({ where: { chapterId: params.id }, select: { id: true } })
    if (tasks.length > 0) {
      await prisma.responsibility.deleteMany({ where: { partnerTaskId: { in: tasks.map(t => t.id) } } })
    }
    await prisma.partnerTaskChapter.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chapter:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
