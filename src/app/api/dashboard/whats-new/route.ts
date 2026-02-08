import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Dismiss the "What's New" widget for the current user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { version } = await req.json()
  if (!version || typeof version !== 'string') {
    return NextResponse.json({ error: 'Version is verplicht' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { whatsNewDismissed: version },
  })

  return NextResponse.json({ success: true })
}
