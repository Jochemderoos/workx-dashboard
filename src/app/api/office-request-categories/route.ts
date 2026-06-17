// Beheer van categorieën voor Office-verzoeken.
// GET: iedereen
// POST/PATCH/DELETE: alleen Office team

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditOffice } from '@/lib/office-team'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const categories = await prisma.officeRequestCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canEditOffice(session)) return NextResponse.json({ error: 'Alleen Office-team' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const emoji = body?.emoji ? String(body.emoji).trim().slice(0, 4) : null
  if (!name) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })

  // Hoogste sortOrder + 10 zodat 'Overig' (999) onderaan blijft
  const max = await prisma.officeRequestCategory.aggregate({
    _max: { sortOrder: true },
    where: { name: { not: 'Overig' } },
  })
  const sortOrder = ((max._max.sortOrder || 0) + 10)

  try {
    const cat = await prisma.officeRequestCategory.create({
      data: { name, emoji, sortOrder },
    })
    return NextResponse.json(cat)
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Categorie bestaat al' }, { status: 400 })
    }
    console.error('Category create failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
