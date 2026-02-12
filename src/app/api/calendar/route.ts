import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDutchHolidays, getHolidayName } from '@/lib/vacation-utils'

export const revalidate = 60 // 1 minute cache

// GET - Fetch calendar events (optionally including vacations)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const upcoming = searchParams.get('upcoming')
    const includeVacations = searchParams.get('includeVacations') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build date filter for events
    const dateFilter = startDate && endDate ? {
      OR: [
        { startTime: { gte: new Date(startDate), lte: new Date(endDate) } },
        { endTime: { gte: new Date(startDate), lte: new Date(endDate) } },
        { AND: [{ startTime: { lte: new Date(startDate) } }, { endTime: { gte: new Date(endDate) } }] }
      ]
    } : upcoming === 'true' ? { startTime: { gte: new Date() } } : {}

    // Fetch calendar events
    const events = await prisma.calendarEvent.findMany({
      where: dateFilter,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startTime: 'asc' },
      take: limit,
    })

    // If includeVacations is true, also fetch approved vacation requests
    if (includeVacations) {
      const vacationFilter = startDate && endDate ? {
        status: 'APPROVED',
        OR: [
          { startDate: { gte: new Date(startDate), lte: new Date(endDate) } },
          { endDate: { gte: new Date(startDate), lte: new Date(endDate) } },
          { AND: [{ startDate: { lte: new Date(startDate) } }, { endDate: { gte: new Date(endDate) } }] }
        ]
      } : upcoming === 'true' ? {
        status: 'APPROVED',
        endDate: { gte: new Date() }
      } : { status: 'APPROVED' }

      // Also fetch vacation periods
      const periodFilter = startDate && endDate ? {
        OR: [
          { startDate: { gte: new Date(startDate), lte: new Date(endDate) } },
          { endDate: { gte: new Date(startDate), lte: new Date(endDate) } },
          { AND: [{ startDate: { lte: new Date(startDate) } }, { endDate: { gte: new Date(endDate) } }] }
        ]
      } : upcoming === 'true' ? {
        endDate: { gte: new Date() }
      } : {}

      // Run vacation and period queries in parallel
      const [vacations, vacationPeriods] = await Promise.all([
        prisma.vacationRequest.findMany({
          where: vacationFilter,
          include: { user: { select: { id: true, name: true } } },
          orderBy: { startDate: 'asc' },
        }),
        prisma.vacationPeriod.findMany({
          where: periodFilter,
          include: { user: { select: { id: true, name: true } } },
          orderBy: { startDate: 'asc' },
        }),
      ])

      // Convert vacations to calendar event format
      const vacationEvents = vacations.map(v => ({
        id: `vacation-${v.id}`,
        title: `🏖️ ${v.user.name} - Vakantie`,
        description: v.reason || `${v.days} dag${v.days !== 1 ? 'en' : ''} vakantie`,
        startTime: v.startDate,
        endTime: v.endDate,
        isAllDay: true,
        location: null,
        color: '#22c55e', // Green for vacations
        category: 'VACATION',
        createdBy: v.user,
        isVacation: true, // Flag to identify vacation events
        isPeriod: false,
        vacationId: v.id,
      }))

      // Convert vacation periods to calendar event format
      const periodEvents = vacationPeriods.map(p => ({
        id: `period-${p.id}`,
        title: `🏖️ ${p.user.name} - Vakantie`,
        description: p.note || `${p.days} dag${p.days !== 1 ? 'en' : ''} vakantie`,
        startTime: p.startDate,
        endTime: p.endDate,
        isAllDay: true,
        location: null,
        color: '#22c55e', // Green for vacations
        category: 'VACATION',
        createdBy: p.user,
        isVacation: true,
        isPeriod: true, // Flag to identify period events
        periodId: p.id,
      }))

      // Get Dutch national holidays for the date range
      const holidayEvents: any[] = []
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        // Get holidays for all years in the range
        for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
          const holidays = getDutchHolidays(year)
          holidays.forEach(h => {
            if (h >= start && h <= end) {
              const name = getHolidayName(h)
              if (name) {
                holidayEvents.push({
                  id: `holiday-${h.toISOString().split('T')[0]}`,
                  title: `🎉 ${name}`,
                  description: 'Nationale feestdag',
                  startTime: h,
                  endTime: h,
                  isAllDay: true,
                  location: null,
                  color: '#f59e0b', // Amber/orange for holidays
                  category: 'HOLIDAY',
                  createdBy: null,
                  isHoliday: true,
                })
              }
            }
          })
        }
      }

      // Merge and sort by start time
      const allEvents = [...events, ...vacationEvents, ...periodEvents, ...holidayEvents].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )

      return NextResponse.json(allEvents.slice(0, limit))
    }

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Kon niet ophalen events' }, { status: 500 })
  }
}

// POST - Create a new calendar event
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { title, description, startTime, endTime, isAllDay, location, color, category } = await req.json()

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'Title, start time, and end time are required' }, { status: 400 })
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isAllDay: isAllDay || false,
        location,
        color: color || '#f9ff85',
        category: category || 'GENERAL',
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } }
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken event' }, { status: 500 })
  }
}
