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
      // Fetch all parental leaves for admin - grouped by user
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
        orderBy: [
          { user: { name: 'asc' } },
          { childNumber: 'asc' }
        ]
      })
      return NextResponse.json(leaves)
    } else {
      // Fetch own parental leave (all children)
      const leaves = await prisma.parentalLeave.findMany({
        where: { userId: session.user.id },
        orderBy: { childNumber: 'asc' }
      })
      return NextResponse.json(leaves)
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

    // Get next child number for this user
    const existingLeaves = await prisma.parentalLeave.findMany({
      where: { userId },
      orderBy: { childNumber: 'desc' },
      take: 1
    })
    const nextChildNumber = existingLeaves.length > 0 ? existingLeaves[0].childNumber + 1 : 1

    const leave = await prisma.parentalLeave.create({
      data: {
        userId,
        childNumber: leaveData.childNumber || nextChildNumber,
        kindNaam: leaveData.kindNaam || null,
        kindGeboorteDatum: leaveData.kindGeboorteDatum ? new Date(leaveData.kindGeboorteDatum) : null,
        uitgerekendeDatum: leaveData.uitgerekendeDatum ? new Date(leaveData.uitgerekendeDatum) : null,
        zwangerschapsverlofStart: leaveData.zwangerschapsverlofStart ? new Date(leaveData.zwangerschapsverlofStart) : null,
        zwangerschapsverlofStatus: leaveData.zwangerschapsverlofStatus || null,
        geboorteverlofPartner: leaveData.geboorteverlofPartner || null,
        aanvullendVerlofPartner: leaveData.aanvullendVerlofPartner || null,
        betaaldTotaalUren: leaveData.betaaldTotaalUren ?? 324,
        betaaldOpgenomenUren: leaveData.betaaldOpgenomenUren ?? 0,
        betaaldVerlofDetails: leaveData.betaaldVerlofDetails || null,
        betaaldVerlofEinddatum: leaveData.betaaldVerlofEinddatum ? new Date(leaveData.betaaldVerlofEinddatum) : null,
        onbetaaldTotaalDagen: leaveData.onbetaaldTotaalDagen ?? 85,
        onbetaaldOpgenomenDagen: leaveData.onbetaaldOpgenomenDagen ?? 0,
        onbetaaldVerlofDetails: leaveData.onbetaaldVerlofDetails || null,
        onbetaaldVerlofEinddatum: leaveData.onbetaaldVerlofEinddatum ? new Date(leaveData.onbetaaldVerlofEinddatum) : null,
        uwvAangevraagd: leaveData.uwvAangevraagd ?? false,
        uwvDetails: leaveData.uwvDetails || null,
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
    const { id, ...leaveData } = data

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    const updateData: any = {}

    // Handle all possible fields
    if (leaveData.kindNaam !== undefined) updateData.kindNaam = leaveData.kindNaam
    if (leaveData.kindGeboorteDatum !== undefined) updateData.kindGeboorteDatum = leaveData.kindGeboorteDatum ? new Date(leaveData.kindGeboorteDatum) : null
    if (leaveData.uitgerekendeDatum !== undefined) updateData.uitgerekendeDatum = leaveData.uitgerekendeDatum ? new Date(leaveData.uitgerekendeDatum) : null
    if (leaveData.zwangerschapsverlofStart !== undefined) updateData.zwangerschapsverlofStart = leaveData.zwangerschapsverlofStart ? new Date(leaveData.zwangerschapsverlofStart) : null
    if (leaveData.zwangerschapsverlofStatus !== undefined) updateData.zwangerschapsverlofStatus = leaveData.zwangerschapsverlofStatus
    if (leaveData.geboorteverlofPartner !== undefined) updateData.geboorteverlofPartner = leaveData.geboorteverlofPartner
    if (leaveData.aanvullendVerlofPartner !== undefined) updateData.aanvullendVerlofPartner = leaveData.aanvullendVerlofPartner
    if (leaveData.betaaldTotaalUren !== undefined) updateData.betaaldTotaalUren = leaveData.betaaldTotaalUren
    if (leaveData.betaaldOpgenomenUren !== undefined) updateData.betaaldOpgenomenUren = leaveData.betaaldOpgenomenUren
    if (leaveData.betaaldVerlofDetails !== undefined) updateData.betaaldVerlofDetails = leaveData.betaaldVerlofDetails
    if (leaveData.betaaldVerlofEinddatum !== undefined) updateData.betaaldVerlofEinddatum = leaveData.betaaldVerlofEinddatum ? new Date(leaveData.betaaldVerlofEinddatum) : null
    if (leaveData.onbetaaldTotaalDagen !== undefined) updateData.onbetaaldTotaalDagen = leaveData.onbetaaldTotaalDagen
    if (leaveData.onbetaaldOpgenomenDagen !== undefined) updateData.onbetaaldOpgenomenDagen = leaveData.onbetaaldOpgenomenDagen
    if (leaveData.onbetaaldVerlofDetails !== undefined) updateData.onbetaaldVerlofDetails = leaveData.onbetaaldVerlofDetails
    if (leaveData.onbetaaldVerlofEinddatum !== undefined) updateData.onbetaaldVerlofEinddatum = leaveData.onbetaaldVerlofEinddatum ? new Date(leaveData.onbetaaldVerlofEinddatum) : null
    if (leaveData.uwvAangevraagd !== undefined) updateData.uwvAangevraagd = leaveData.uwvAangevraagd
    if (leaveData.uwvDetails !== undefined) updateData.uwvDetails = leaveData.uwvDetails
    if (leaveData.note !== undefined) updateData.note = leaveData.note

    const leave = await prisma.parentalLeave.update({
      where: { id },
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

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    await prisma.parentalLeave.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting parental leave:', error)
    return NextResponse.json({ error: 'Kon verlof niet verwijderen' }, { status: 500 })
  }
}
