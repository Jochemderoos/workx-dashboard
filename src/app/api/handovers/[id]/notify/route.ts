import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id } = await params

    const handover = await prisma.handover.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        cases: { select: { dossiernaam: true } },
      },
    })

    if (!handover) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const start = handover.periodStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
    const end = handover.periodEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    const caseCount = handover.cases.length
    const caseSummary = caseCount > 0
      ? `${caseCount} ${caseCount === 1 ? 'zaak' : 'zaken'} overgedragen`
      : 'Geen specifieke zaken'

    await Promise.all([
      prisma.handover.update({
        where: { id },
        data: { notifiedAt: new Date() },
      }),
      prisma.teamAnnouncement.create({
        data: {
          senderId: session.user.id,
          title: `Overdracht ${handover.user.name}`,
          message: `${handover.user.name} is afwezig van ${start} t/m ${end}. ${caseSummary}. Bekijk de overdracht voor details.`,
          recipients: 'ALL',
          priority: 'normal',
          icon: '📋',
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error notifying handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
