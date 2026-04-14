import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limiter'

// GET - Specifiek overdrachtsdocument ophalen
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id } = await params

    const handover = await prisma.handover.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        cases: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!handover) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(handover)
  } catch (error) {
    console.error('Error fetching handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT - Overdrachtsdocument bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = withRateLimit(req, { maxRequests: 30, windowMs: 60000, keyPrefix: 'handovers' })
    if (limited) return limited

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id } = await params
    const { periodStart, periodEnd, note, generalWaarnemers, cases } = await req.json()

    // Delete existing cases and recreate
    await prisma.handoverCase.deleteMany({ where: { handoverId: id } })

    const handover = await prisma.handover.update({
      where: { id },
      data: {
        ...(periodStart && { periodStart: new Date(periodStart) }),
        ...(periodEnd && { periodEnd: new Date(periodEnd) }),
        ...(note !== undefined && { note: note || null }),
        ...(generalWaarnemers !== undefined && { generalWaarnemers: generalWaarnemers || null }),
        ...(cases && {
          cases: {
            create: cases.map((c: { dossiernaam: string; contactpersoon?: string; beschrijving?: string; waarnemers: string }) => ({
              dossiernaam: c.dossiernaam,
              contactpersoon: c.contactpersoon || null,
              beschrijving: c.beschrijving || null,
              waarnemers: c.waarnemers || '',
            })),
          },
        }),
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
    console.error('Error updating handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Overdrachtsdocument verwijderen (cascade verwijdert cases)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = withRateLimit(req, { maxRequests: 10, windowMs: 60000, keyPrefix: 'handovers-del' })
    if (limited) return limited

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id } = await params

    await prisma.handover.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
