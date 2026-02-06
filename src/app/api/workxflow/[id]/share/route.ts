import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Share bundle with a user
export async function POST(
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
      return NextResponse.json({ error: 'Alleen de eigenaar kan delen' }, { status: 403 })
    }

    const { userId, accessLevel = 'EDITOR' } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Gebruiker ID is verplicht' }, { status: 400 })
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Je kunt niet met jezelf delen' }, { status: 400 })
    }

    // Upsert - update access level if already shared
    const access = await prisma.bundleAccess.upsert({
      where: { bundleId_userId: { bundleId: params.id, userId } },
      create: {
        bundleId: params.id,
        userId,
        accessLevel,
        grantedById: session.user.id,
      },
      update: {
        accessLevel,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json(access)
  } catch (error) {
    console.error('Error sharing bundle:', error)
    return NextResponse.json({ error: 'Kon bundle niet delen' }, { status: 500 })
  }
}

// DELETE - Remove sharing
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
      return NextResponse.json({ error: 'Alleen de eigenaar kan delen beheren' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Gebruiker ID is verplicht' }, { status: 400 })
    }

    await prisma.bundleAccess.delete({
      where: { bundleId_userId: { bundleId: params.id, userId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing share:', error)
    return NextResponse.json({ error: 'Kon delen niet verwijderen' }, { status: 500 })
  }
}
