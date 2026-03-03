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

    // Haal de 3 meest recente weken op
    const weeks = await prisma.meetingWeek.findMany({
      orderBy: { meetingDate: 'desc' },
      take: 3,
      include: {
        distributions: true,
        conversations: true,
      },
    })

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
