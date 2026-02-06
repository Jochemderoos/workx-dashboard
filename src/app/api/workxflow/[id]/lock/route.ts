import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Acquire or refresh lock
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check access
    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
      select: { createdById: true },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    const hasAccess = bundle.createdById === session.user.id ||
      await prisma.bundleAccess.findUnique({
        where: { bundleId_userId: { bundleId: params.id, userId: session.user.id } },
      })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 min

    // Check existing lock
    const existingLock = await prisma.bundleLock.findUnique({
      where: { bundleId: params.id },
      include: { lockedBy: { select: { id: true, name: true } } },
    })

    if (existingLock) {
      // Lock exists - check if it's ours or expired
      if (existingLock.lockedById === session.user.id) {
        // Refresh our lock
        const updated = await prisma.bundleLock.update({
          where: { bundleId: params.id },
          data: { lastActivityAt: now, expiresAt },
          include: { lockedBy: { select: { id: true, name: true } } },
        })
        return NextResponse.json(updated)
      }

      if (new Date(existingLock.expiresAt) > now) {
        // Someone else has an active lock
        return NextResponse.json({
          error: `${existingLock.lockedBy.name} is deze bundle aan het bewerken`,
          lock: existingLock,
        }, { status: 423 })
      }

      // Lock is expired - take it over
      const updated = await prisma.bundleLock.update({
        where: { bundleId: params.id },
        data: {
          lockedById: session.user.id,
          lockedAt: now,
          lastActivityAt: now,
          expiresAt,
        },
        include: { lockedBy: { select: { id: true, name: true } } },
      })
      return NextResponse.json(updated)
    }

    // No lock exists - create one
    const lock = await prisma.bundleLock.create({
      data: {
        bundleId: params.id,
        lockedById: session.user.id,
        expiresAt,
      },
      include: { lockedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(lock)
  } catch (error) {
    console.error('Error acquiring lock:', error)
    return NextResponse.json({ error: 'Kon lock niet verkrijgen' }, { status: 500 })
  }
}

// DELETE - Release lock
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const existingLock = await prisma.bundleLock.findUnique({
      where: { bundleId: params.id },
    })

    if (!existingLock) {
      return NextResponse.json({ success: true })
    }

    // Only the lock holder or the bundle owner can release
    if (existingLock.lockedById !== session.user.id) {
      const bundle = await prisma.workxflowBundle.findUnique({
        where: { id: params.id },
        select: { createdById: true },
      })
      if (bundle?.createdById !== session.user.id) {
        return NextResponse.json({ error: 'Alleen de lock-houder of eigenaar kan ontgrendelen' }, { status: 403 })
      }
    }

    await prisma.bundleLock.delete({
      where: { bundleId: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error releasing lock:', error)
    return NextResponse.json({ error: 'Kon lock niet vrijgeven' }, { status: 500 })
  }
}
