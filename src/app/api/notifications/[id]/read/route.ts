import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Mark a single notification as read
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { id: notificationKey } = await params

    await prisma.notificationDismissal.upsert({
      where: {
        userId_notificationKey: {
          userId: session.user.id,
          notificationKey,
        },
      },
      update: {
        dismissedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        notificationKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
