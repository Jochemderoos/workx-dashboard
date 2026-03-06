import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Notificatie versturen voor een overdrachtsdocument
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id } = await params

    const handover = await prisma.handover.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!handover) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    await prisma.handover.update({
      where: { id },
      data: { notifiedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error notifying handover:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
