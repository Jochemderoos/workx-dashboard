import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch training sessions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const upcoming = searchParams.get('upcoming') === 'true'

    const whereClause = upcoming
      ? { date: { gte: new Date() } }
      : {
          date: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        }

    const sessions = await prisma.trainingSession.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        attendances: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching training sessions:', error)
    return NextResponse.json({ error: 'Kon niet ophalen training sessions' }, { status: 500 })
  }
}

// POST - Create a new training session
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { title, speaker, date, startTime, endTime, location, description, points } = body

    if (!title || !speaker || !date) {
      return NextResponse.json({ error: 'Title, speaker, and date are required' }, { status: 400 })
    }

    const trainingSession = await prisma.trainingSession.create({
      data: {
        title,
        speaker,
        date: new Date(date),
        startTime,
        endTime,
        location,
        description,
        points: points || 1,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(trainingSession, { status: 201 })
  } catch (error) {
    console.error('Error creating training session:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken training session' }, { status: 500 })
  }
}

// PUT - Update a training session
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { id, title, speaker, date, startTime, endTime, location, description, points } = body

    if (!id || !title || !date) {
      return NextResponse.json({ error: 'ID, titel en datum zijn verplicht' }, { status: 400 })
    }

    const updated = await prisma.trainingSession.update({
      where: { id },
      data: {
        title,
        speaker: speaker || '-',
        date: new Date(date),
        startTime: startTime || null,
        endTime: endTime || null,
        location: location || null,
        description: description || null,
        points: points || 1,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        attendances: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating training session:', error)
    return NextResponse.json({ error: 'Kon sessie niet bijwerken' }, { status: 500 })
  }
}

// PATCH - Update attendance for a training session
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, attendeeIds } = body as { sessionId: string; attendeeIds: string[] }

    if (!sessionId || !Array.isArray(attendeeIds)) {
      return NextResponse.json({ error: 'sessionId en attendeeIds zijn verplicht' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.trainingAttendance.deleteMany({
        where: { trainingSessionId: sessionId },
      }),
      prisma.trainingAttendance.createMany({
        data: attendeeIds.map((userId) => ({
          trainingSessionId: sessionId,
          userId,
        })),
      }),
    ])

    const updated = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        createdBy: { select: { id: true, name: true } },
        attendances: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating attendance:', error)
    return NextResponse.json({ error: 'Kon aanwezigheid niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete a training session
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Session ID is verplicht' }, { status: 400 })
    }

    // Check if user is the creator or admin
    const existingSession = await prisma.trainingSession.findUnique({
      where: { id },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = user?.role === 'PARTNER' || user?.role === 'ADMIN'
    const isCreator = existingSession.createdById === session.user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'Not authorized to delete this session' }, { status: 403 })
    }

    await prisma.trainingSession.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting training session:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen training session' }, { status: 500 })
  }
}
