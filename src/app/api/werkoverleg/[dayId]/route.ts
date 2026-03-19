import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Dag met agenda + acties
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { dayId } = await params

    const day = await prisma.werkoverlegDay.findUnique({
      where: { id: dayId },
      include: {
        agendaItems: { orderBy: { sortOrder: 'asc' } },
        actionItems: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!day) {
      return NextResponse.json({ error: 'Vergaderdag niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(day)
  } catch (error) {
    console.error('GET /api/werkoverleg/[dayId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// PATCH - Dag bijwerken (chairperson)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { dayId } = await params
    const body = await request.json()
    const { chairperson } = body

    const day = await prisma.werkoverlegDay.update({
      where: { id: dayId },
      data: { chairperson },
    })

    return NextResponse.json(day)
  } catch (error) {
    console.error('PATCH /api/werkoverleg/[dayId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
