import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Check of de gebruiker de nieuwsbrief mag beheren:
// (a) PARTNER of ADMIN, of
// (b) de responsibleId van een Responsibility met "nieuwsbrief" in de task
async function canManageNewsletter(userId: string, userRole: string): Promise<boolean> {
  if (['PARTNER', 'ADMIN'].includes(userRole)) return true

  const newsletterResponsibility = await prisma.responsibility.findFirst({
    where: {
      responsibleId: userId,
      task: { contains: 'nieuwsbrief', mode: 'insensitive' },
    },
  })

  return !!newsletterResponsibility
}

// GET - Alle assignments ophalen (voor iedereen)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const assignments = await prisma.newsletterAssignment.findMany({
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { deadline: 'asc' },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error fetching newsletter assignments:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Nieuw assignment toevoegen
export async function POST(req: NextRequest) {
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

    const hasAccess = await canManageNewsletter(user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { assigneeId, deadline, topic } = await req.json()

    if (!assigneeId || !deadline) {
      return NextResponse.json({ error: 'Teamlid en deadline zijn verplicht' }, { status: 400 })
    }

    const assignment = await prisma.newsletterAssignment.create({
      data: {
        assigneeId,
        deadline: new Date(deadline),
        topic: topic || null,
        createdById: user.id,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error creating newsletter assignment:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH - Status bijwerken
export async function PATCH(req: NextRequest) {
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

    const hasAccess = await canManageNewsletter(user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'ID en status zijn verplicht' }, { status: 400 })
    }

    if (!['PENDING', 'SUBMITTED'].includes(status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
    }

    const updated = await prisma.newsletterAssignment.update({
      where: { id },
      data: { status },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating newsletter assignment:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Assignment verwijderen
export async function DELETE(req: NextRequest) {
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

    const hasAccess = await canManageNewsletter(user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    await prisma.newsletterAssignment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting newsletter assignment:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
