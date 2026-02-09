import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: document detail
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // All authenticated users can view documents (shared within the firm)
  const document = await prisma.aIDocument.findFirst({
    where: { id: params.id },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
  }

  return NextResponse.json(document)
}

// DELETE: document verwijderen
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const existing = await prisma.aIDocument.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
  }

  await prisma.aIDocument.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
