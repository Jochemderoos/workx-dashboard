import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TOTAL_WORKPLACES = 11

// GET - Haal aanwezigheid op voor een specifieke datum (of vandaag)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // Gebruik vandaag als geen datum is meegegeven
    const date = dateParam || new Date().toISOString().split('T')[0]

    // Haal alle aanwezigen op voor deze datum
    const attendances = await prisma.officeAttendance.findMany({
      where: { date },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Haal huidige gebruiker op
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    // Check of huidige gebruiker is aangemeld
    const isCurrentUserAttending = attendances.some(
      (a) => a.userId === currentUser?.id
    )

    return NextResponse.json({
      date,
      attendees: attendances.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: a.user.name,
        avatarUrl: a.user.avatarUrl,
      })),
      totalWorkplaces: TOTAL_WORKPLACES,
      occupiedWorkplaces: attendances.length,
      availableWorkplaces: TOTAL_WORKPLACES - attendances.length,
      isCurrentUserAttending,
      currentUserId: currentUser?.id,
    })
  } catch (error: any) {
    console.error('Error fetching office attendance:', error?.message || error)
    return NextResponse.json({ error: 'Server error: ' + (error?.message || 'Unknown') }, { status: 500 })
  }
}

// POST - Aanmelden voor kantoor
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('POST office-attendance: No session')
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    console.log('POST office-attendance: User email:', session.user.email)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user) {
      console.log('POST office-attendance: User not found in DB')
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
    }

    const body = await request.json()
    // Use local date format
    const now = new Date()
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const date = body.date || defaultDate

    console.log('POST office-attendance: Date:', date, 'UserId:', user.id)

    // Check of gebruiker al aangemeld is
    const existing = await prisma.officeAttendance.findFirst({
      where: {
        userId: user.id,
        date,
      },
    })

    if (existing) {
      console.log('POST office-attendance: Already registered')
      return NextResponse.json({
        success: true,
        attendance: existing,
        message: 'Al aangemeld',
      })
    }

    // Check of er nog plek is
    const currentCount = await prisma.officeAttendance.count({
      where: { date },
    })

    console.log('POST office-attendance: Current count:', currentCount)

    if (currentCount >= TOTAL_WORKPLACES) {
      return NextResponse.json(
        { error: 'Geen werkplekken meer beschikbaar' },
        { status: 400 }
      )
    }

    // Aanmelden
    const attendance = await prisma.officeAttendance.create({
      data: {
        userId: user.id,
        date,
      },
    })

    console.log('POST office-attendance: Created:', attendance.id)

    return NextResponse.json({
      success: true,
      attendance,
    })
  } catch (error: any) {
    console.error('Error registering office attendance:', error?.message || error)
    return NextResponse.json({ error: 'Server error: ' + (error?.message || 'Unknown') }, { status: 500 })
  }
}

// DELETE - Afmelden van kantoor
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Verwijder aanmelding
    await prisma.officeAttendance.deleteMany({
      where: {
        userId: user.id,
        date,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing office attendance:', error?.message || error)
    return NextResponse.json({ error: 'Server error: ' + (error?.message || 'Unknown') }, { status: 500 })
  }
}
