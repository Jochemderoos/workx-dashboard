import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'

// Workx brand colors
const WORKX_LIME = { r: 249/255, g: 255/255, b: 133/255 }
const WORKX_DARK = { r: 30/255, g: 30/255, b: 30/255 }

// Logo dimensions (scaled for PDF)
const LOGO_WIDTH = 120
const LOGO_HEIGHT = 50

/**
 * Draw Workx logo on a PDF page
 * CORRECT STYLE: Yellow background with black text (like dashboard sidebar)
 */
async function drawWorkxLogo(
  page: PDFPage,
  pdfDoc: PDFDocument,
  x: number = 30,
  y?: number
) {
  const pageHeight = page.getHeight()
  const logoY = y ?? (pageHeight - LOGO_HEIGHT - 30)

  // Load fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Yellow background (the Workx brand color)
  page.drawRectangle({
    x: x,
    y: logoY,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
  })

  // "Workx" text in dark color
  page.drawText('Workx', {
    x: x + 15,
    y: logoY + 20,
    size: 26,
    font: helvetica,
    color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
  })

  // "ADVOCATEN" text in dark color
  page.drawText('ADVOCATEN', {
    x: x + 15,
    y: logoY + 8,
    size: 8,
    font: helvetica,
    color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
  })
}

/**
 * Detect actual document type from data URL
 * More reliable than stored documentType
 */
function detectDocumentType(dataUrl: string | null, storedType: string | null): string {
  if (!dataUrl) return storedType || 'unknown'

  // Check the MIME type in the data URL
  if (dataUrl.startsWith('data:application/pdf')) return 'pdf'
  if (dataUrl.startsWith('data:image/')) return 'image'
  if (dataUrl.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) return 'docx'
  if (dataUrl.includes('application/msword')) return 'docx'
  if (dataUrl.includes('application/vnd.openxmlformats-officedocument.spreadsheetml')) return 'excel'
  if (dataUrl.includes('application/vnd.ms-excel')) return 'excel'
  if (dataUrl.includes('application/vnd.openxmlformats-officedocument.presentationml')) return 'powerpoint'
  if (dataUrl.includes('application/vnd.ms-powerpoint')) return 'powerpoint'

  // Fallback to stored type
  return storedType || 'unknown'
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

    if (bundle.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
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
        const base64Data = bundle.mainDocumentUrl.split(',')[1]
        if (base64Data) {
          const mainDocBytes = Buffer.from(base64Data, 'base64')
          const mainPdf = await PDFDocument.load(mainDocBytes)
          const mainPages = await pdfDoc.copyPages(mainPdf, mainPdf.getPageIndices())
          for (const page of mainPages) {
            pdfDoc.addPage(page)
            // Add Workx logo to each page of the processtuk (top-left)
            await drawWorkxLogo(page, pdfDoc, 30)
          }
        }
      } catch (err) {
        console.error('Error adding main document:', err)
      }
    }

    // ============================================
    // 2. PRODUCTIELIJST page (logo + title + list)
    // ============================================
    if (bundle.productions.length > 0) {
      const indexPage = pdfDoc.addPage([pageWidth, pageHeight])

      // Add Workx logo (top-left)
      await drawWorkxLogo(indexPage, pdfDoc, 30, pageHeight - LOGO_HEIGHT - 30)

      // Title "Productielijst"
      indexPage.drawText('Productielijst', {
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
        indexPage.drawRectangle({
          x: 30,
          y: y - 8,
          width: 40,
          height: 28,
          color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
        })

        // Production number
        indexPage.drawText(String(production.productionNumber), {
          x: 42,
          y: y,
          size: 14,
          font: helveticaBold,
          color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
        })

        // Production title
        indexPage.drawText(production.title, {
          x: 85,
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
      // On yellow background, use a subtle border effect
      sheetPage.drawRectangle({
        x: 28,
        y: pageHeight - LOGO_HEIGHT - 32,
        width: LOGO_WIDTH + 4,
        height: LOGO_HEIGHT + 4,
        borderColor: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
        borderWidth: 1,
        color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
      })

      // Logo text on yellow page
      sheetPage.drawText('Workx', {
        x: 45,
        y: pageHeight - LOGO_HEIGHT - 10,
        size: 26,
        font: helvetica,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })
      sheetPage.drawText('ADVOCATEN', {
        x: 45,
        y: pageHeight - LOGO_HEIGHT - 22,
        size: 8,
        font: helvetica,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      // Production number - large centered text
      const productionText = `PRODUCTIE ${production.productionNumber}`
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
          const base64Data = production.documentUrl.split(',')[1]
          if (base64Data) {
            const prodDocBytes = Buffer.from(base64Data, 'base64')
            const prodPdf = await PDFDocument.load(prodDocBytes)
            const prodPages = await pdfDoc.copyPages(prodPdf, prodPdf.getPageIndices())
            prodPages.forEach(page => pdfDoc.addPage(page))
          }
        } catch (err) {
          console.error('Error adding production document:', err)
        }
      } else if (production.documentUrl && docType === 'image') {
        try {
          const base64Data = production.documentUrl.split(',')[1]
          if (base64Data) {
            const imgBytes = Buffer.from(base64Data, 'base64')
            const isJpg = production.documentUrl.includes('jpeg') || production.documentUrl.includes('jpg')
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

    // Return PDF
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
