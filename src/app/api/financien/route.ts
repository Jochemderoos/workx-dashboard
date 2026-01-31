import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET 2026 financial data
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the single 2026 data record (or return defaults)
    const data = await prisma.financialData2026.findFirst()

    if (!data) {
      // Return default empty data
      return NextResponse.json({
        werkgeverslasten: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        omzet: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        uren: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      })
    }

    return NextResponse.json({
      werkgeverslasten: JSON.parse(data.werkgeverslasten),
      omzet: JSON.parse(data.omzet),
      uren: JSON.parse(data.uren)
    })
  } catch (error) {
    console.error('Error fetching 2026 data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// PUT update 2026 financial data
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { werkgeverslasten, omzet, uren } = body

    // Validate arrays
    if (!Array.isArray(werkgeverslasten) || !Array.isArray(omzet) || !Array.isArray(uren)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    // Upsert - create if not exists, update if exists
    const existing = await prisma.financialData2026.findFirst()

    let data
    if (existing) {
      data = await prisma.financialData2026.update({
        where: { id: existing.id },
        data: {
          werkgeverslasten: JSON.stringify(werkgeverslasten),
          omzet: JSON.stringify(omzet),
          uren: JSON.stringify(uren)
        }
      })
    } else {
      data = await prisma.financialData2026.create({
        data: {
          werkgeverslasten: JSON.stringify(werkgeverslasten),
          omzet: JSON.stringify(omzet),
          uren: JSON.stringify(uren)
        }
      })
    }

    return NextResponse.json({
      werkgeverslasten: JSON.parse(data.werkgeverslasten),
      omzet: JSON.parse(data.omzet),
      uren: JSON.parse(data.uren)
    })
  } catch (error) {
    console.error('Error updating 2026 data:', error)
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 })
  }
}
