import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - alleen eigen taken
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const tasks = await prisma.personalTask.findMany({
      where: { userId: session.user.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching personal tasks:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - nieuwe taak
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const { title, description, dueDate } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    const maxSort = await prisma.personalTask.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    })
    const created = await prisma.personalTask.create({
      data: {
        userId: session.user.id,
        title: String(title).trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating personal task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
