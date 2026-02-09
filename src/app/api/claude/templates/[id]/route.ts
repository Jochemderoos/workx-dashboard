import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: download origineel bestand
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // All authenticated users can download templates (shared within the firm)
  const template = await prisma.aITemplate.findFirst({
    where: { id: params.id },
    select: {
      name: true,
      fileType: true,
      fileBase64: true,
    },
  })

  if (!template) {
    return NextResponse.json({ error: 'Template niet gevonden' }, { status: 404 })
  }

  if (!template.fileBase64) {
    return NextResponse.json({ error: 'Geen origineel bestand beschikbaar' }, { status: 404 })
  }

  // Return the base64 data URL
  return NextResponse.json({
    name: template.name,
    fileType: template.fileType,
    fileBase64: template.fileBase64,
  })
}

// PUT: update template
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()
  const { name, category, description, instructions, isActive } = body

  const template = await prisma.aITemplate.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(instructions !== undefined && { instructions }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      isActive: true,
    },
  })

  return NextResponse.json(template)
}

// DELETE: verwijder template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  await prisma.aITemplate.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
