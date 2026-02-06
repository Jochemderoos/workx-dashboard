import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper: bereken werkdagen (ma-vr) tussen twee datums
function calculateWorkDays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    // 0 = zondag, 6 = zaterdag
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

// GET - Haal ziektedagen entries op (alleen voor PARTNER en ADMIN)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // Alleen Partners en Admin mogen ziektedagen zien
    if (session.user.role !== 'PARTNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const userId = searchParams.get('userId')

    // Filter op jaar
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    const where: any = {
      startDate: {
        gte: startOfYear,
        lte: endOfYear,
      }
    }

    if (userId) {
      where.userId = userId
    }

    const entries = await prisma.sickDayEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    // Bereken totalen per gebruiker
    const totalsMap = new Map<string, number>()
    entries.forEach(entry => {
      const current = totalsMap.get(entry.userId) || 0
      totalsMap.set(entry.userId, current + entry.workDays)
    })

    // Voeg totalen toe aan response
    const totals = Array.from(totalsMap.entries()).map(([userId, totalDays]) => ({
      userId,
      totalDays
    }))

    return NextResponse.json({ entries, totals })
  } catch (error) {
    console.error('Error fetching sick days:', error)
    return NextResponse.json({ error: 'Kon ziektedagen niet ophalen' }, { status: 500 })
  }
}

// POST - Ziektedag(en) toevoegen (alleen voor PARTNER en ADMIN)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // Alleen Partners en Admin mogen ziektedagen bijwerken
    if (session.user.role !== 'PARTNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, startDate, endDate, note } = body

    if (!userId || !startDate) {
      return NextResponse.json({ error: 'userId en startDate zijn verplicht' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)

    // Valideer dat start niet na end is
    if (start > end) {
      return NextResponse.json({ error: 'Startdatum mag niet na einddatum zijn' }, { status: 400 })
    }

    // Bereken werkdagen
    const workDays = calculateWorkDays(start, end)

    if (workDays === 0) {
      return NextResponse.json({ error: 'Periode bevat geen werkdagen' }, { status: 400 })
    }

    const entry = await prisma.sickDayEntry.create({
      data: {
        userId,
        startDate: start,
        endDate: end,
        workDays,
        note: note || null,
        createdById: currentUser.id,
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

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error saving sick day:', error)
    return NextResponse.json({ error: 'Kon ziektedag niet opslaan' }, { status: 500 })
  }
}

// DELETE - Ziektedag entry verwijderen (alleen voor PARTNER en ADMIN)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    if (session.user.role !== 'PARTNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('id')

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is verplicht' }, { status: 400 })
    }

    await prisma.sickDayEntry.delete({
      where: { id: entryId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sick day:', error)
    return NextResponse.json({ error: 'Kon ziektedag niet verwijderen' }, { status: 500 })
  }
}
