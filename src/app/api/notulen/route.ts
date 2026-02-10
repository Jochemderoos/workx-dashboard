import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const months = await prisma.meetingMonth.findMany({
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      include: {
        _count: {
          select: { weeks: true },
        },
      },
    })

    return NextResponse.json(months)
  } catch (error) {
    console.error('Error fetching meeting months:', error)
    return NextResponse.json(
      { error: 'Kon notulen maanden niet ophalen' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { year, month, label, isLustrum } = await req.json()

    if (!year || !month || !label) {
      return NextResponse.json(
        { error: 'Jaar, maand en label zijn verplicht' },
        { status: 400 }
      )
    }

    const meetingMonth = await prisma.meetingMonth.create({
      data: {
        year,
        month,
        label,
        isLustrum: isLustrum ?? false,
      },
    })

    return NextResponse.json(meetingMonth, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting month:', error)
    return NextResponse.json(
      { error: 'Kon notulen maand niet aanmaken' },
      { status: 500 }
    )
  }
}
