import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Alleen toegankelijk voor Partners en Admin (Hanna)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true },
    })
    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const details = await prisma.workloadDetail.findMany({
      where: {
        date: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      select: {
        projectName: true,
        personName: true,
        workedHours: true,
        billableHours: true,
      },
    })

    // Group by projectName
    const projectMap = new Map<string, {
      totalWorkedHours: number
      totalBillableHours: number
      members: Map<string, number>
    }>()

    for (const d of details) {
      if (!d.projectName) continue
      let project = projectMap.get(d.projectName)
      if (!project) {
        project = { totalWorkedHours: 0, totalBillableHours: 0, members: new Map() }
        projectMap.set(d.projectName, project)
      }
      project.totalWorkedHours += d.workedHours
      project.totalBillableHours += d.billableHours
      project.members.set(
        d.personName,
        (project.members.get(d.personName) || 0) + d.workedHours
      )
    }

    // Sort by total worked hours desc, take top 20
    const cases = Array.from(projectMap.entries())
      .map(([projectName, data]) => ({
        projectName,
        totalWorkedHours: Math.round(data.totalWorkedHours * 10) / 10,
        totalBillableHours: Math.round(data.totalBillableHours * 10) / 10,
        members: Array.from(data.members.entries())
          .map(([personName, workedHours]) => ({
            personName,
            workedHours: Math.round(workedHours * 10) / 10,
          }))
          .sort((a, b) => b.workedHours - a.workedHours),
      }))
      .sort((a, b) => b.totalWorkedHours - a.totalWorkedHours)
      .slice(0, 20)

    return NextResponse.json({
      cases,
      period: { startDate: startDateStr, endDate: endDateStr },
    })
  } catch (error) {
    console.error('Fout bij ophalen lopende zaken:', error)
    return NextResponse.json({ error: 'Kon lopende zaken niet ophalen' }, { status: 500 })
  }
}
