// Mailchimp-contactlijst.
// - GET    : alle contacten (iedereen die is ingelogd)
// - POST   : contact aandragen { name, email, phone?, company? } (iedereen)
// - PATCH ?id : afvinken/terugzetten "toegevoegd aan Mailchimp" (office/partners)
// - DELETE ?id : verwijderen (eigen aandraag, of office/partners)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Office (Hanna/Lotte/Bente = ADMIN) + partners mogen afvinken/beheren.
function canManage(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'PARTNER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const contacts = await prisma.mailchimpContact.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ contacts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const company = typeof body.company === 'string' ? body.company.trim() : ''

  if (!name) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Geldig e-mailadres is verplicht' }, { status: 400 })

  const created = await prisma.mailchimpContact.create({
    data: {
      name,
      email,
      phone: phone || null,
      company: company || null,
      addedById: session.user.id,
      addedByName: session.user.name || 'Onbekend',
    },
  })
  return NextResponse.json(created, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: 'Alleen office (Hanna/Lotte/Bente) of partners kunnen afvinken' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const addedToMailchimp = !!body.addedToMailchimp

  const item = await prisma.mailchimpContact.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const updated = await prisma.mailchimpContact.update({
    where: { id },
    data: addedToMailchimp
      ? { addedToMailchimp: true, processedById: session.user.id, processedByName: session.user.name || 'Onbekend', processedAt: new Date() }
      : { addedToMailchimp: false, processedById: null, processedByName: null, processedAt: null },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const item = await prisma.mailchimpContact.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  if (item.addedById !== session.user.id && !canManage(session.user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  await prisma.mailchimpContact.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
