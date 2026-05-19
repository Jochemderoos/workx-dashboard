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

// Synchroniseer de gepubliceerde Responsibility met de PartnerTask:
// - isPublic true + responsibleId aanwezig → Responsibility upsert
// - isPublic false → Responsibility verwijderen
async function syncPublication(taskId: string) {
  const task = await prisma.partnerTask.findUnique({
    where: { id: taskId },
    include: { chapter: { select: { name: true } } },
  })
  if (!task) return

  const taskLabel = `${task.chapter.name} — ${task.task}`

  if (task.isPublic && task.responsibleId) {
    const existing = await prisma.responsibility.findUnique({ where: { partnerTaskId: task.id } })
    if (existing) {
      await prisma.responsibility.update({
        where: { id: existing.id },
        data: { task: taskLabel, responsibleId: task.responsibleId },
      })
    } else {
      const maxSort = await prisma.responsibility.aggregate({ _max: { sortOrder: true } })
      await prisma.responsibility.create({
        data: {
          task: taskLabel,
          responsibleId: task.responsibleId,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          partnerTaskId: task.id,
        },
      })
    }
  } else {
    // Niet gepubliceerd of geen verantwoordelijke → verwijder eventuele bestaande link
    await prisma.responsibility.deleteMany({ where: { partnerTaskId: task.id } })
  }
}

// PATCH - taak bijwerken (task, responsibleId, isPublic, sortOrder)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: { task?: string; responsibleId?: string | null; isPublic?: boolean; sortOrder?: number } = {}
    if (body.task !== undefined) data.task = body.task
    if (body.responsibleId !== undefined) data.responsibleId = body.responsibleId || null
    if (body.isPublic !== undefined) data.isPublic = !!body.isPublic
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

    const updated = await prisma.partnerTask.update({
      where: { id: params.id },
      data,
      include: { responsible: { select: { id: true, name: true, avatarUrl: true } } },
    })

    await syncPublication(params.id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating partner task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - taak verwijderen (cascade verwijdert ook gekoppelde Responsibility)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    // Verwijder eerst eventuele Responsibility-link (anders blijft die met partnerTaskId=null staan)
    await prisma.responsibility.deleteMany({ where: { partnerTaskId: params.id } })
    await prisma.partnerTask.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting partner task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
