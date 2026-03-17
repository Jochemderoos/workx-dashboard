import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const tasks = await prisma.werkstudentTask.findMany({
    orderBy: [
      { status: 'asc' }, // open/bezig first, klaar last
      { priority: 'asc' },
      { deadline: 'asc' },
    ],
    include: {
      assigner: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { title, description, deadline, priority, assignerId } = await req.json()
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
  }

  const task = await prisma.werkstudentTask.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || 'normaal',
      assignedBy: assignerId || session.user.id,
    },
    include: {
      assigner: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(task, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { id, title, description, deadline, priority, status, assignerId } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updateData.title = title.trim()
  if (description !== undefined) updateData.description = description?.trim() || null
  if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null
  if (priority !== undefined) updateData.priority = priority
  if (status !== undefined) {
    updateData.status = status
    if (status === 'klaar') updateData.completedAt = new Date()
    else updateData.completedAt = null
  }
  if (assignerId) updateData.assignedBy = assignerId

  const task = await prisma.werkstudentTask.update({
    where: { id },
    data: updateData,
    include: {
      assigner: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  await prisma.werkstudentTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
