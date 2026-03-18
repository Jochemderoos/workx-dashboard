import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EMPTY_12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

// GET 2026 financial data - toegankelijk voor alle ingelogde gebruikers
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const currentYear = new Date().getFullYear()

    // Haal financiele data en MonthlyHours parallel op
    const [data, monthlyHours] = await Promise.all([
      prisma.financialData2026.findFirst(),
      prisma.monthlyHours.findMany({
        where: { year: currentYear },
        select: { month: true, billableHours: true },
      }),
    ])

    // Bereken uren per maand automatisch uit MonthlyHours
    const uren = [...EMPTY_12]
    for (const h of monthlyHours) {
      if (h.month >= 1 && h.month <= 12) {
        uren[h.month - 1] += h.billableHours
      }
    }
    // Afronden op 2 decimalen
    for (let i = 0; i < 12; i++) {
      uren[i] = Math.round(uren[i] * 100) / 100
    }

    if (!data) {
      return NextResponse.json({
        werkgeverslasten: EMPTY_12,
        kostenExtern: EMPTY_12,
        kostenZzp: EMPTY_12,
        omzet: EMPTY_12,
        uren,
      })
    }

    return NextResponse.json({
      werkgeverslasten: JSON.parse(data.werkgeverslasten),
      kostenExtern: JSON.parse(data.kostenExtern),
      kostenZzp: data.kostenZzp ? JSON.parse(data.kostenZzp) : EMPTY_12,
      omzet: JSON.parse(data.omzet),
      uren,
    })
  } catch (error) {
    console.error('Error fetching 2026 data:', error)
    return NextResponse.json({ error: 'Kon niet ophalen data' }, { status: 500 })
  }
}

// PUT update 2026 financial data - alleen voor ADMIN/PARTNER
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Check role - alleen ADMIN en PARTNER mogen financiele data wijzigen
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  if (!user || (user.role !== 'ADMIN' && user.role !== 'PARTNER')) {
    return NextResponse.json({ error: 'Geen toegang om financiele gegevens te wijzigen' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { werkgeverslasten, kostenExtern, kostenZzp, omzet, uren } = body

    // Validate arrays
    if (!Array.isArray(werkgeverslasten) || !Array.isArray(omzet)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    const kostenExtData = Array.isArray(kostenExtern) ? kostenExtern : EMPTY_12
    const kostenZzpData = Array.isArray(kostenZzp) ? kostenZzp : EMPTY_12
    const urenData = Array.isArray(uren) ? uren : EMPTY_12

    // Upsert - create if not exists, update if exists
    const existing = await prisma.financialData2026.findFirst()

    let data
    if (existing) {
      data = await prisma.financialData2026.update({
        where: { id: existing.id },
        data: {
          werkgeverslasten: JSON.stringify(werkgeverslasten),
          kostenExtern: JSON.stringify(kostenExtData),
          kostenZzp: JSON.stringify(kostenZzpData),
          omzet: JSON.stringify(omzet),
          uren: JSON.stringify(urenData),
        }
      })
    } else {
      data = await prisma.financialData2026.create({
        data: {
          werkgeverslasten: JSON.stringify(werkgeverslasten),
          kostenExtern: JSON.stringify(kostenExtData),
          kostenZzp: JSON.stringify(kostenZzpData),
          omzet: JSON.stringify(omzet),
          uren: JSON.stringify(urenData),
        }
      })
    }

    // Bereken uren automatisch uit MonthlyHours (net als GET)
    const currentYear = new Date().getFullYear()
    const monthlyHours = await prisma.monthlyHours.findMany({
      where: { year: currentYear },
      select: { month: true, billableHours: true },
    })
    const autoUren = [...EMPTY_12]
    for (const h of monthlyHours) {
      if (h.month >= 1 && h.month <= 12) {
        autoUren[h.month - 1] += h.billableHours
      }
    }
    for (let i = 0; i < 12; i++) {
      autoUren[i] = Math.round(autoUren[i] * 100) / 100
    }

    return NextResponse.json({
      werkgeverslasten: JSON.parse(data.werkgeverslasten),
      kostenExtern: JSON.parse(data.kostenExtern),
      kostenZzp: data.kostenZzp ? JSON.parse(data.kostenZzp) : EMPTY_12,
      omzet: JSON.parse(data.omzet),
      uren: autoUren,
    })
  } catch (error) {
    console.error('Error updating 2026 data:', error)
    return NextResponse.json({ error: 'Kon niet bijwerken data' }, { status: 500 })
  }
}
