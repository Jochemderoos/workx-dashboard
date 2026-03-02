import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limiter'

// GET - Alle cases voor een externe advocaat ophalen
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== 'PARTNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const advocateUserId = searchParams.get('advocateUserId')
    const includeCompleted = searchParams.get('includeCompleted') === 'true'

    const cases = await prisma.externalAdvocateCase.findMany({
      where: {
        ...(advocateUserId && { advocateUserId }),
        ...(!includeCompleted && { isCompleted: false }),
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(cases)
  } catch (error) {
    console.error('Error fetching external advocate cases:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Nieuwe zaak aanmaken
export async function POST(req: NextRequest) {
  try {
    const limited = withRateLimit(req, { maxRequests: 20, windowMs: 60000, keyPrefix: 'ext-advocate' })
    if (limited) return limited

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== 'PARTNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { advocateUserId, dossiernaam, contactpersoonNaam, beschrijving, verwachteUrenPerWeek } = await req.json()

    if (!advocateUserId || !dossiernaam) {
      return NextResponse.json({ error: 'advocateUserId en dossiernaam zijn verplicht' }, { status: 400 })
    }

    const newCase = await prisma.externalAdvocateCase.create({
      data: {
        advocateUserId,
        dossiernaam,
        contactpersoonNaam: contactpersoonNaam || null,
        beschrijving: beschrijving || null,
        verwachteUrenPerWeek: verwachteUrenPerWeek ?? 0,
      },
    })

    return NextResponse.json(newCase)
  } catch (error) {
    console.error('Error creating external advocate case:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
