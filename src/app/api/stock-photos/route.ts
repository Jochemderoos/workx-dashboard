// Stock-foto's — professionele kantoorfoto's die het hele team kan downloaden
// en gebruiken (nieuwsbrief, pitch, social).
// - GET    : alle foto's (iedereen die is ingelogd)
// - POST   : nieuwe foto uploaden (PARTNER/ADMIN/OFFICE_MANAGER) — multipart formData
// - DELETE : foto verwijderen (uploader zelf of beheerder)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Alleen partners en Hanna (ADMIN) mogen stock-foto's toevoegen/verwijderen.
const MANAGER_ROLES = ['PARTNER', 'ADMIN']

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

// De foto wordt door de client rechtstreeks naar Vercel Blob geüpload
// (via /api/upload — tot 50MB, geen compressie, volledige kwaliteit blijft
// behouden). Hier registreren we alleen de metadata (url/titel/categorie).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!MANAGER_ROLES.includes((session.user.role || '') as string)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null

    if (!url) return NextResponse.json({ error: 'Geen url' }, { status: 400 })

    const photo = await prisma.stockPhoto.create({
      data: { url, title, category, uploadedById: session.user.id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(photo)
  } catch (err) {
    console.error('stock-photos create failed', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
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
