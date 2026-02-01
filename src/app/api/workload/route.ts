import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haal alle werkdruk entries op
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entries = await prisma.workload.findMany({
      orderBy: [
        { date: 'desc' },
        { personName: 'asc' }
      ]
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching workload:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workload' },
      { status: 500 }
    )
  }
}

// POST - Maak of update werkdruk entry (alleen Partners en Admin)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check of gebruiker Partner of Admin is
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Alleen partners en admin kunnen werkdruk invullen' },
        { status: 403 }
      )
    }

    const { personName, date, level } = await req.json()

    if (!personName || !date) {
      return NextResponse.json(
        { error: 'personName en date zijn verplicht' },
        { status: 400 }
      )
    }

    // Als level null is, verwijder de entry
    if (!level) {
      await prisma.workload.deleteMany({
        where: { personName, date }
      })
      return NextResponse.json({ success: true, deleted: true })
    }

    // Upsert - maak nieuw of update bestaand
    const entry = await prisma.workload.upsert({
      where: {
        personName_date: { personName, date }
      },
      update: { level },
      create: { personName, date, level }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error saving workload:', error)
    return NextResponse.json(
      { error: 'Failed to save workload' },
      { status: 500 }
    )
  }
}
