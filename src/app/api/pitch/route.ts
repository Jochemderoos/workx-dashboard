import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generatePitchPDF,
  getAvailableTeamMembers,
  getAvailableIntroSections,
  getAvailableBijlagenSections,
  getPagePreviewList,
  getDocumentStats,
  getPdfBasePath,
  TEAM_CV_PAGES,
  INTRO_SECTIONS,
  BIJLAGEN_SECTIONS,
} from '@/lib/pitch-pdf'
import * as fs from 'fs'

// GET - Get available team members and sections
export async function GET() {
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
    const isManager = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    // Try to get documents from database first
    const dbDocuments = await prisma.pitchDocument.findMany({
      where: {
        isActive: true,
        language: 'nl',
      },
      orderBy: [
        { type: 'asc' },
        { sortOrder: 'asc' },
      ],
    })

    let teamMembers: string[]
    let introSections: { key: string; label: string; description: string; pageCount: number; pages: number[] }[]
    let bijlagenSections: { key: string; label: string; description: string; pageCount: number; pages: number[] }[]

    if (dbDocuments.length > 0) {
      // Use database values
      const cvDocs = dbDocuments.filter(d => d.type === 'cv')
      const introDocs = dbDocuments.filter(d => d.type === 'intro')
      const bijlagenDocs = dbDocuments.filter(d => d.type === 'bijlage')

      teamMembers = cvDocs.map(d => d.teamMemberName || d.label)

      introSections = introDocs.map(d => {
        const pages = d.basePages ? d.basePages.split(',').map(p => parseInt(p.trim())) : []
        return {
          key: d.name,
          label: d.label,
          description: d.description || '',
          pageCount: pages.length,
          pages,
        }
      })

      bijlagenSections = bijlagenDocs.map(d => {
        const pages = d.basePages ? d.basePages.split(',').map(p => parseInt(p.trim())) : []
        return {
          key: d.name,
          label: d.label,
          description: d.description || '',
          pageCount: pages.length,
          pages,
        }
      })
    } else {
      // Fallback to hardcoded values
      teamMembers = getAvailableTeamMembers()
      introSections = getAvailableIntroSections()
      bijlagenSections = getAvailableBijlagenSections()
    }

    // Check which language versions are available
    const availableLanguages: string[] = []
    if (fs.existsSync(getPdfBasePath('nl'))) availableLanguages.push('nl')
    if (fs.existsSync(getPdfBasePath('en'))) availableLanguages.push('en')

    return NextResponse.json({
      teamMembers,
      totalTeamMembers: teamMembers.length,
      introSections,
      bijlagenSections,
      availableLanguages,
      isManager,
      usingDatabase: dbDocuments.length > 0,
    })
  } catch (error) {
    console.error('Error fetching pitch info:', error)
    return NextResponse.json({ error: 'Kon niet ophalen pitch info' }, { status: 500 })
  }
}

// POST - Generate a pitch PDF with selected sections and team members
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const {
      selectedTeamMembers,
      selectedIntroSections,
      selectedBijlagenSections,
      textOverlays,
      whiteoutOverlays,
      imageOverlays,
      language = 'nl',
      customPageOrder,
      clientLogo,
    } = body

    if (!selectedTeamMembers || !Array.isArray(selectedTeamMembers)) {
      return NextResponse.json(
        { error: 'selectedTeamMembers is verplicht and must be an array' },
        { status: 400 }
      )
    }

    // Try to get CV documents from database
    const dbCvDocs = await prisma.pitchDocument.findMany({
      where: {
        type: 'cv',
        isActive: true,
        language,
      },
    })

    // Build team member to page mapping (from database or fallback to hardcoded)
    let teamCvPages: Record<string, number> = {}
    if (dbCvDocs.length > 0) {
      for (const doc of dbCvDocs) {
        const name = doc.teamMemberName || doc.label
        const pages = doc.basePages ? doc.basePages.split(',').map(p => parseInt(p.trim())) : []
        if (pages.length > 0) {
          teamCvPages[name] = pages[0]
        }
      }
    } else {
      teamCvPages = { ...TEAM_CV_PAGES }
    }

    // Validate team members
    const validMembers = selectedTeamMembers.filter(
      (name: string) => teamCvPages[name]
    )

    if (validMembers.length === 0) {
      return NextResponse.json(
        { error: 'No valid team members selected' },
        { status: 400 }
      )
    }

    // Get intro and bijlagen sections from database or fallback
    const dbIntroDocs = await prisma.pitchDocument.findMany({
      where: { type: 'intro', isActive: true, language },
    })
    const dbBijlagenDocs = await prisma.pitchDocument.findMany({
      where: { type: 'bijlage', isActive: true, language },
    })

    const introSectionsMap: Record<string, { pages: number[] }> = {}
    const bijlagenSectionsMap: Record<string, { pages: number[] }> = {}

    if (dbIntroDocs.length > 0) {
      for (const doc of dbIntroDocs) {
        const pages = doc.basePages ? doc.basePages.split(',').map(p => parseInt(p.trim())) : []
        introSectionsMap[doc.name] = { pages }
      }
    } else {
      for (const [key, val] of Object.entries(INTRO_SECTIONS)) {
        introSectionsMap[key] = { pages: val.pages }
      }
    }

    if (dbBijlagenDocs.length > 0) {
      for (const doc of dbBijlagenDocs) {
        const pages = doc.basePages ? doc.basePages.split(',').map(p => parseInt(p.trim())) : []
        bijlagenSectionsMap[doc.name] = { pages }
      }
    } else {
      for (const [key, val] of Object.entries(BIJLAGEN_SECTIONS)) {
        bijlagenSectionsMap[key] = { pages: val.pages }
      }
    }

    // Validate intro sections if provided
    const validIntroSections = selectedIntroSections
      ? selectedIntroSections.filter((key: string) => introSectionsMap[key])
      : undefined

    // Validate bijlagen sections if provided
    const validBijlagenSections = selectedBijlagenSections
      ? selectedBijlagenSections.filter((key: string) => bijlagenSectionsMap[key])
      : []

    // Check if language is available
    const pdfPath = getPdfBasePath(language)
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: `PDF for language '${language}' not found. Please upload pitch-base-${language}.pdf` },
        { status: 400 }
      )
    }

    // Generate the PDF
    const pdfBytes = await generatePitchPDF({
      selectedTeamMembers: validMembers,
      selectedIntroSections: validIntroSections,
      selectedBijlagenSections: validBijlagenSections,
      textOverlays: textOverlays || [],
      whiteoutOverlays: whiteoutOverlays || [],
      imageOverlays: imageOverlays || [],
      language,
      customPageOrder,
      clientLogo: clientLogo ? {
        dataUrl: clientLogo.dataUrl,
        x: clientLogo.x ?? 15,
        y: clientLogo.y ?? 115,
      } : undefined,
    })

    // Get stats for logging
    const stats = getDocumentStats(validMembers, validIntroSections, validBijlagenSections)

    // Create filename with team names
    const teamNames = validMembers
      .map((name: string) => name.split(' ')[0]) // First names only
      .slice(0, 3) // Max 3 names in filename
      .join('-')
    const suffix = validMembers.length > 3 ? `-+${validMembers.length - 3}` : ''
    const filename = `Workx-Pitch-${teamNames}${suffix}-${new Date().toISOString().split('T')[0]}.pdf`

    // Return PDF as download
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating pitch PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate pitch PDF', details: String(error) },
      { status: 500 }
    )
  }
}
