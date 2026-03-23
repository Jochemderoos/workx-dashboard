import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET tasks + werkstudenten
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  // Fetch werkstudenten list
  if (type === 'werkstudenten') {
    const werkstudenten = await prisma.werkstudent.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    })
    return NextResponse.json(werkstudenten)
  }

  // Fetch tasks (optionally filtered by werkstudentId)
  const werkstudentId = searchParams.get('werkstudentId')
  const tasks = await prisma.werkstudentTask.findMany({
    where: werkstudentId ? { werkstudentId } : undefined,
    orderBy: [
      { status: 'asc' },
      { priority: 'asc' },
      { deadline: 'asc' },
    ],
    include: {
      assigner: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(tasks)
}

// POST create task or werkstudent
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()

  // Create werkstudent
  if (body.type === 'werkstudent') {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }
    const ws = await prisma.werkstudent.create({
      data: {
        name: body.name.trim(),
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    })
    return NextResponse.json(ws, { status: 201 })
  }

  // Create task
  const { title, description, deadline, priority, assignerId, werkstudentId } = body
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
      werkstudentId: werkstudentId || null,
    },
    include: {
      assigner: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(task, { status: 201 })
}

// PUT update task or werkstudent
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()

  // Update werkstudent
  if (body.type === 'werkstudent') {
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    const ws = await prisma.werkstudent.update({
      where: { id: body.id },
      data: updateData,
    })
    return NextResponse.json(ws)
  }

  // Update task
  const { id, title, description, deadline, priority, status, assignerId, feedbackScore, feedbackNote } = body
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
  if (feedbackScore !== undefined) updateData.feedbackScore = feedbackScore || null
  if (feedbackNote !== undefined) updateData.feedbackNote = feedbackNote?.trim() || null

  const task = await prisma.werkstudentTask.update({
    where: { id },
    data: updateData,
    include: {
      assigner: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(task)
}

// DELETE task or werkstudent
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  if (type === 'werkstudent') {
    // Unlink tasks first, then delete werkstudent
    await prisma.werkstudentTask.updateMany({
      where: { werkstudentId: id },
      data: { werkstudentId: null },
    })
    await prisma.werkstudent.delete({ where: { id } })
  } else {
    await prisma.werkstudentTask.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
