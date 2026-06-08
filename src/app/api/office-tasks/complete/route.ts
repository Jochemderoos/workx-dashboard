// Afvinken van een office task. Voor recurring tasks: update lastCompletedAt
// (wordt later automatisch "open" weer in UI). Voor once: completedAt setten.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIRST_NAMES = ['jochem', 'hanna', 'bente', 'lotte']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, role: true },
  })
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const isManager = me.role === 'PARTNER' || me.role === 'ADMIN' || me.role === 'OFFICE_MANAGER'
  const firstName = (me.name || '').split(' ')[0].toLowerCase()
  const isAllowedPerson = ALLOWED_FIRST_NAMES.includes(firstName)
  if (!(isManager || isAllowedPerson)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    if (!body.taskId) return NextResponse.json({ error: 'taskId verplicht' }, { status: 400 })
    const task = await prisma.officeTask.findUnique({ where: { id: body.taskId } })
    if (!task) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const isOnce = task.frequency === 'once'
    const now = new Date()
    const userName = me.name || 'Onbekend'

    const [updatedTask, completion] = await prisma.$transaction([
      prisma.officeTask.update({
        where: { id: body.taskId },
        data: isOnce
          ? {
              completedAt: now,
              completedById: session.user.id,
              completedByName: userName,
              lastCompletedAt: now,
              lastCompletedById: session.user.id,
              lastCompletedByName: userName,
            }
          : {
              lastCompletedAt: now,
              lastCompletedById: session.user.id,
              lastCompletedByName: userName,
            },
      }),
      prisma.officeTaskCompletion.create({
        data: {
          taskId: body.taskId,
          completedById: session.user.id,
          completedByName: userName,
          note: body.note?.trim() || null,
        },
      }),
    ])

    return NextResponse.json({ task: updatedTask, completion })
  } catch (err) {
    console.error('office-task complete failed', err)
    return NextResponse.json({ error: 'Kon niet afvinken' }, { status: 500 })
  }
}

// "Onafvinken" voor recurring tasks: reset lastCompletedAt. Voor once: clear completedAt.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId verplicht' }, { status: 400 })

  try {
    const task = await prisma.officeTask.findUnique({ where: { id: taskId } })
    if (!task) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const updated = await prisma.officeTask.update({
      where: { id: taskId },
      data: {
        completedAt: null,
        completedById: null,
        completedByName: null,
        lastCompletedAt: null,
        lastCompletedById: null,
        lastCompletedByName: null,
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('office-task uncomplete failed', err)
    return NextResponse.json({ error: 'Kon niet ongedaan maken' }, { status: 500 })
  }
}
