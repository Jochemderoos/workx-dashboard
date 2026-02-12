import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Alle verantwoordelijkheden ophalen (voor iedereen)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const [responsibilities, teamMembers] = await Promise.all([
      prisma.responsibility.findMany({
        include: {
          responsible: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ responsibilities, teamMembers }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Error fetching responsibilities:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Nieuwe verantwoordelijkheid toevoegen (alleen PARTNER/ADMIN)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { task, responsibleId } = await req.json()

    if (!task || !responsibleId) {
      return NextResponse.json({ error: 'Taak en verantwoordelijke zijn verplicht' }, { status: 400 })
    }

    // Get max sortOrder
    const maxSort = await prisma.responsibility.aggregate({ _max: { sortOrder: true } })
    const nextOrder = (maxSort._max.sortOrder ?? -1) + 1

    const responsibility = await prisma.responsibility.create({
      data: {
        task,
        responsibleId,
        sortOrder: nextOrder,
      },
      include: {
        responsible: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json(responsibility)
  } catch (error) {
    console.error('Error creating responsibility:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH - Verantwoordelijkheid bijwerken (alleen PARTNER/ADMIN)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { id, task, responsibleId } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    const responsibility = await prisma.responsibility.update({
      where: { id },
      data: {
        ...(task !== undefined && { task }),
        ...(responsibleId !== undefined && { responsibleId }),
      },
      include: {
        responsible: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json(responsibility)
  } catch (error) {
    console.error('Error updating responsibility:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Verantwoordelijkheid verwijderen (alleen PARTNER/ADMIN)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    await prisma.responsibility.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting responsibility:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
