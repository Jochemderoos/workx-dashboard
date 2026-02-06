import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Check of een gebruiker toegang heeft tot een bundle.
 * Returns 'OWNER' | 'EDITOR' | 'VIEWER' | null
 */
async function checkBundleAccess(bundleId: string, userId: string): Promise<string | null> {
  const bundle = await prisma.workxflowBundle.findUnique({
    where: { id: bundleId },
    select: { createdById: true },
  })

  if (!bundle) return null
  if (bundle.createdById === userId) return 'OWNER'

  const access = await prisma.bundleAccess.findUnique({
    where: { bundleId_userId: { bundleId, userId } },
  })

  return access?.accessLevel || null
}

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

    const accessLevel = await checkBundleAccess(params.id, session.user.id)
    if (!accessLevel) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
      include: {
        productions: {
          orderBy: { sortOrder: 'asc' },
        },
        lock: {
          include: { lockedBy: { select: { id: true, name: true } } },
        },
        access: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ ...bundle, accessLevel })
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

    const accessLevel = await checkBundleAccess(params.id, session.user.id)
    if (!accessLevel || accessLevel === 'VIEWER') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Check lock - only allow edit if no lock or user holds the lock
    const existingLock = await prisma.bundleLock.findUnique({
      where: { bundleId: params.id },
    })

    if (existingLock && existingLock.lockedById !== session.user.id && new Date(existingLock.expiresAt) > new Date()) {
      return NextResponse.json({
        error: 'Deze bundle wordt momenteel bewerkt door iemand anders',
        lockedBy: existingLock.lockedById,
      }, { status: 423 }) // 423 Locked
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

    // Refresh lock timer on edit
    if (existingLock && existingLock.lockedById === session.user.id) {
      await prisma.bundleLock.update({
        where: { bundleId: params.id },
        data: {
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete bundle (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const accessLevel = await checkBundleAccess(params.id, session.user.id)
    if (accessLevel !== 'OWNER') {
      return NextResponse.json({ error: 'Alleen de eigenaar kan een bundle verwijderen' }, { status: 403 })
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
