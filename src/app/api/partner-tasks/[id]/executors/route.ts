// Uitvoerders toevoegen/verwijderen aan een PartnerTask.
// Toegankelijk voor alle ingelogde users (Wie doet Wat is collaboratief).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json()
    const userId = typeof body.userId === 'string' ? body.userId : null
    if (!userId) return NextResponse.json({ error: 'userId verplicht' }, { status: 400 })

    const task = await prisma.partnerTask.findUnique({ where: { id: params.id } })
    if (!task) return NextResponse.json({ error: 'Taak niet gevonden' }, { status: 404 })

    await prisma.partnerTaskExecutor.upsert({
      where: { taskId_userId: { taskId: params.id, userId } },
      update: {},
      create: { taskId: params.id, userId },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('partner-tasks executors POST failed', err)
    return NextResponse.json({ error: 'Kon uitvoerder niet toevoegen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId verplicht' }, { status: 400 })
  try {
    await prisma.partnerTaskExecutor.deleteMany({
      where: { taskId: params.id, userId },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('partner-tasks executors DELETE failed', err)
    return NextResponse.json({ error: 'Kon uitvoerder niet verwijderen' }, { status: 500 })
  }
}
