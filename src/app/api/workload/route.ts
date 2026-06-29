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
  'Lodewijk van': 'Lodewijk van Thiel',
}

const MIGRATION_KEY = 'workload_name_migration_done'

async function migrateWorkloadNames() {
  // Check DB flag so this only ever runs once (not per cold start)
  const setting = await prisma.appSetting.findUnique({ where: { key: MIGRATION_KEY } })
  if (setting) return

  try {
    for (const [incorrectName, correctName] of Object.entries(NAME_CORRECTIONS)) {
      await prisma.workload.updateMany({
        where: { personName: incorrectName },
        data: { personName: correctName }
      })
    }
    // Mark as done permanently
    await prisma.appSetting.create({
      data: { key: MIGRATION_KEY, value: 'true', label: 'Workload naamcorrectie migratie voltooid' }
    })
  } catch (error) {
    console.error('Error during workload name migration:', error)
  }
}

// GET - Haal werkdruk entries op (gefilterd op jaar)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Werkdruk van collega's is alleen voor partners/admin (zoals invullen).
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (!me || (me.role !== 'PARTNER' && me.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Run migration on first access
    await migrateWorkloadNames()

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || String(new Date().getFullYear())
    const year2 = searchParams.get('year2')
    const personName = searchParams.get('personName')

    const dateFilter = year2
      ? { OR: [{ date: { startsWith: year } }, { date: { startsWith: year2 } }] }
      : { date: { startsWith: year } }

    const where = personName
      ? { AND: [{ personName }, dateFilter] }
      : dateFilter

    const entries = await prisma.workload.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { personName: 'asc' }
      ]
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching workload:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen workload' },
      { status: 500 }
    )
  }
}

// POST - Maak of update werkdruk entry (alleen Partners en Admin)
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
      { error: 'Kon niet opslaan workload' },
      { status: 500 }
    )
  }
}
