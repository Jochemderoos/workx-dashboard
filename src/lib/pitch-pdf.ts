import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Whiteout overlay interface for covering existing content
 */
export interface WhiteoutOverlay {
  id: string
  pageNumber: number  // Original page number (1-indexed)
  x: number           // X position in mm from left
  y: number           // Y position in mm from top
  width: number       // Width in mm
  height: number      // Height in mm
  color?: string      // Optional background color (default: white)
}

/**
 * Text overlay interface for adding custom text to PDF pages
 */
export interface TextOverlay {
  id: string
  pageNumber: number  // Original page number (1-indexed)
  x: number           // X position in mm from left
  y: number           // Y position in mm from top
  text: string
  fontSize: number
  color: string       // Hex color like #000000
  whiteout?: {        // Optional whiteout behind the text
    width: number     // Width in mm
    height: number    // Height in mm
    padding?: number  // Padding around text in mm
  }
}

/**
 * Image overlay interface for adding images to PDF pages
 */
export interface ImageOverlay {
  id: string
  pageNumber: number  // Original page number (1-indexed)
  x: number           // X position in mm from left
  y: number           // Y position in mm from top
  width: number       // Width in mm
  height: number      // Height in mm
  imageData: string   // Base64 encoded image data
  imageType: 'png' | 'jpg'
  whiteout?: boolean  // Draw white rectangle behind image
}

/**
 * Intro sections with their page ranges (1-indexed)
 * Based on "Pitch Doc NL + CV's 2025 (online).pdf"
 */
export const INTRO_SECTIONS: Record<string, { pages: number[]; label: string; description: string }> = {
  'cover': { pages: [1], label: 'Cover', description: 'Voorpagina' },
  'over-workx': { pages: [2, 3], label: 'Over Workx', description: 'Wie we zijn en wat we doen' },
  'team-overzicht': { pages: [4, 5], label: 'Team Overzicht', description: 'Het hele team op één pagina' },
  'expertise': { pages: [6, 7], label: 'Expertise', description: 'Onze specialisaties' },
  'diensten': { pages: [8, 9], label: 'Diensten', description: 'Wat we bieden' },
  'clienten': { pages: [10, 11, 12], label: 'Cliënten', description: 'Voor wie we werken' },
}

/**
 * Bijlagen sections with their page ranges (1-indexed)
 * Updated based on actual PDF content (NL version)
 * 28=Bijlagen cover, 29=Legal OR, 30-31=Arbeidsovereenkomst, 32=geel, 33-34=Duurzaamheid, 35=AV, 36=Contact
 */
export const BIJLAGEN_SECTIONS: Record<string, { pages: number[]; label: string; description: string }> = {
  'bijlagen-cover': { pages: [28], label: 'Bijlagen Cover', description: 'Tussenpagina bijlagen' },
  'legal-or': { pages: [29], label: 'Legal Graphic OR', description: 'OR adviestraject visualisatie' },
  'arbeidsovereenkomst': { pages: [30, 31], label: 'Visuele Arbeidsovereenkomst', description: 'Contract visualisatie (2 pag.)' },
  'duurzaamheid': { pages: [33, 34], label: 'Duurzaamheid', description: 'MVO en duurzaamheid (2 pag.)' },
  'av': { pages: [35], label: 'Algemene Voorwaarden', description: 'AV en juridische info' },
  'contact': { pages: [36], label: 'Contact', description: 'Contactgegevens' },
}

/**
 * Team member name to CV page number mapping
 * Based on "Pitch Doc NL + CV's 2025 (online).pdf"
 * CV pages are 13-27 (0-indexed: 12-26)
 */
export const TEAM_CV_PAGES: Record<string, number> = {
  'Bas den Ridder': 13,
  'Jochem de Roos': 14,
  'Maaike de Jong': 15,
  'Marnix Ritmeester': 16,
  'Juliette Niersman': 17,
  'Barbara Rip': 18,
  'Marlieke Schipper': 19,
  'Kay Maes': 20,
  'Justine Schellekens': 21,
  'Wies van Pesch': 22,
  'Emma van der Vos': 23,
  'Alain Heunen': 24,
  'Erika van Zadelhof': 25,
  'Heleen Pesser': 26,
  'Julia Groen': 27,
}

/**
 * Get all available team members for the pitch document
 */
export function getAvailableTeamMembers(): string[] {
  return Object.keys(TEAM_CV_PAGES)
}

/**
 * Document sections with their page ranges (1-indexed for readability)
 */
export const DOCUMENT_SECTIONS = {
  intro: { start: 1, end: 12, description: 'Intro (Over Workx, Team, Expertise, etc.)' },
  cvs: { start: 13, end: 27, description: 'Team CVs' },
  bijlagen: { start: 28, end: 34, description: 'Bijlagen (legal graphics, AV, contact)' },
}

/**
 * Get PDF base path for language
 */
export function getPdfBasePath(language: 'nl' | 'en' = 'nl'): string {
  return path.join(process.cwd(), 'data', 'pitch', `pitch-base-${language}.pdf`)
}

interface GeneratePitchOptions {
  selectedTeamMembers: string[]
  selectedIntroSections?: string[]  // Keys from INTRO_SECTIONS, if empty/undefined = all
  selectedBijlagenSections?: string[]  // Keys from BIJLAGEN_SECTIONS, if empty = none
  textOverlays?: TextOverlay[]  // Optional text overlays to add
  whiteoutOverlays?: WhiteoutOverlay[]  // Optional whiteout overlays
  imageOverlays?: ImageOverlay[]  // Optional image overlays
  language?: 'nl' | 'en'
  customPageOrder?: number[]  // Optional custom page order (1-indexed original page numbers)
  clientLogo?: {  // Optional client logo on cover
    dataUrl: string  // Base64 PNG data URL
    x: number  // X position in mm from left
    y: number  // Y position in mm from top
  }
}

/**
 * Page info for preview
 */
export interface PageInfo {
  originalPage: number  // 1-indexed page number in source PDF
  type: 'intro' | 'cv' | 'bijlage'
  label: string
  section?: string
}

/**
 * Get all available intro section keys
 */
export function getAvailableIntroSections() {
  return Object.entries(INTRO_SECTIONS).map(([key, value]) => ({
    key,
    ...value,
    pageCount: value.pages.length,
  }))
}

/**
 * Get all available bijlagen section keys
 */
export function getAvailableBijlagenSections() {
  return Object.entries(BIJLAGEN_SECTIONS).map(([key, value]) => ({
    key,
    ...value,
    pageCount: value.pages.length,
  }))
}

/**
 * Get page preview list for selected sections and team members
 * Returns array of PageInfo objects that can be reordered/removed
 */
export function getPagePreviewList(
  selectedTeamMembers: string[],
  selectedIntroSections?: string[],
  selectedBijlagenSections?: string[]
): PageInfo[] {
  const pages: PageInfo[] = []

  // Add intro section pages
  const introSectionsToInclude = selectedIntroSections && selectedIntroSections.length > 0
    ? selectedIntroSections
    : Object.keys(INTRO_SECTIONS)

  for (const sectionKey of introSectionsToInclude) {
    const section = INTRO_SECTIONS[sectionKey]
    if (section) {
      for (let i = 0; i < section.pages.length; i++) {
        pages.push({
          originalPage: section.pages[i],
          type: 'intro',
          label: section.pages.length > 1 ? `${section.label} (${i + 1}/${section.pages.length})` : section.label,
          section: sectionKey,
        })
      }
    }
  }

  // Add team member CV pages
  const sortedMembers = [...selectedTeamMembers].sort((a, b) => {
    const pageA = TEAM_CV_PAGES[a] || 999
    const pageB = TEAM_CV_PAGES[b] || 999
    return pageA - pageB
  })

  for (const memberName of sortedMembers) {
    const pageNumber = TEAM_CV_PAGES[memberName]
    if (pageNumber) {
      pages.push({
        originalPage: pageNumber,
        type: 'cv',
        label: memberName,
        section: 'cv',
      })
    }
  }

  // Add bijlagen section pages
  for (const sectionKey of selectedBijlagenSections || []) {
    const section = BIJLAGEN_SECTIONS[sectionKey]
    if (section) {
      for (let i = 0; i < section.pages.length; i++) {
        pages.push({
          originalPage: section.pages[i],
          type: 'bijlage',
          label: section.pages.length > 1 ? `${section.label} (${i + 1}/${section.pages.length})` : section.label,
          section: sectionKey,
        })
      }
    }
  }

  return pages
}

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    }
  }
  return { r: 0, g: 0, b: 0 } // Default to black
}

/**
 * Convert mm to PDF points (1 inch = 72 points, 1 inch = 25.4 mm)
 */
function mmToPoints(mm: number): number {
  return mm * (72 / 25.4)
}

/**
 * Generate a custom pitch PDF with selected sections and team members
 * Uses page extraction to maintain 100% original quality
 */
export async function generatePitchPDF(options: GeneratePitchOptions): Promise<Uint8Array> {
  const {
    selectedTeamMembers,
    selectedIntroSections,
    selectedBijlagenSections = [],
    textOverlays = [],
    whiteoutOverlays = [],
    imageOverlays = [],
    language = 'nl',
    customPageOrder,
    clientLogo,
  } = options

  // Load the base pitch PDF
  const basePdfPath = getPdfBasePath(language)

  if (!fs.existsSync(basePdfPath)) {
    throw new Error(`Base pitch PDF not found at ${basePdfPath}`)
  }

  const basePdfBytes = fs.readFileSync(basePdfPath)
  const basePdf = await PDFDocument.load(basePdfBytes)

  // Create a new PDF document
  const newPdf = await PDFDocument.create()

  // Build list of pages to include (0-indexed) and track original page numbers
  let pagesToInclude: number[] = []
  let originalPageNumbers: number[] = []  // Track original 1-indexed page numbers

  // If custom page order is provided, use that directly
  if (customPageOrder && customPageOrder.length > 0) {
    pagesToInclude = customPageOrder.map(p => p - 1)  // Convert to 0-indexed
    originalPageNumbers = [...customPageOrder]  // Keep 1-indexed
  } else {
    // Build from sections
    // Add intro section pages
    const introSectionsToInclude = selectedIntroSections && selectedIntroSections.length > 0
      ? selectedIntroSections
      : Object.keys(INTRO_SECTIONS)  // Default: all intro sections

    for (const sectionKey of introSectionsToInclude) {
      const section = INTRO_SECTIONS[sectionKey]
      if (section) {
        for (const pageNum of section.pages) {
          pagesToInclude.push(pageNum - 1)  // Convert to 0-indexed
          originalPageNumbers.push(pageNum)  // Keep 1-indexed for overlay matching
        }
      }
    }

    // Add selected team member CV pages
    const cvPageIndices: { index: number; original: number }[] = []
    for (const memberName of selectedTeamMembers) {
      const pageNumber = TEAM_CV_PAGES[memberName]
      if (pageNumber) {
        cvPageIndices.push({ index: pageNumber - 1, original: pageNumber })
      }
    }

    // Sort CV pages to maintain document order
    cvPageIndices.sort((a, b) => a.index - b.index)
    for (const cv of cvPageIndices) {
      pagesToInclude.push(cv.index)
      originalPageNumbers.push(cv.original)
    }

    // Add bijlagen section pages
    for (const sectionKey of selectedBijlagenSections) {
      const section = BIJLAGEN_SECTIONS[sectionKey]
      if (section) {
        for (const pageNum of section.pages) {
          pagesToInclude.push(pageNum - 1)  // Convert to 0-indexed
          originalPageNumbers.push(pageNum)
        }
      }
    }
  }

  // Copy selected pages to new document
  const copiedPages = await newPdf.copyPages(basePdf, pagesToInclude)

  for (const page of copiedPages) {
    newPdf.addPage(page)
  }

  const pages = newPdf.getPages()

  // Apply client logo on cover (first page) if provided
  if (clientLogo && pages.length > 0) {
    try {
      const coverPage = pages[0]
      const { height } = coverPage.getSize()

      // Remove data URL prefix if present
      const base64Data = clientLogo.dataUrl.replace(/^data:image\/png;base64,/, '')
      const logoBytes = Buffer.from(base64Data, 'base64')
      const logoImage = await newPdf.embedPng(logoBytes)

      // Get logo dimensions and calculate size
      const logoDims = logoImage.scale(1)
      const maxLogoWidth = 50  // mm
      const maxLogoHeight = 30  // mm

      // Scale logo to fit within max dimensions while maintaining aspect ratio
      let scale = 1
      if (logoDims.width > mmToPoints(maxLogoWidth)) {
        scale = mmToPoints(maxLogoWidth) / logoDims.width
      }
      if (logoDims.height * scale > mmToPoints(maxLogoHeight)) {
        scale = mmToPoints(maxLogoHeight) / logoDims.height
      }

      const logoWidth = logoDims.width * scale
      const logoHeight = logoDims.height * scale

      // Use position from options (x/y in mm from top-left)
      // Convert to PDF coordinates (y from bottom)
      const xPos = mmToPoints(clientLogo.x)
      const yPos = height - mmToPoints(clientLogo.y) - logoHeight

      coverPage.drawImage(logoImage, {
        x: xPos,
        y: yPos,
        width: logoWidth,
        height: logoHeight,
      })
    } catch (error) {
      console.error('Error adding client logo:', error)
      // Continue without logo if there's an error
    }
  }

  // Apply standalone whiteout overlays first (bottom layer)
  for (const overlay of whiteoutOverlays) {
    const newPageIndex = originalPageNumbers.indexOf(overlay.pageNumber)

    if (newPageIndex !== -1 && newPageIndex < pages.length) {
      const page = pages[newPageIndex]
      const { height } = page.getSize()

      // Convert mm positions to points
      const xPos = mmToPoints(overlay.x)
      const yPos = height - mmToPoints(overlay.y) - mmToPoints(overlay.height)
      const widthPts = mmToPoints(overlay.width)
      const heightPts = mmToPoints(overlay.height)

      // Parse color (default to white)
      const color = overlay.color ? hexToRgb(overlay.color) : { r: 1, g: 1, b: 1 }

      // Draw the whiteout rectangle
      page.drawRectangle({
        x: xPos,
        y: yPos,
        width: widthPts,
        height: heightPts,
        color: rgb(color.r, color.g, color.b),
      })
    }
  }

  // Apply image overlays (middle layer)
  for (const overlay of imageOverlays) {
    const newPageIndex = originalPageNumbers.indexOf(overlay.pageNumber)

    if (newPageIndex !== -1 && newPageIndex < pages.length) {
      const page = pages[newPageIndex]
      const { height } = page.getSize()

      // Convert mm positions to points
      const xPos = mmToPoints(overlay.x)
      const yPos = height - mmToPoints(overlay.y) - mmToPoints(overlay.height)
      const widthPts = mmToPoints(overlay.width)
      const heightPts = mmToPoints(overlay.height)

      // Draw whiteout behind image if requested
      if (overlay.whiteout) {
        page.drawRectangle({
          x: xPos,
          y: yPos,
          width: widthPts,
          height: heightPts,
          color: rgb(1, 1, 1),
        })
      }

      // Embed and draw the image
      try {
        // Remove data URL prefix if present
        const base64Data = overlay.imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
        const imageBytes = Buffer.from(base64Data, 'base64')

        const image = overlay.imageType === 'png'
          ? await newPdf.embedPng(imageBytes)
          : await newPdf.embedJpg(imageBytes)

        page.drawImage(image, {
          x: xPos,
          y: yPos,
          width: widthPts,
          height: heightPts,
        })
      } catch (err) {
        console.error('Error embedding image:', err)
      }
    }
  }

  // Apply text overlays (top layer)
  if (textOverlays.length > 0) {
    const font = await newPdf.embedFont(StandardFonts.Helvetica)

    for (const overlay of textOverlays) {
      // Find which new page index corresponds to the original page number
      const newPageIndex = originalPageNumbers.indexOf(overlay.pageNumber)

      if (newPageIndex !== -1 && newPageIndex < pages.length) {
        const page = pages[newPageIndex]
        const { height } = page.getSize()

        // Convert mm positions to points
        // Note: PDF coordinates start from bottom-left, so we flip Y
        const xPos = mmToPoints(overlay.x)
        const yPos = height - mmToPoints(overlay.y) - overlay.fontSize  // Flip Y and account for text height

        // Draw whiteout behind text if specified
        if (overlay.whiteout) {
          const padding = overlay.whiteout.padding || 2
          const whiteoutX = xPos - mmToPoints(padding)
          const whiteoutY = yPos - mmToPoints(padding)
          const whiteoutWidth = mmToPoints(overlay.whiteout.width + padding * 2)
          const whiteoutHeight = mmToPoints(overlay.whiteout.height + padding * 2)

          page.drawRectangle({
            x: whiteoutX,
            y: whiteoutY,
            width: whiteoutWidth,
            height: whiteoutHeight,
            color: rgb(1, 1, 1),
          })
        }

        // Parse color
        const color = hexToRgb(overlay.color)

        // Draw the text
        page.drawText(overlay.text, {
          x: xPos,
          y: yPos,
          size: overlay.fontSize,
          font: font,
          color: rgb(color.r, color.g, color.b),
        })
      }
    }
  }

  // Serialize the PDF
  const pdfBytes = await newPdf.save()

  return pdfBytes
}

/**
 * Get document statistics
 */
export function getDocumentStats(
  selectedTeamMembers: string[],
  selectedIntroSections?: string[],
  selectedBijlagenSections?: string[]
) {
  // Calculate intro pages
  const introSectionsToCount = selectedIntroSections && selectedIntroSections.length > 0
    ? selectedIntroSections
    : Object.keys(INTRO_SECTIONS)

  const introPages = introSectionsToCount.reduce((total, key) => {
    const section = INTRO_SECTIONS[key]
    return total + (section ? section.pages.length : 0)
  }, 0)

  // Calculate CV pages
  const cvPages = selectedTeamMembers.filter(name => TEAM_CV_PAGES[name]).length

  // Calculate bijlagen pages
  const bijlagenPages = (selectedBijlagenSections || []).reduce((total, key) => {
    const section = BIJLAGEN_SECTIONS[key]
    return total + (section ? section.pages.length : 0)
  }, 0)

  return {
    totalPages: introPages + cvPages + bijlagenPages,
    introPages,
    cvPages,
    bijlagenPages,
    selectedMembers: selectedTeamMembers.filter(name => TEAM_CV_PAGES[name]),
  }
}
