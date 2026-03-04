import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { id } = await params

  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      interviews: { orderBy: { datum: 'desc' } },
    },
  })

  if (!applicant) {
    return NextResponse.json({ error: 'Sollicitant niet gevonden' }, { status: 404 })
  }

  return NextResponse.json(applicant)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const body = await req.json()

  const applicant = await prisma.applicant.update({
    where: { id },
    data: {
      ...(body.naam !== undefined && { naam: body.naam }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.telefoon !== undefined && { telefoon: body.telefoon }),
      ...(body.geboortedatum !== undefined && { geboortedatum: body.geboortedatum }),
      ...(body.adres !== undefined && { adres: body.adres }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
      ...(body.huidigeWerkgever !== undefined && { huidigeWerkgever: body.huidigeWerkgever }),
      ...(body.huidigeFunctie !== undefined && { huidigeFunctie: body.huidigeFunctie }),
      ...(body.opleiding !== undefined && { opleiding: body.opleiding }),
      ...(body.ervaring !== undefined && { ervaring: body.ervaring }),
      ...(body.vaardigheden !== undefined && { vaardigheden: body.vaardigheden }),
      ...(body.talen !== undefined && { talen: body.talen }),
      ...(body.cvSummary !== undefined && { cvSummary: body.cvSummary }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.notities !== undefined && { notities: body.notities }),
    },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      interviews: { orderBy: { datum: 'desc' } },
    },
  })

  return NextResponse.json(applicant)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  await prisma.applicant.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
