import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Single announcement (sender or admin only — used by edit modal)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const announcement = await prisma.teamAnnouncement.findUnique({
      where: { id: params.id },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const canEdit =
      announcement.senderId === session.user.id || user?.role === 'ADMIN'

    if (!canEdit) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    return NextResponse.json(announcement)
  } catch (error) {
    console.error('Error fetching announcement:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// PATCH - Edit an existing announcement (sender or ADMIN only)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const existing = await prisma.teamAnnouncement.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const canEdit =
      existing.senderId === session.user.id || user?.role === 'ADMIN'

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Alleen de afzender of een admin kan deze melding bewerken' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, message, recipientIds, priority, icon } = body

    if (!message || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'Bericht en ontvangers zijn verplicht' }, { status: 400 })
    }

    const recipients = recipientIds.includes('ALL') ? 'ALL' : JSON.stringify(recipientIds)

    const updated = await prisma.teamAnnouncement.update({
      where: { id: params.id },
      data: {
        title: title?.trim() || null,
        message,
        recipients,
        priority: priority || 'normal',
        icon: icon || null,
      },
      include: {
        sender: { select: { name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating announcement:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// DELETE - Remove an announcement (sender or ADMIN only)
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const existing = await prisma.teamAnnouncement.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const canEdit =
      existing.senderId === session.user.id || user?.role === 'ADMIN'

    if (!canEdit) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    await prisma.teamAnnouncement.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting announcement:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
