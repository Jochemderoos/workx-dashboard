// Input/feedback op de Workx-film.
// - GET    : alle reacties (oudste eerst), iedereen die is ingelogd
// - POST   : reactie plaatsen { message }
// - DELETE ?id : eigen reactie (of PARTNER/ADMIN)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const feedback = await prisma.filmFeedback.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ feedback })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Leeg bericht' }, { status: 400 })
  if (message.length > 4000) return NextResponse.json({ error: 'Te lang' }, { status: 400 })

  const created = await prisma.filmFeedback.create({
    data: { userId: session.user.id, userName: session.user.name || 'Onbekend', message },
  })
  return NextResponse.json(created)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const item = await prisma.filmFeedback.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const role = (session.user.role || '') as string
  const isManager = role === 'PARTNER' || role === 'ADMIN'
  if (item.userId !== session.user.id && !isManager) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  await prisma.filmFeedback.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
