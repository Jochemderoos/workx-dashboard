import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch parental leave (own or all for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'PARTNER'
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    if (all && isAdmin) {
      // Fetch all parental leaves for admin
      const leaves = await prisma.parentalLeave.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          user: {
            name: 'asc'
          }
        }
      })
      return NextResponse.json(leaves)
    } else {
      // Fetch own parental leave
      const leave = await prisma.parentalLeave.findUnique({
        where: { userId: session.user.id }
      })
      return NextResponse.json(leave)
    }
  } catch (error) {
    console.error('Error fetching parental leave:', error)
    return NextResponse.json({ error: 'Kon verlof niet ophalen' }, { status: 500 })
  }
}

// POST - Create parental leave (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'PARTNER'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const data = await request.json()
    const { userId, ...leaveData } = data

    if (!userId) {
      return NextResponse.json({ error: 'Gebruiker ID is verplicht' }, { status: 400 })
    }

    // Check if user already has parental leave
    const existing = await prisma.parentalLeave.findUnique({
      where: { userId }
    })

    if (existing) {
      return NextResponse.json({ error: 'Gebruiker heeft al ouderschapsverlof' }, { status: 400 })
    }

    const leave = await prisma.parentalLeave.create({
      data: {
        userId,
        betaaldTotaalWeken: leaveData.betaaldTotaalWeken || 9,
        betaaldOpgenomenWeken: leaveData.betaaldOpgenomenWeken || 0,
        onbetaaldTotaalWeken: leaveData.onbetaaldTotaalWeken || 17,
        onbetaaldOpgenomenWeken: leaveData.onbetaaldOpgenomenWeken || 0,
        kindNaam: leaveData.kindNaam || null,
        kindGeboorteDatum: leaveData.kindGeboorteDatum ? new Date(leaveData.kindGeboorteDatum) : null,
        startDatum: leaveData.startDatum ? new Date(leaveData.startDatum) : null,
        eindDatum: leaveData.eindDatum ? new Date(leaveData.eindDatum) : null,
        inzetPerWeek: leaveData.inzetPerWeek || null,
        note: leaveData.note || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(leave)
  } catch (error) {
    console.error('Error creating parental leave:', error)
    return NextResponse.json({ error: 'Kon verlof niet aanmaken' }, { status: 500 })
  }
}

// PATCH - Update parental leave (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'PARTNER'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const data = await request.json()
    const { id, userId, ...leaveData } = data

    if (!id && !userId) {
      return NextResponse.json({ error: 'ID of gebruiker ID is verplicht' }, { status: 400 })
    }

    const updateData: any = {}

    if (leaveData.betaaldTotaalWeken !== undefined) updateData.betaaldTotaalWeken = leaveData.betaaldTotaalWeken
    if (leaveData.betaaldOpgenomenWeken !== undefined) updateData.betaaldOpgenomenWeken = leaveData.betaaldOpgenomenWeken
    if (leaveData.onbetaaldTotaalWeken !== undefined) updateData.onbetaaldTotaalWeken = leaveData.onbetaaldTotaalWeken
    if (leaveData.onbetaaldOpgenomenWeken !== undefined) updateData.onbetaaldOpgenomenWeken = leaveData.onbetaaldOpgenomenWeken
    if (leaveData.kindNaam !== undefined) updateData.kindNaam = leaveData.kindNaam
    if (leaveData.kindGeboorteDatum !== undefined) updateData.kindGeboorteDatum = leaveData.kindGeboorteDatum ? new Date(leaveData.kindGeboorteDatum) : null
    if (leaveData.startDatum !== undefined) updateData.startDatum = leaveData.startDatum ? new Date(leaveData.startDatum) : null
    if (leaveData.eindDatum !== undefined) updateData.eindDatum = leaveData.eindDatum ? new Date(leaveData.eindDatum) : null
    if (leaveData.inzetPerWeek !== undefined) updateData.inzetPerWeek = leaveData.inzetPerWeek
    if (leaveData.note !== undefined) updateData.note = leaveData.note

    const leave = await prisma.parentalLeave.update({
      where: id ? { id } : { userId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(leave)
  } catch (error) {
    console.error('Error updating parental leave:', error)
    return NextResponse.json({ error: 'Kon verlof niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete parental leave (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'PARTNER'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id && !userId) {
      return NextResponse.json({ error: 'ID of gebruiker ID is verplicht' }, { status: 400 })
    }

    await prisma.parentalLeave.delete({
      where: id ? { id } : { userId: userId! }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting parental leave:', error)
    return NextResponse.json({ error: 'Kon verlof niet verwijderen' }, { status: 500 })
  }
}
