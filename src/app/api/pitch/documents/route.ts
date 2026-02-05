import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  INTRO_SECTIONS,
  TEAM_CV_PAGES,
  BIJLAGEN_SECTIONS,
} from '@/lib/pitch-pdf'

// GET - Fetch all pitch documents (optionally filter by type)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const language = searchParams.get('language') || 'nl'
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Check if user is admin or partner for management view
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isManager = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    // Build query
    const where: any = { language }
    if (type) where.type = type
    if (!includeInactive || !isManager) where.isActive = true

    const documents = await prisma.pitchDocument.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { sortOrder: 'asc' },
        { label: 'asc' },
      ],
    })

    return NextResponse.json({
      documents,
      isManager,
    })
  } catch (error) {
    console.error('Error fetching pitch documents:', error)
    return NextResponse.json({ error: 'Kon documenten niet ophalen' }, { status: 500 })
  }
}

// POST - Create a new pitch document (admin/partner only)
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const {
      type,
      name,
      label,
      description,
      teamMemberName,
      sourceType = 'base',
      basePages,
      uploadUrl,
      uploadName,
      sortOrder = 0,
      isActive = true,
      language = 'nl',
    } = body

    if (!type || !name || !label) {
      return NextResponse.json(
        { error: 'Type, name en label zijn verplicht' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['cv', 'intro', 'bijlage'].includes(type)) {
      return NextResponse.json(
        { error: 'Type moet cv, intro of bijlage zijn' },
        { status: 400 }
      )
    }

    // Create document
    const document = await prisma.pitchDocument.create({
      data: {
        type,
        name,
        label,
        description,
        teamMemberName,
        sourceType,
        basePages,
        uploadUrl,
        uploadName,
        sortOrder,
        isActive,
        language,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json(document)
  } catch (error: any) {
    console.error('Error creating pitch document:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Document met deze naam bestaat al' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Kon document niet aanmaken' }, { status: 500 })
  }
}

// PUT - Seed documents from hardcoded values (admin/partner only, one-time migration)
export async function PUT(req: NextRequest) {
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

    const body = await req.json()
    const { action } = body

    if (action !== 'seed') {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    // Check if already seeded
    const existingCount = await prisma.pitchDocument.count()
    if (existingCount > 0) {
      return NextResponse.json({
        message: 'Documenten zijn al gemigreerd',
        count: existingCount,
      })
    }

    const documents = []

    // Seed intro sections
    let introOrder = 0
    for (const [key, value] of Object.entries(INTRO_SECTIONS)) {
      documents.push({
        type: 'intro',
        name: key,
        label: value.label,
        description: value.description,
        sourceType: 'base',
        basePages: value.pages.join(','),
        sortOrder: introOrder++,
        isActive: true,
        language: 'nl',
        updatedBy: session.user.id,
      })
    }

    // Seed CV pages
    let cvOrder = 0
    for (const [name, pageNum] of Object.entries(TEAM_CV_PAGES)) {
      const slug = name.toLowerCase().replace(/\s+/g, '-')
      documents.push({
        type: 'cv',
        name: slug,
        label: name,
        teamMemberName: name,
        sourceType: 'base',
        basePages: String(pageNum),
        sortOrder: cvOrder++,
        isActive: true,
        language: 'nl',
        updatedBy: session.user.id,
      })
    }

    // Seed bijlagen sections
    let bijlagenOrder = 0
    for (const [key, value] of Object.entries(BIJLAGEN_SECTIONS)) {
      documents.push({
        type: 'bijlage',
        name: key,
        label: value.label,
        description: value.description,
        sourceType: 'base',
        basePages: value.pages.join(','),
        sortOrder: bijlagenOrder++,
        isActive: true,
        language: 'nl',
        updatedBy: session.user.id,
      })
    }

    // Create all documents
    const created = await prisma.pitchDocument.createMany({
      data: documents,
    })

    return NextResponse.json({
      message: 'Documenten succesvol gemigreerd',
      count: created.count,
    })
  } catch (error) {
    console.error('Error seeding pitch documents:', error)
    return NextResponse.json({ error: 'Kon documenten niet migreren' }, { status: 500 })
  }
}
