import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// JAR Rooster 2026
const JAR_SCHEDULE_2026 = [
  { date: '2026-02-12', name: 'Wies' },
  { date: '2026-03-05', name: 'Alain' },
  { date: '2026-03-26', name: 'Julia' },
  { date: '2026-04-16', name: 'Marnix' },
  { date: '2026-05-07', name: 'Heleen' },
  { date: '2026-05-28', name: 'Marlieke' },
  { date: '2026-06-18', name: 'Emma' },
  { date: '2026-07-09', name: 'Maaike' },
  { date: '2026-07-30', name: 'Kay' },
  { date: '2026-08-20', name: 'Jochem' },
  { date: '2026-09-10', name: 'Barbara' },
  { date: '2026-10-01', name: 'Erika' },
  { date: '2026-10-22', name: 'Justine' },
  { date: '2026-11-12', name: 'Bas' },
  { date: '2026-12-03', name: 'Juliette' },
  { date: '2026-12-24', name: 'Wies' },
]

// POST - Seed JAR events (one-time use)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if JAR events already exist for 2026
    const existingJarEvents = await prisma.calendarEvent.findMany({
      where: {
        title: { startsWith: 'JAR' },
        startTime: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-12-31'),
        },
      },
    })

    if (existingJarEvents.length > 0) {
      return NextResponse.json({
        message: `JAR events already exist (${existingJarEvents.length} found). Delete them first to re-seed.`,
        count: existingJarEvents.length
      }, { status: 200 })
    }

    // Create all JAR events
    const createdEvents = await Promise.all(
      JAR_SCHEDULE_2026.map(async (jar) => {
        const startDate = new Date(jar.date)
        // JAR meetings from 16:00-17:00
        startDate.setHours(16, 0, 0, 0)

        const endDate = new Date(jar.date)
        endDate.setHours(17, 0, 0, 0)

        return prisma.calendarEvent.create({
          data: {
            title: `JAR - ${jar.name}`,
            description: `JAR beurt van ${jar.name}`,
            startTime: startDate,
            endTime: endDate,
            isAllDay: false,
            location: 'Vergaderruimte',
            color: '#60a5fa', // Blue color for JAR events
            category: 'MEETING',
            createdById: session.user.id,
          },
        })
      })
    )

    return NextResponse.json({
      message: 'JAR rooster 2026 succesvol toegevoegd',
      count: createdEvents.length,
      events: createdEvents.map(e => ({ date: e.startTime, title: e.title }))
    }, { status: 201 })
  } catch (error) {
    console.error('Error seeding JAR events:', error)
    return NextResponse.json({ error: 'Failed to seed JAR events' }, { status: 500 })
  }
}

// DELETE - Remove all JAR events for 2026 (to allow re-seeding)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const result = await prisma.calendarEvent.deleteMany({
      where: {
        title: { startsWith: 'JAR' },
        startTime: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-12-31'),
        },
      },
    })

    return NextResponse.json({
      message: 'JAR events verwijderd',
      count: result.count
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting JAR events:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen JAR events' }, { status: 500 })
  }
}
