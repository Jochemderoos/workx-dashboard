import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; intId: string }> }
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

  const { intId } = await params
  const body = await req.json()

  const interview = await prisma.applicantInterview.update({
    where: { id: intId },
    data: {
      ...(body.datum !== undefined && { datum: new Date(body.datum) }),
      ...(body.interviewerIds !== undefined && { interviewerIds: body.interviewerIds }),
      ...(body.interviewerNames !== undefined && { interviewerNames: body.interviewerNames }),
      ...(body.feedback !== undefined && { feedback: body.feedback }),
      ...(body.aandachtspunten !== undefined && { aandachtspunten: body.aandachtspunten }),
      ...(body.status !== undefined && { status: body.status }),
    },
  })

  return NextResponse.json(interview)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; intId: string }> }
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

  const { intId } = await params

  await prisma.applicantInterview.delete({ where: { id: intId } })

  return NextResponse.json({ ok: true })
}
