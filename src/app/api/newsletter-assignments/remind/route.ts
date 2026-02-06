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

// POST - Push een reminder naar de assignee
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

    const { assignmentId } = await req.json()

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is verplicht' }, { status: 400 })
    }

    const updated = await prisma.newsletterAssignment.update({
      where: { id: assignmentId },
      data: {
        reminderPushedAt: new Date(),
        reminderPushedBy: user.id,
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error pushing newsletter reminder:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
