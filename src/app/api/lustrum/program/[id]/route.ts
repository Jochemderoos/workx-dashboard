import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Programma item wijzigen (alleen PARTNER en ADMIN)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await request.json()
    const { date, time, title, description, responsible } = body

    const updated = await prisma.lustrumProgram.update({
      where: { id: params.id },
      data: {
        ...(date !== undefined ? { date } : {}),
        ...(time !== undefined ? { time: time || null } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(responsible !== undefined ? { responsible: JSON.stringify(responsible) } : {}),
      },
    })

    return NextResponse.json({
      ...updated,
      responsible: JSON.parse(updated.responsible),
    })
  } catch (error) {
    console.error('Error updating program item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Programma item verwijderen (alleen PARTNER en ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Alleen PARTNER en ADMIN mogen programma aanpassen
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { id } = params

    // Ruim ook de voorkeuren van teamleden voor dit onderdeel op.
    await prisma.lustrumProgramPreference.deleteMany({ where: { programId: id } })
    await prisma.lustrumProgram.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting program item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
