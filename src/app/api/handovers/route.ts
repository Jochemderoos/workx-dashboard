import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Alle actieve handovers ophalen (met cases)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const showAll = searchParams.get('all') === 'true'

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const handovers = await prisma.handover.findMany({
      where: showAll ? {} : { periodEnd: { gte: now } },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        cases: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { periodStart: 'asc' },
    })

    return NextResponse.json(handovers)
  } catch (error) {
    console.error('Error fetching handovers:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Nieuw overdrachtsdocument aanmaken
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { userId, periodStart, periodEnd, note, cases } = await req.json()

    if (!userId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'userId, periodStart en periodEnd zijn verplicht' }, { status: 400 })
    }

    const handover = await prisma.handover.create({
      data: {
        userId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        note: note || null,
        cases: {
          create: (cases || []).map((c: { dossiernaam: string; contactpersoon?: string; beschrijving?: string; waarnemers: string }) => ({
            dossiernaam: c.dossiernaam,
            contactpersoon: c.contactpersoon || null,
            beschrijving: c.beschrijving || null,
            waarnemers: c.waarnemers || '',
          })),
        },
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        cases: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json(handover)
  } catch (error) {
    console.error('Error creating handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
