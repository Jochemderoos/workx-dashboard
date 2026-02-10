import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId } = params

    const distributions = await prisma.workDistribution.findMany({
      where: { weekId },
      orderBy: { partnerName: 'asc' },
    })

    return NextResponse.json(distributions)
  } catch (error) {
    console.error('Error fetching work distributions:', error)
    return NextResponse.json(
      { error: 'Kon werkverdeling niet ophalen' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { monthId: string; weekId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId } = params
    const { distributions } = await req.json()

    if (!Array.isArray(distributions)) {
      return NextResponse.json(
        { error: 'Distributions moet een array zijn' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      distributions.map((dist: { partnerName: string; employeeName: string; employeeId?: string }) =>
        prisma.workDistribution.upsert({
          where: {
            weekId_partnerName: {
              weekId,
              partnerName: dist.partnerName,
            },
          },
          update: {
            employeeName: dist.employeeName,
            employeeId: dist.employeeId ?? null,
          },
          create: {
            weekId,
            partnerName: dist.partnerName,
            employeeName: dist.employeeName,
            employeeId: dist.employeeId ?? null,
          },
        })
      )
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error updating work distributions:', error)
    return NextResponse.json(
      { error: 'Kon werkverdeling niet bijwerken' },
      { status: 500 }
    )
  }
}
