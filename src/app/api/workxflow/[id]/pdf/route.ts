import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

// Workx brand colors
const WORKX_LIME = { r: 249/255, g: 255/255, b: 133/255 }
const WORKX_DARK = { r: 30/255, g: 30/255, b: 30/255 }

// Logo dimensions (scaled for PDF) - 150% bigger
const LOGO_WIDTH = 210
const LOGO_HEIGHT = 87

// Cache for embedded logo
let cachedLogoPage: Uint8Array | null = null

/**
 * Load the official Workx logo PDF (always reload to pick up new logos)
 */
async function loadLogoPdf(): Promise<Uint8Array | null> {
  // Always reload to ensure latest logo is used
  cachedLogoPage = null

  try {
    // Try to load from public folder
    const logoPath = path.join(process.cwd(), 'public', 'workx-logo.pdf')
    if (fs.existsSync(logoPath)) {
      cachedLogoPage = fs.readFileSync(logoPath)
      return cachedLogoPage
    }
  } catch (err) {
    console.error('Error loading logo PDF:', err)
  }
  return null
}

/**
 * Draw Workx logo on a PDF page using the official logo PDF
 * Position: top-left, flush against top edge
 */
async function drawWorkxLogo(
  page: PDFPage,
  pdfDoc: PDFDocument
) {
  const pageHeight = page.getHeight()
  const marginLeft = 0 // Flush left
  const marginTop = 0  // Flush top

  // Try to embed the official logo
  const logoBytes = await loadLogoPdf()

  if (logoBytes) {
    try {
      const logoPdf = await PDFDocument.load(logoBytes)
      const [embeddedPage] = await pdfDoc.embedPdf(logoPdf, [0])

      // Get original dimensions and scale to fit
      const { width: origWidth, height: origHeight } = embeddedPage
      const scale = Math.min(LOGO_WIDTH / origWidth, LOGO_HEIGHT / origHeight)
      const scaledWidth = origWidth * scale
      const scaledHeight = origHeight * scale

      // Position: top-left, flush against top
      const logoY = pageHeight - scaledHeight - marginTop

      page.drawPage(embeddedPage, {
        x: marginLeft,
        y: logoY,
        width: scaledWidth,
        height: scaledHeight,
      })
      return
    } catch (err) {
      console.error('Error embedding logo PDF:', err)
    }
  }

  // Fallback to text-based logo if PDF fails
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const logoY = pageHeight - LOGO_HEIGHT - marginTop

  page.drawRectangle({
    x: marginLeft,
    y: logoY,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
  })

  page.drawText('Workx', {
    x: marginLeft + 20,
    y: logoY + 35,
    size: 42,
    font: helvetica,
    color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
  })

  page.drawText('ADVOCATEN', {
    x: marginLeft + 20,
    y: logoY + 12,
    size: 14,
    font: helvetica,
    color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
  })
}

/**
 * Detect actual document type from URL (data: or https://)
 * More reliable than stored documentType
 */
function detectDocumentType(url: string | null, storedType: string | null): string {
  if (!url) return storedType || 'unknown'

  // Blob URLs (https://) — rely on stored type or file extension
  if (url.startsWith('https://')) {
    if (storedType && storedType !== 'other' && storedType !== 'unknown') return storedType
    const lower = url.toLowerCase()
    if (lower.includes('.pdf')) return 'pdf'
    if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) return 'image'
    if (/\.(doc|docx)/.test(lower)) return 'docx'
    if (/\.(xls|xlsx)/.test(lower)) return 'excel'
    if (/\.(ppt|pptx)/.test(lower)) return 'powerpoint'
    return storedType || 'unknown'
  }

  // Check the MIME type in the data URL
  if (url.startsWith('data:application/pdf')) return 'pdf'
  if (url.startsWith('data:image/')) return 'image'
  if (url.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) return 'docx'
  if (url.includes('application/msword')) return 'docx'
  if (url.includes('application/vnd.openxmlformats-officedocument.spreadsheetml')) return 'excel'
  if (url.includes('application/vnd.ms-excel')) return 'excel'
  if (url.includes('application/vnd.openxmlformats-officedocument.presentationml')) return 'powerpoint'
  if (url.includes('application/vnd.ms-powerpoint')) return 'powerpoint'

  // Fallback to stored type
  return storedType || 'unknown'
}

/**
 * Get document bytes from either a data: URL (base64) or an https:// URL (blob storage)
 */
async function getDocumentBytes(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1]
      if (!base64Data) return null
      return Buffer.from(base64Data, 'base64')
    }
    if (url.startsWith('https://')) {
      const response = await fetch(url)
      if (!response.ok) return null
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
    return null
  } catch (err) {
    console.error('Error fetching document bytes:', err)
    return null
  }
}

// POST - Generate PDF for bundle
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Get options from request body (optional)
    let includeLogoOnProcesstuk = true // default: include logo
    let splitMode = false
    let maxSizeMB = 20
    try {
      const body = await req.json()
      if (typeof body.includeLogoOnProcesstuk === 'boolean') {
        includeLogoOnProcesstuk = body.includeLogoOnProcesstuk
      }
      if (typeof body.split === 'boolean') {
        splitMode = body.split
      }
      if (typeof body.maxSizeMB === 'number') {
        maxSizeMB = body.maxSizeMB
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const bundle = await prisma.workxflowBundle.findUnique({
      where: { id: params.id },
      include: {
        productions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle niet gevonden' }, { status: 404 })
    }

    // Check access: owner or shared user
    if (bundle.createdById !== session.user.id) {
      const access = await prisma.bundleAccess.findUnique({
        where: { bundleId_userId: { bundleId: params.id, userId: session.user.id } },
      })
      if (!access) {
        return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
      }
    }

    // Create new PDF document
    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // A4 size in points (595.28 x 841.89)
    const pageWidth = 595.28
    const pageHeight = 841.89

    // ============================================
    // 1. PROCESSTUK (main document) - FIRST
    // ============================================
    const mainDocType = detectDocumentType(bundle.mainDocumentUrl, bundle.mainDocumentType)

    if (bundle.mainDocumentUrl && mainDocType === 'pdf') {
      try {
        const mainDocBytes = await getDocumentBytes(bundle.mainDocumentUrl)
        if (mainDocBytes) {
          const mainPdf = await PDFDocument.load(mainDocBytes)
          const mainPages = await pdfDoc.copyPages(mainPdf, mainPdf.getPageIndices())
          for (const page of mainPages) {
            pdfDoc.addPage(page)
            // Add Workx logo to each page of the processtuk (top-left) - optional
            if (includeLogoOnProcesstuk) {
              await drawWorkxLogo(page, pdfDoc)
            }
          }
        }
      } catch (err) {
        console.error('Error adding main document:', err)
      }
    }

    // ============================================
    // 2. PRODUCTIELIJST page (logo + title + list)
    // ============================================
    const productionLabel = bundle.productionLabel || 'PRODUCTIE'
    const listTitle = productionLabel === 'BIJLAGE' ? 'Bijlagenlijst' : 'Productielijst'

    if (bundle.productions.length > 0 && bundle.includeProductielijst) {
      const indexPage = pdfDoc.addPage([pageWidth, pageHeight])

      // Add Workx logo (top-left)
      await drawWorkxLogo(indexPage, pdfDoc)

      // Title
      indexPage.drawText(listTitle, {
        x: 30,
        y: pageHeight - 110,
        size: 28,
        font: helveticaBold,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      // Production list - starting below title
      let y = pageHeight - 160

      for (const production of bundle.productions) {
        // Yellow highlight box for production number
        const numText = String(production.productionNumber)
        const numWidth = Math.max(40, helveticaBold.widthOfTextAtSize(numText, 14) + 16)
        indexPage.drawRectangle({
          x: 30,
          y: y - 8,
          width: numWidth,
          height: 28,
          color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
        })

        // Production number
        indexPage.drawText(numText, {
          x: 38,
          y: y,
          size: 14,
          font: helveticaBold,
          color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
        })

        // Production title
        indexPage.drawText(production.title, {
          x: 30 + numWidth + 15,
          y: y,
          size: 12,
          font: helvetica,
          color: rgb(0, 0, 0),
        })

        y -= 38

        // Check if we need a new page
        if (y < 80) {
          break
        }
      }
    }

    // ============================================
    // 3. PRODUCTIONS (sheet + documents for each)
    // ============================================
    for (const production of bundle.productions) {
      // Add production sheet (yellow page with logo)
      const sheetPage = pdfDoc.addPage([pageWidth, pageHeight])

      // Yellow background
      sheetPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
      })

      // Add Workx logo to production sheet (top-left)
      await drawWorkxLogo(sheetPage, pdfDoc)

      // Production number - large centered text
      const productionText = `${productionLabel} ${production.productionNumber}`
      const textWidth = helveticaBold.widthOfTextAtSize(productionText, 48)

      sheetPage.drawText(productionText, {
        x: (pageWidth - textWidth) / 2,
        y: pageHeight / 2,
        size: 48,
        font: helveticaBold,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      // Production title below
      const titleWidth = helvetica.widthOfTextAtSize(production.title, 16)
      sheetPage.drawText(production.title, {
        x: (pageWidth - titleWidth) / 2,
        y: pageHeight / 2 - 50,
        size: 16,
        font: helvetica,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      // Detect actual document type from the data URL
      const docType = detectDocumentType(production.documentUrl, production.documentType)

      // Add production document if present (NO logo on attachments)
      if (production.documentUrl && docType === 'pdf') {
        try {
          const prodDocBytes = await getDocumentBytes(production.documentUrl)
          if (prodDocBytes) {
            const prodPdf = await PDFDocument.load(prodDocBytes)
            const prodPages = await pdfDoc.copyPages(prodPdf, prodPdf.getPageIndices())
            prodPages.forEach(page => pdfDoc.addPage(page))
          }
        } catch (err) {
          console.error('Error adding production document:', err)
        }
      } else if (production.documentUrl && docType === 'image') {
        try {
          const imgBytes = await getDocumentBytes(production.documentUrl)
          if (imgBytes) {
            const isJpg = production.documentUrl.includes('jpeg') || production.documentUrl.includes('jpg')
              || production.documentName?.toLowerCase().includes('.jpg')
              || production.documentName?.toLowerCase().includes('.jpeg')
            const image = isJpg
              ? await pdfDoc.embedJpg(imgBytes)
              : await pdfDoc.embedPng(imgBytes)

            const imgPage = pdfDoc.addPage([pageWidth, pageHeight])
            const imgDims = image.scale(1)

            // Scale to fit page with margins
            const maxWidth = pageWidth - 100
            const maxHeight = pageHeight - 100
            let scale = 1
            if (imgDims.width > maxWidth) scale = maxWidth / imgDims.width
            if (imgDims.height * scale > maxHeight) scale = maxHeight / imgDims.height

            const finalWidth = imgDims.width * scale
            const finalHeight = imgDims.height * scale

            imgPage.drawImage(image, {
              x: (pageWidth - finalWidth) / 2,
              y: (pageHeight - finalHeight) / 2,
              width: finalWidth,
              height: finalHeight,
            })
          }
        } catch (err) {
          console.error('Error adding production image:', err)
        }
      } else if (production.documentUrl && (docType === 'excel' || docType === 'powerpoint' || docType === 'docx')) {
        // For Office documents that can't be embedded, add a placeholder page
        const placeholderPage = pdfDoc.addPage([pageWidth, pageHeight])

        // File type label and color
        let typeLabel = 'Document'
        let typeColor = { r: 0.3, g: 0.3, b: 0.3 }
        if (docType === 'excel') {
          typeLabel = 'Excel Bestand'
          typeColor = { r: 0.13, g: 0.55, b: 0.13 } // Green
        } else if (docType === 'powerpoint') {
          typeLabel = 'PowerPoint Bestand'
          typeColor = { r: 0.85, g: 0.33, b: 0.1 } // Orange
        } else if (docType === 'docx') {
          typeLabel = 'Word Document'
          typeColor = { r: 0.1, g: 0.4, b: 0.8 } // Blue
        }

        // Draw placeholder content
        const labelWidth = helveticaBold.widthOfTextAtSize(typeLabel, 24)
        placeholderPage.drawText(typeLabel, {
          x: (pageWidth - labelWidth) / 2,
          y: pageHeight / 2 + 30,
          size: 24,
          font: helveticaBold,
          color: rgb(typeColor.r, typeColor.g, typeColor.b),
        })

        // Document name
        const docName = production.documentName || production.title
        const nameWidth = helvetica.widthOfTextAtSize(docName, 14)
        placeholderPage.drawText(docName, {
          x: (pageWidth - nameWidth) / 2,
          y: pageHeight / 2 - 10,
          size: 14,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        })

        // Note
        const note = '(Zie origineel bestand)'
        const noteWidth = helvetica.widthOfTextAtSize(note, 11)
        placeholderPage.drawText(note, {
          x: (pageWidth - noteWidth) / 2,
          y: pageHeight / 2 - 40,
          size: 11,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        })
      }
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()
    const totalSizeMB = pdfBytes.length / (1024 * 1024)

    // If split mode or PDF exceeds max size, split into parts
    if (splitMode || totalSizeMB > maxSizeMB) {
      const maxSizeBytes = maxSizeMB * 1024 * 1024
      const parts: Array<{ name: string; data: string }> = []

      // Strategy: split by production groups
      // Part 1: Processtuk + productielijst
      // Part 2+: Productions in batches that fit under maxSize

      const totalPages = pdfDoc.getPageCount()

      // Count pages for processtuk + productielijst
      let headerPageCount = 0
      if (bundle.mainDocumentUrl && mainDocType === 'pdf') {
        try {
          const mainDocBytes = await getDocumentBytes(bundle.mainDocumentUrl)
          if (mainDocBytes) {
            const mainPdf = await PDFDocument.load(mainDocBytes)
            headerPageCount += mainPdf.getPageCount()
          }
        } catch { /* ignore */ }
      }
      if (bundle.productions.length > 0 && bundle.includeProductielijst) {
        headerPageCount += 1 // productielijst page
      }

      // Build page ranges for each production (sheet + document pages)
      const productionPageRanges: Array<{ label: string; startPage: number; endPage: number }> = []
      let currentPage = headerPageCount

      for (const production of bundle.productions) {
        const startPage = currentPage
        currentPage += 1 // production sheet

        const docType = detectDocumentType(production.documentUrl, production.documentType)
        if (production.documentUrl && docType === 'pdf') {
          try {
            const prodDocBytes = await getDocumentBytes(production.documentUrl)
            if (prodDocBytes) {
              const prodPdf = await PDFDocument.load(prodDocBytes)
              currentPage += prodPdf.getPageCount()
            }
          } catch { /* ignore */ }
        } else if (production.documentUrl && (docType === 'image' || docType === 'excel' || docType === 'powerpoint' || docType === 'docx')) {
          currentPage += 1 // placeholder/image page
        }

        productionPageRanges.push({
          label: `${productionLabel} ${production.productionNumber}`,
          startPage,
          endPage: currentPage - 1,
        })
      }

      // Part 1: Header (processtuk + productielijst)
      if (headerPageCount > 0) {
        const headerPdf = await PDFDocument.create()
        const headerPages = await headerPdf.copyPages(pdfDoc, Array.from({ length: headerPageCount }, (_, i) => i))
        headerPages.forEach(p => headerPdf.addPage(p))
        const headerBytes = await headerPdf.save()
        parts.push({
          name: `${bundle.title.replace(/\s+/g, '-')}-processtuk.pdf`,
          data: Buffer.from(headerBytes).toString('base64'),
        })
      }

      // Remaining parts: group productions to fit under maxSize
      let currentPartProductions: typeof productionPageRanges = []
      let currentPartEstimate = 0

      for (let i = 0; i < productionPageRanges.length; i++) {
        const range = productionPageRanges[i]
        const pageCount = range.endPage - range.startPage + 1

        // Rough estimate: total PDF size / total pages * pages in this production
        const estimatedSize = (pdfBytes.length / totalPages) * pageCount

        if (currentPartProductions.length > 0 && currentPartEstimate + estimatedSize > maxSizeBytes) {
          // Flush current part
          const partPdf = await PDFDocument.create()
          const firstProd = currentPartProductions[0]
          const lastProd = currentPartProductions[currentPartProductions.length - 1]
          const pageIndices: number[] = []
          for (const prod of currentPartProductions) {
            for (let p = prod.startPage; p <= prod.endPage; p++) {
              pageIndices.push(p)
            }
          }
          const copiedPages = await partPdf.copyPages(pdfDoc, pageIndices)
          copiedPages.forEach(p => partPdf.addPage(p))
          const partBytes = await partPdf.save()
          parts.push({
            name: `${bundle.title.replace(/\s+/g, '-')}-${firstProd.label}-tm-${lastProd.label}.pdf`.replace(/\s+/g, '-'),
            data: Buffer.from(partBytes).toString('base64'),
          })

          currentPartProductions = []
          currentPartEstimate = 0
        }

        currentPartProductions.push(range)
        currentPartEstimate += estimatedSize
      }

      // Flush remaining
      if (currentPartProductions.length > 0) {
        const partPdf = await PDFDocument.create()
        const firstProd = currentPartProductions[0]
        const lastProd = currentPartProductions[currentPartProductions.length - 1]
        const pageIndices: number[] = []
        for (const prod of currentPartProductions) {
          for (let p = prod.startPage; p <= prod.endPage; p++) {
            pageIndices.push(p)
          }
        }
        const copiedPages = await partPdf.copyPages(pdfDoc, pageIndices)
        copiedPages.forEach(p => partPdf.addPage(p))
        const partBytes = await partPdf.save()
        parts.push({
          name: `${bundle.title.replace(/\s+/g, '-')}-${firstProd.label}-tm-${lastProd.label}.pdf`.replace(/\s+/g, '-'),
          data: Buffer.from(partBytes).toString('base64'),
        })
      }

      // Return JSON with parts
      return NextResponse.json({
        split: true,
        totalSizeMB: Math.round(totalSizeMB * 10) / 10,
        parts: parts.map(p => ({
          name: p.name,
          sizeMB: Math.round((Buffer.from(p.data, 'base64').length / (1024 * 1024)) * 10) / 10,
          data: `data:application/pdf;base64,${p.data}`,
        })),
      })
    }

    // Return single PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${bundle.title.replace(/\s+/g, '-')}-compleet.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Kon PDF niet genereren' }, { status: 500 })
  }
}
