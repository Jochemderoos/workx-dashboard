import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Programma item toevoegen (alleen PARTNER en ADMIN)
export async function POST(request: Request) {
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

    const body = await request.json()
    const { date, time, title, description, responsible } = body

    if (!date || !title) {
      return NextResponse.json({ error: 'Datum en titel zijn verplicht' }, { status: 400 })
    }

    const program = await prisma.lustrumProgram.create({
      data: {
        date,
        time: time || null,
        title,
        description: description || null,
        responsible: JSON.stringify(responsible || []),
        createdById: user.id,
      },
    })

    return NextResponse.json({
      ...program,
      responsible: JSON.parse(program.responsible),
    })
  } catch (error) {
    console.error('Error creating program item:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
