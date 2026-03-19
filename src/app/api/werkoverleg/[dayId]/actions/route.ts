import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Actiepunt toevoegen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { dayId } = await params
    const body = await request.json()
    const { description, responsibleName, deadline } = body

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Beschrijving is verplicht' }, { status: 400 })
    }

    const action = await prisma.werkoverlegAction.create({
      data: {
        dayId,
        description: description.trim(),
        responsibleName: responsibleName || 'Hele Team',
        deadline: deadline ? new Date(deadline) : null,
      },
    })

    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('POST /api/werkoverleg/[dayId]/actions error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
