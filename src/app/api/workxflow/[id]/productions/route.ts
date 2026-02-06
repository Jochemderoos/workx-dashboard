import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Add production to bundle
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
    const {
      productionNumber,
      title,
      documentUrl,
      documentName,
      documentType,
      pageCount = 1,
      sortOrder,
    } = body

    const production = await prisma.workxflowProduction.create({
      data: {
        bundleId: params.id,
        productionNumber,
        title,
        documentUrl,
        documentName,
        documentType,
        pageCount,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(production)
  } catch (error) {
    console.error('Error creating production:', error)
    return NextResponse.json({ error: 'Kon productie niet toevoegen' }, { status: 500 })
  }
}
