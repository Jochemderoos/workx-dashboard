import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all bundles for current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Fetch own bundles + bundles shared with me
    const [ownBundles, sharedAccess] = await Promise.all([
      prisma.workxflowBundle.findMany({
        where: { createdById: session.user.id },
        include: {
          productions: { orderBy: { sortOrder: 'asc' } },
          lock: { include: { lockedBy: { select: { id: true, name: true } } } },
          access: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bundleAccess.findMany({
        where: { userId: session.user.id },
        include: {
          bundle: {
            include: {
              productions: { orderBy: { sortOrder: 'asc' } },
              lock: { include: { lockedBy: { select: { id: true, name: true } } } },
              access: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            },
          },
        },
      }),
    ])

    // Clean up expired locks
    const now = new Date()
    const allBundles = [
      ...ownBundles.map(b => ({ ...b, isOwner: true, accessLevel: 'OWNER' as const })),
      ...sharedAccess.map(a => ({ ...a.bundle, isOwner: false, accessLevel: a.accessLevel })),
    ].map(b => ({
      ...b,
      lock: b.lock && new Date(b.lock.expiresAt) > now ? b.lock : null,
    }))

    return NextResponse.json({ bundles: allBundles })
  } catch (error) {
    console.error('Error fetching bundles:', error)
    return NextResponse.json({ error: 'Kon bundles niet ophalen' }, { status: 500 })
  }
}

// POST - Create a new bundle
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { title, caseNumber, clientName } = body

    if (!title) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }

    const bundle = await prisma.workxflowBundle.create({
      data: {
        title,
        caseNumber,
        clientName,
        createdById: session.user.id,
      },
      include: {
        productions: true,
      },
    })

    return NextResponse.json(bundle)
  } catch (error) {
    console.error('Error creating bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet aanmaken' }, { status: 500 })
  }
}
