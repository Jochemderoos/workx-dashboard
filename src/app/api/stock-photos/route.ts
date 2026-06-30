// Stock-foto's — professionele kantoorfoto's die het hele team kan downloaden
// en gebruiken (nieuwsbrief, pitch, social).
// - GET    : alle foto's (iedereen die is ingelogd)
// - POST   : nieuwe foto uploaden (PARTNER/ADMIN/OFFICE_MANAGER) — multipart formData
// - DELETE : foto verwijderen (uploader zelf of beheerder)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

const MANAGER_ROLES = ['PARTNER', 'ADMIN', 'OFFICE_MANAGER']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const photos = await prisma.stockPhoto.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: { uploadedBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(photos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!MANAGER_ROLES.includes((session.user.role || '') as string)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null)?.trim() || null
    const category = (formData.get('category') as string | null)?.trim() || null

    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Alleen afbeeldingen' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximaal 15 MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `stock-fotos/${Date.now()}-${session.user.id.slice(0, 6)}.${ext}`
    const blob = await put(filename, file, { access: 'public', addRandomSuffix: true })

    const photo = await prisma.stockPhoto.create({
      data: { url: blob.url, title, category, uploadedById: session.user.id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(photo)
  } catch (err) {
    console.error('stock-photos upload failed', err)
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const photo = await prisma.stockPhoto.findUnique({ where: { id } })
  if (!photo) return NextResponse.json({ error: 'Foto niet gevonden' }, { status: 404 })

  const isOwner = photo.uploadedById === session.user.id
  const isManager = MANAGER_ROLES.includes((session.user.role || '') as string)
  if (!isOwner && !isManager) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  await prisma.stockPhoto.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
