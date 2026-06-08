// Office tasks: lezen + aanmaken + bijwerken + verwijderen.
// Toegang: Jochem, Hanna, Bente, Lotte (op naam-prefix), én PARTNER/ADMIN.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIRST_NAMES = ['jochem', 'hanna', 'bente', 'lotte']

async function checkAccess(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true },
  })
  if (!me) return null
  const isManager = me.role === 'PARTNER' || me.role === 'ADMIN' || me.role === 'OFFICE_MANAGER'
  const firstName = (me.name || '').split(' ')[0].toLowerCase()
  const isAllowedPerson = ALLOWED_FIRST_NAMES.includes(firstName)
  return { me, hasAccess: isManager || isAllowedPerson }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const access = await checkAccess(session.user.id)
  if (!access?.hasAccess) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const tasks = await prisma.officeTask.findMany({
      where: { isArchived: false },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
      include: {
        completions: {
          orderBy: { completedAt: 'desc' },
          take: 5,
        },
      },
    })
    return NextResponse.json(tasks)
  } catch (err) {
    console.error('office-tasks GET failed', err)
    return NextResponse.json({ error: 'Kon taken niet ophalen' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const access = await checkAccess(session.user.id)
  if (!access?.hasAccess) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.title?.trim() || !body.category) {
      return NextResponse.json({ error: 'Titel en categorie verplicht' }, { status: 400 })
    }
    const last = await prisma.officeTask.findFirst({
      where: { category: body.category },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const task = await prisma.officeTask.create({
      data: {
        category: body.category,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        assigneeId: body.assigneeId || null,
        assigneeName: body.assigneeName || null,
        frequency: body.frequency || 'once',
        position: (last?.position ?? -1) + 1,
      },
    })
    return NextResponse.json(task)
  } catch (err) {
    console.error('office-tasks POST failed', err)
    return NextResponse.json({ error: 'Kon taak niet aanmaken' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const access = await checkAccess(session.user.id)
  if (!access?.hasAccess) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
    const updated = await prisma.officeTask.update({
      where: { id: body.id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
        ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId || null }),
        ...(body.assigneeName !== undefined && { assigneeName: body.assigneeName || null }),
        ...(body.isArchived !== undefined && { isArchived: !!body.isArchived }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('office-tasks PATCH failed', err)
    return NextResponse.json({ error: 'Kon taak niet bijwerken' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const access = await checkAccess(session.user.id)
  if (!access?.hasAccess) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  try {
    await prisma.officeTask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('office-tasks DELETE failed', err)
    return NextResponse.json({ error: 'Kon taak niet verwijderen' }, { status: 500 })
  }
}
