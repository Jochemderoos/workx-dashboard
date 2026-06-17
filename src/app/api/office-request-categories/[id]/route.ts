// Categorie bijwerken / verwijderen. Alleen Office team.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditOffice } from '@/lib/office-team'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canEditOffice(session)) return NextResponse.json({ error: 'Alleen Office-team' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const data: Record<string, unknown> = {}
  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body?.emoji === 'string') data.emoji = body.emoji.trim().slice(0, 4) || null
  if (typeof body?.sortOrder === 'number') data.sortOrder = body.sortOrder

  // Bij rename: bestaande OfficeRequests bijwerken
  const before = await prisma.officeRequestCategory.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  try {
    const cat = await prisma.officeRequestCategory.update({ where: { id: params.id }, data })
    if (typeof data.name === 'string' && data.name !== before.name) {
      await prisma.officeRequest.updateMany({
        where: { category: before.name },
        data: { category: data.name as string },
      })
    }
    return NextResponse.json(cat)
  } catch (err: any) {
    if (err?.code === 'P2002') return NextResponse.json({ error: 'Naam bestaat al' }, { status: 400 })
    console.error('Category update failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canEditOffice(session)) return NextResponse.json({ error: 'Alleen Office-team' }, { status: 403 })

  const cat = await prisma.officeRequestCategory.findUnique({ where: { id: params.id } })
  if (!cat) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  // Verzet bestaande verzoeken naar 'Overig'
  await prisma.officeRequest.updateMany({
    where: { category: cat.name },
    data: { category: 'Overig' },
  })
  await prisma.officeRequestCategory.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
