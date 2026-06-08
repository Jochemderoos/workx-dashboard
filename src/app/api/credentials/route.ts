import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Alle actieve medewerkers hebben toegang tot gedeelde werk-wachtwoorden
    // (juridische databases, etc.). Beheer (POST/PATCH/DELETE) blijft
    // beperkt tot PARTNER/ADMIN.
    const credentials = await prisma.sharedCredential.findMany({
      include: { addedBy: { select: { name: true } } },
      orderBy: [{ category: 'asc' }, { service: 'asc' }],
    })

    return NextResponse.json(credentials)
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'Alleen partners en admins mogen wachtwoorden toevoegen' }, { status: 403 })
    }

    const { service, category, username, password, url, notes } = await request.json()

    if (!service?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Service en wachtwoord zijn verplicht' }, { status: 400 })
    }

    const credential = await prisma.sharedCredential.create({
      data: {
        service: service.trim(),
        category: category?.trim() || 'Overig',
        username: username?.trim() || null,
        password: password.trim(),
        url: url?.trim() || null,
        notes: notes?.trim() || null,
        addedById: session.user.id,
      },
      include: { addedBy: { select: { name: true } } },
    })

    return NextResponse.json(credential)
  } catch (error) {
    console.error('Error creating credential:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
