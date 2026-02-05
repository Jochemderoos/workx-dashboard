import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Update production
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; productionId: string } }
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
      productionNumber,
      title,
      documentUrl,
      documentName,
      documentType,
      pageCount,
      sortOrder,
    } = body

    const updated = await prisma.workxflowProduction.update({
      where: { id: params.productionId },
      data: {
        ...(productionNumber !== undefined && { productionNumber }),
        ...(title !== undefined && { title }),
        ...(documentUrl !== undefined && { documentUrl }),
        ...(documentName !== undefined && { documentName }),
        ...(documentType !== undefined && { documentType }),
        ...(pageCount !== undefined && { pageCount }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating production:', error)
    return NextResponse.json({ error: 'Kon productie niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete production
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; productionId: string } }
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

    await prisma.workxflowProduction.delete({
      where: { id: params.productionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting production:', error)
    return NextResponse.json({ error: 'Kon productie niet verwijderen' }, { status: 500 })
  }
}
