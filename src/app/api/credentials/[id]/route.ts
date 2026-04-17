import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { service, category, username, password, url, notes } = await request.json()

    if (!service?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Service en wachtwoord zijn verplicht' }, { status: 400 })
    }

    const updated = await prisma.sharedCredential.update({
      where: { id: params.id },
      data: {
        service: service.trim(),
        category: category?.trim() || 'Overig',
        username: username?.trim() || null,
        password: password.trim(),
        url: url?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { addedBy: { select: { name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating credential:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    await prisma.sharedCredential.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting credential:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
