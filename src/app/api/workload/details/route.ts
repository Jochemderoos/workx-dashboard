import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch workload details for DD project detection
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const weeks = parseInt(searchParams.get('weeks') || '4', 10)

  // Calculate date range
  const now = new Date()
  const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)
  const startStr = startDate.toISOString().split('T')[0]

  const details = await prisma.workloadDetail.findMany({
    where: {
      date: { gte: startStr },
    },
    select: {
      personName: true,
      projectName: true,
      billableHours: true,
      workedHours: true,
    },
  })

  return NextResponse.json(details)
}
