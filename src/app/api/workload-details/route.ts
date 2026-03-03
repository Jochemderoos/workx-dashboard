import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const personName = searchParams.get('personName')

    if (!personName) {
      return NextResponse.json({ error: 'personName is verplicht' }, { status: 400 })
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: { personName: string; date?: { gte?: string; lte?: string } } = {
      personName,
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = startDate
      if (endDate) where.date.lte = endDate
    }

    const details = await prisma.workloadDetail.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { projectName: 'asc' },
      ],
    })

    return NextResponse.json(details)
  } catch (error) {
    console.error('Error fetching workload details:', error)
    return NextResponse.json(
      { error: 'Fout bij ophalen van details' },
      { status: 500 }
    )
  }
}
