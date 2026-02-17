import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Mark a werkverdelingsgesprek as completed
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await request.json()
    const { weekId, partnerName, employeeId, employeeName } = body

    if (!weekId || !partnerName || !employeeId || !employeeName) {
      return NextResponse.json(
        { error: 'weekId, partnerName, employeeId en employeeName zijn verplicht' },
        { status: 400 }
      )
    }

    const completion = await prisma.conversationCompletion.upsert({
      where: {
        weekId_partnerName_employeeId: {
          weekId,
          partnerName,
          employeeId,
        },
      },
      update: {
        completedAt: new Date(),
        completedBy: session.user.id,
      },
      create: {
        weekId,
        partnerName,
        employeeId,
        employeeName,
        completedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, completion })
  } catch (error) {
    console.error('Error completing werkverdelingsgesprek:', error)
    return NextResponse.json(
      { error: 'Kon gesprek niet als afgerond markeren' },
      { status: 500 }
    )
  }
}
