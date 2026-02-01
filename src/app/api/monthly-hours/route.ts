import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haal maandelijkse uren op (alleen Partners en Admin)
export async function GET(req: NextRequest) {
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
        { error: 'Alleen partners en admin kunnen urenoverzicht bekijken' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')

    const entries = await prisma.monthlyHours.findMany({
      where: year ? { year: parseInt(year) } : undefined,
      orderBy: [
        { year: 'desc' },
        { month: 'asc' },
        { employeeName: 'asc' }
      ]
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching monthly hours:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monthly hours' },
      { status: 500 }
    )
  }
}

// POST - Voeg of update maandelijkse uren toe (alleen Partners en Admin)
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
        { error: 'Alleen partners en admin kunnen uren invoeren' },
        { status: 403 }
      )
    }

    const { employeeName, year, month, billableHours, workedHours } = await req.json()

    if (!employeeName || !year || !month) {
      return NextResponse.json(
        { error: 'employeeName, year en month zijn verplicht' },
        { status: 400 }
      )
    }

    // Upsert - maak nieuw of update bestaand
    const entry = await prisma.monthlyHours.upsert({
      where: {
        employeeName_year_month: { employeeName, year, month }
      },
      update: {
        billableHours: billableHours || 0,
        workedHours: workedHours || 0
      },
      create: {
        employeeName,
        year,
        month,
        billableHours: billableHours || 0,
        workedHours: workedHours || 0
      }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error saving monthly hours:', error)
    return NextResponse.json(
      { error: 'Failed to save monthly hours' },
      { status: 500 }
    )
  }
}
