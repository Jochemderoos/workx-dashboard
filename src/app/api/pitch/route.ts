import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const teamMembers = getAvailableTeamMembers()
    const introSections = getAvailableIntroSections()
    const bijlagenSections = getAvailableBijlagenSections()

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

    // Validate team members
    const validMembers = selectedTeamMembers.filter(
      (name: string) => TEAM_CV_PAGES[name]
    )

    if (validMembers.length === 0) {
      return NextResponse.json(
        { error: 'No valid team members selected' },
        { status: 400 }
      )
    }

    // Validate intro sections if provided
    const validIntroSections = selectedIntroSections
      ? selectedIntroSections.filter((key: string) => INTRO_SECTIONS[key])
      : undefined

    // Validate bijlagen sections if provided
    const validBijlagenSections = selectedBijlagenSections
      ? selectedBijlagenSections.filter((key: string) => BIJLAGEN_SECTIONS[key])
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
