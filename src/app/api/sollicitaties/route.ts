import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
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

  const status = req.nextUrl.searchParams.get('status')

  const applicants = await prisma.applicant.findMany({
    where: status ? { status } : undefined,
    include: {
      documents: true,
      interviews: { orderBy: { datum: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(applicants)
}

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const { naam, email, telefoon, huidigeFunctie, huidigeWerkgever } = body

  if (!naam?.trim()) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const applicant = await prisma.applicant.create({
    data: {
      naam: naam.trim(),
      email: email?.trim() || null,
      telefoon: telefoon?.trim() || null,
      huidigeFunctie: huidigeFunctie?.trim() || null,
      huidigeWerkgever: huidigeWerkgever?.trim() || null,
    },
  })

  return NextResponse.json(applicant, { status: 201 })
}
