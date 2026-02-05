import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Reorder productions
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
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const { productionIds } = body

    if (!Array.isArray(productionIds)) {
      return NextResponse.json({ error: 'productionIds moet een array zijn' }, { status: 400 })
    }

    // Update sort order and production numbers for each production
    const updates = productionIds.map((id: string, index: number) =>
      prisma.workxflowProduction.update({
        where: { id },
        data: {
          sortOrder: index,
          productionNumber: index + 1,
        },
      })
    )

    await prisma.$transaction(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering productions:', error)
    return NextResponse.json({ error: 'Kon volgorde niet opslaan' }, { status: 500 })
  }
}
