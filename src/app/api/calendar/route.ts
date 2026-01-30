import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEV_USER } from '@/lib/dev-auth'

// GET - Fetch calendar events
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const upcoming = searchParams.get('upcoming')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (upcoming === 'true') {
      const events = await prisma.calendarEvent.findMany({
        where: { startTime: { gte: new Date() } },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { startTime: 'asc' },
        take: limit,
      })
      return NextResponse.json(events)
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        ...(startDate && endDate && {
          OR: [
            { startTime: { gte: new Date(startDate), lte: new Date(endDate) } },
            { endTime: { gte: new Date(startDate), lte: new Date(endDate) } },
            { AND: [{ startTime: { lte: new Date(startDate) } }, { endTime: { gte: new Date(endDate) } }] }
          ]
        })
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { startTime: 'asc' },
      take: limit,
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

// POST - Create a new calendar event
export async function POST(req: NextRequest) {
  try {
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
        createdById: DEV_USER.id,
      },
      include: { createdBy: { select: { id: true, name: true } } }
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
