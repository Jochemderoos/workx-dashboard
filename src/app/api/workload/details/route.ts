import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { matchDDClient, ddKeywords, keywordsOverlap } from '@/lib/dd-match'

// GET - Fetch workload details for DD project detection
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isManager = me?.role === 'PARTNER' || me?.role === 'ADMIN'

  const { searchParams } = new URL(req.url)
  const weeks = parseInt(searchParams.get('weeks') || '4', 10)

  // Calculate date range
  const now = new Date()
  const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)
  const startStr = startDate.toISOString().split('T')[0]

  let details = await prisma.workloadDetail.findMany({
    where: {
      date: { gte: startStr },
    },
    select: {
      personName: true,
      projectName: true,
      date: true,
      billableHours: true,
      workedHours: true,
    },
  })

  // Medewerkers mogen elkaars uren op DD-zaken zien, maar níet de uren op
  // niet-DD dossiers. Managers zien alles ongefilterd.
  if (!isManager) {
    const ddProjects = await prisma.dDProject.findMany({
      where: { status: { not: 'afgerond' } },
      select: { name: true },
    })
    const projectKw = ddProjects.map(p => ddKeywords(p.name))
    details = details.filter(d =>
      matchDDClient(d.projectName) !== undefined ||
      projectKw.some(kw => keywordsOverlap(kw, ddKeywords(d.projectName)))
    )
  }

  return NextResponse.json(details)
}
