import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Selectie: eerstvolgende toekomstige vergadering (incl. vandaag)
    // + de 2 voorgaande weken voor context. Chronologisch terug naar
    // de client zodat de meest recente tab rechts staat.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const upcoming = await prisma.meetingWeek.findFirst({
      where: { meetingDate: { gte: todayStart } },
      orderBy: { meetingDate: 'asc' },
      include: { distributions: true, conversations: true },
    })

    const cutoff = upcoming?.meetingDate ?? new Date()
    const previousWeeks = await prisma.meetingWeek.findMany({
      where: { meetingDate: { lt: cutoff } },
      orderBy: { meetingDate: 'desc' },
      take: upcoming ? 2 : 3,
      include: { distributions: true, conversations: true },
    })

    const weeks = upcoming
      ? [...previousWeeks.reverse(), upcoming]
      : previousWeeks.reverse()

    // Haal alle actieve medewerkers op
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
    })

    return NextResponse.json({ weeks, employees })
  } catch (error) {
    console.error('Error fetching work conversations:', error)
    return NextResponse.json(
      { error: 'Kon gesprekken niet ophalen' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId, employeeId, employeeName, partnerName, capacity, notes } = await req.json()

    if (!weekId || !employeeId || !employeeName || !partnerName) {
      return NextResponse.json(
        { error: 'weekId, employeeId, employeeName en partnerName zijn verplicht' },
        { status: 400 }
      )
    }

    const conversation = await prisma.workConversation.upsert({
      where: {
        weekId_employeeId: { weekId, employeeId },
      },
      create: {
        weekId,
        employeeId,
        employeeName,
        partnerName,
        capacity: capacity || null,
        notes: notes || null,
      },
      update: {
        partnerName,
        capacity: capacity || null,
        notes: notes || null,
      },
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error saving work conversation:', error)
    return NextResponse.json(
      { error: 'Kon gesprek niet opslaan' },
      { status: 500 }
    )
  }
}
