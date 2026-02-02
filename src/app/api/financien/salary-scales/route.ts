import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// GET - Iedereen kan dit zien
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const salaryScales = await prisma.salaryScale.findMany({
      orderBy: { experienceYear: 'asc' }
    })

    return NextResponse.json(salaryScales)
  } catch (error) {
    console.error('Error fetching salary scales:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Alleen PARTNER en ADMIN
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email! }
    })

    if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()

    const salaryScale = await prisma.salaryScale.upsert({
      where: { experienceYear: data.experienceYear },
      update: {
        label: data.label,
        salary: data.salary,
        hourlyRateBase: data.hourlyRateBase,
        hourlyRateMin: data.hourlyRateMin,
        hourlyRateMax: data.hourlyRateMax,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date()
      },
      create: {
        experienceYear: data.experienceYear,
        label: data.label,
        salary: data.salary,
        hourlyRateBase: data.hourlyRateBase,
        hourlyRateMin: data.hourlyRateMin,
        hourlyRateMax: data.hourlyRateMax,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date()
      }
    })

    return NextResponse.json(salaryScale)
  } catch (error) {
    console.error('Error saving salary scale:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
