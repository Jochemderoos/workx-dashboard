import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Naam correcties voor incomplete namen
const NAME_CORRECTIONS: Record<string, string> = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
}

// One-time migration flag (runs once per server instance)
let migrationRun = false

async function migrateIncompleteNames() {
  if (migrationRun) return
  migrationRun = true

  try {
    for (const [incorrectName, correctName] of Object.entries(NAME_CORRECTIONS)) {
      // Find all records with the incorrect name
      const incorrectRecords = await prisma.monthlyHours.findMany({
        where: { employeeName: incorrectName }
      })

      for (const record of incorrectRecords) {
        // Check if correct name already has an entry for this month/year
        const existingCorrect = await prisma.monthlyHours.findUnique({
          where: {
            employeeName_year_month: {
              employeeName: correctName,
              year: record.year,
              month: record.month
            }
          }
        })

        if (existingCorrect) {
          // Merge hours into existing record and delete old
          await prisma.monthlyHours.update({
            where: { id: existingCorrect.id },
            data: {
              billableHours: existingCorrect.billableHours + record.billableHours,
              workedHours: existingCorrect.workedHours + record.workedHours
            }
          })
          await prisma.monthlyHours.delete({ where: { id: record.id } })
        } else {
          // Just update the name
          await prisma.monthlyHours.update({
            where: { id: record.id },
            data: { employeeName: correctName }
          })
        }
      }
    }
  } catch (error) {
    console.error('Error during name migration:', error)
    migrationRun = false // Allow retry on error
  }
}

// GET - Haal maandelijkse uren op (alleen Partners en Admin)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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

    // Run migration on first access
    await migrateIncompleteNames()

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
      { error: 'Kon niet ophalen monthly hours' },
      { status: 500 }
    )
  }
}

// POST - Voeg of update maandelijkse uren toe (alleen Partners en Admin)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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
      { error: 'Kon niet opslaan monthly hours' },
      { status: 500 }
    )
  }
}
