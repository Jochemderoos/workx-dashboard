import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch single bundle
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
      include: {
        productions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    if (bundle.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    return NextResponse.json(bundle)
  } catch (error) {
    console.error('Error fetching bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet ophalen' }, { status: 500 })
  }
}

// PATCH - Update bundle
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    if (bundle.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      caseNumber,
      clientName,
      mainDocumentUrl,
      mainDocumentName,
      mainDocumentType,
      status,
      productionLabel,
      includeProductielijst,
    } = body

    const updated = await prisma.workxflowBundle.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(caseNumber !== undefined && { caseNumber }),
        ...(clientName !== undefined && { clientName }),
        ...(mainDocumentUrl !== undefined && { mainDocumentUrl }),
        ...(mainDocumentName !== undefined && { mainDocumentName }),
        ...(mainDocumentType !== undefined && { mainDocumentType }),
        ...(status !== undefined && { status }),
        ...(productionLabel !== undefined && { productionLabel }),
        ...(includeProductielijst !== undefined && { includeProductielijst }),
      },
      include: {
        productions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete bundle
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    if (bundle.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    await prisma.workxflowBundle.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet verwijderen' }, { status: 500 })
  }
}
