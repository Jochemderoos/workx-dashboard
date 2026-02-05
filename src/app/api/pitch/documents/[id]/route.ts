import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch single document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const document = await prisma.pitchDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching pitch document:', error)
    return NextResponse.json({ error: 'Kon document niet ophalen' }, { status: 500 })
  }
}

// PUT - Update a pitch document
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (currentUser?.role !== 'PARTNER' && currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const document = await prisma.pitchDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    const body = await req.json()
    const {
      label,
      description,
      teamMemberName,
      sourceType,
      basePages,
      uploadUrl,
      uploadName,
      sortOrder,
      isActive,
    } = body

    const updated = await prisma.pitchDocument.update({
      where: { id: params.id },
      data: {
        ...(label !== undefined && { label }),
        ...(description !== undefined && { description }),
        ...(teamMemberName !== undefined && { teamMemberName }),
        ...(sourceType !== undefined && { sourceType }),
        ...(basePages !== undefined && { basePages }),
        ...(uploadUrl !== undefined && { uploadUrl }),
        ...(uploadName !== undefined && { uploadName }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating pitch document:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Document met deze naam bestaat al' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Kon document niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete a pitch document
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (currentUser?.role !== 'PARTNER' && currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const document = await prisma.pitchDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    await prisma.pitchDocument.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pitch document:', error)
    return NextResponse.json({ error: 'Kon document niet verwijderen' }, { status: 500 })
  }
}
