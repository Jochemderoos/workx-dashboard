import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Agendapunt toevoegen
export async function POST(
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
    const { title, notes } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }

    // Bepaal sortOrder
    const maxOrder = await prisma.werkoverlegAgendaItem.findFirst({
      where: { dayId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const item = await prisma.werkoverlegAgendaItem.create({
      data: {
        dayId,
        title: title.trim(),
        notes: notes || null,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/werkoverleg/[dayId]/agenda error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
