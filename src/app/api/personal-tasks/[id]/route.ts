import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ownsTask(id: string, userId: string): Promise<boolean> {
  const t = await prisma.personalTask.findUnique({ where: { id }, select: { userId: true } })
  return !!t && t.userId === userId
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!(await ownsTask(params.id, session.user.id))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const data: { title?: string; description?: string | null; dueDate?: Date | null; sortOrder?: number } = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)
    const updated = await prisma.personalTask.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating personal task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!(await ownsTask(params.id, session.user.id))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  try {
    await prisma.personalTask.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting personal task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
