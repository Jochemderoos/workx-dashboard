import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get a single event
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      include: { createdBy: { select: { id: true, name: true } } }
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

// PATCH - Update an event
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is creator or admin/partner
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: params.id }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isOwner = existingEvent.createdById === session.user.id
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'PARTNER'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Je kunt alleen je eigen events bewerken' }, { status: 403 })
    }

    const data = await req.json()
    const event = await prisma.calendarEvent.update({
      where: { id: params.id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.color && { color: data.color }),
        ...(data.category && { category: data.category }),
      },
      include: { createdBy: { select: { id: true, name: true } } }
    })
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

// DELETE - Delete an event
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is creator or admin/partner
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: params.id }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isOwner = existingEvent.createdById === session.user.id
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'PARTNER'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Je kunt alleen je eigen events verwijderen' }, { status: 403 })
    }

    await prisma.calendarEvent.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
