// Eigen week-intake voor de huidige target-week.
// GET → { intake, targetWeekStart, windowOpenAt, windowCloseAt, isOpen }
// PUT body: { work, availability?, notes? } → upsert eigen intake (alleen als window open)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getTargetWeekStart,
  getWindowOpenAt,
  getWindowCloseAt,
  isWindowOpen,
  toDateOnly,
} from '@/lib/week-intake'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const now = new Date()
    const target = getTargetWeekStart(now)
    const dateOnly = toDateOnly(target)

    const intake = await prisma.weekIntake.findUnique({
      where: { userId_weekStartDate: { userId: session.user.id, weekStartDate: dateOnly } },
    })

    return NextResponse.json({
      intake,
      targetWeekStart: target.toISOString(),
      windowOpenAt: getWindowOpenAt(target).toISOString(),
      windowCloseAt: getWindowCloseAt(target).toISOString(),
      isOpen: isWindowOpen(now, target),
    })
  } catch (error) {
    console.error('Error loading week intake:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    // Doorlopend bewerkbaar: het venster bepaalt alleen wélke week je bewerkt
    // (deze of volgende), niet óf je mag bewerken.
    const now = new Date()
    const target = getTargetWeekStart(now)

    const body = await req.json()
    const work = typeof body.work === 'string' ? body.work.trim() : ''
    if (!work) {
      return NextResponse.json({ error: '"Wat heb je liggen" mag niet leeg zijn' }, { status: 400 })
    }
    const availability = body.availability == null || body.availability === '' ? null
      : typeof body.availability === 'string' ? body.availability.trim() : null
    const notes = body.notes == null || body.notes === '' ? null
      : typeof body.notes === 'string' ? body.notes.trim() : null

    const dateOnly = toDateOnly(target)
    const intake = await prisma.weekIntake.upsert({
      where: { userId_weekStartDate: { userId: session.user.id, weekStartDate: dateOnly } },
      create: {
        userId: session.user.id,
        weekStartDate: dateOnly,
        work,
        availability,
        notes,
        submittedAt: now,
      },
      update: {
        work,
        availability,
        notes,
        submittedAt: now,
      },
    })

    return NextResponse.json(intake)
  } catch (error) {
    console.error('Error saving week intake:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
