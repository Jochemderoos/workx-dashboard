import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { monthId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { monthId } = params

    const month = await prisma.meetingMonth.findUnique({
      where: { id: monthId },
      include: {
        weeks: {
          orderBy: { meetingDate: 'asc' },
          include: {
            topics: {
              orderBy: { sortOrder: 'asc' },
              include: {
                actions: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
            actions: {
              orderBy: { createdAt: 'desc' },
            },
            distributions: true,
          },
        },
      },
    })

    if (!month) {
      return NextResponse.json(
        { error: 'Maand niet gevonden' },
        { status: 404 }
      )
    }

    return NextResponse.json(month)
  } catch (error) {
    console.error('Error fetching meeting month:', error)
    return NextResponse.json(
      { error: 'Kon notulen maand niet ophalen' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { monthId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { monthId } = params
    const { label } = await req.json()

    if (!label) {
      return NextResponse.json(
        { error: 'Label is verplicht' },
        { status: 400 }
      )
    }

    const month = await prisma.meetingMonth.update({
      where: { id: monthId },
      data: { label },
    })

    return NextResponse.json(month)
  } catch (error) {
    console.error('Error updating meeting month:', error)
    return NextResponse.json(
      { error: 'Kon notulen maand niet bijwerken' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { monthId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { monthId } = params

    await prisma.meetingMonth.delete({
      where: { id: monthId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting month:', error)
    return NextResponse.json(
      { error: 'Kon notulen maand niet verwijderen' },
      { status: 500 }
    )
  }
}
