import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Dismiss een reminder (alleen door de assignee zelf)
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

    const { assignmentId } = await req.json()

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is verplicht' }, { status: 400 })
    }

    // Controleer of de huidige gebruiker de assignee is
    const assignment = await prisma.newsletterAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment niet gevonden' }, { status: 404 })
    }

    if (assignment.assigneeId !== user.id) {
      return NextResponse.json({ error: 'Je kunt alleen je eigen reminders dismissn' }, { status: 403 })
    }

    const updated = await prisma.newsletterAssignment.update({
      where: { id: assignmentId },
      data: {
        reminderDismissed: true,
      },
    })

    return NextResponse.json({ success: true, id: updated.id })
  } catch (error) {
    console.error('Error dismissing newsletter reminder:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
