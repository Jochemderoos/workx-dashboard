import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Activiteit met alle bonnetjes
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const activity = await prisma.expenseActivity.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        receipts: {
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(activity)
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json({ error: 'Kon activiteit niet ophalen' }, { status: 500 })
  }
}

// PUT - Activiteit bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, status, date } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description || null
    if (status !== undefined) data.status = status
    if (date !== undefined) data.date = new Date(date)

    const activity = await prisma.expenseActivity.update({
      where: { id: params.id },
      data,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(activity)
  } catch (error) {
    console.error('Error updating activity:', error)
    return NextResponse.json({ error: 'Kon activiteit niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Activiteit verwijderen (alleen creator of admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const activity = await prisma.expenseActivity.findUnique({
      where: { id: params.id },
      select: { createdById: true },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
    }

    // Check permissie: alleen creator of admin/partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isCreator = activity.createdById === session.user.id
    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Geen rechten om deze activiteit te verwijderen' }, { status: 403 })
    }

    await prisma.expenseActivity.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting activity:', error)
    return NextResponse.json({ error: 'Kon activiteit niet verwijderen' }, { status: 500 })
  }
}
