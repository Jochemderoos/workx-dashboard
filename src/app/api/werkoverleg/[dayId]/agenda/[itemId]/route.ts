import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Agendapunt bijwerken
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { itemId } = await params
    const body = await request.json()
    const { title, notes, sortOrder } = body

    const data: any = {}
    if (title !== undefined) data.title = title
    if (notes !== undefined) data.notes = notes
    if (sortOrder !== undefined) data.sortOrder = sortOrder

    const item = await prisma.werkoverlegAgendaItem.update({
      where: { id: itemId },
      data,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('PATCH /api/werkoverleg/[dayId]/agenda/[itemId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// DELETE - Agendapunt verwijderen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ dayId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { itemId } = await params

    await prisma.werkoverlegAgendaItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/werkoverleg/[dayId]/agenda/[itemId] error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
