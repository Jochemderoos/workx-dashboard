import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
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
  const { type, naam, fileUrl, fileSize } = body

  if (!naam || !fileUrl) {
    return NextResponse.json({ error: 'Naam en fileUrl zijn verplicht' }, { status: 400 })
  }

  const doc = await prisma.applicantDocument.create({
    data: {
      applicantId: id,
      type: type || 'overig',
      naam,
      fileUrl,
      fileSize: fileSize || null,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
