import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Workx brand colors
const WORKX_LIME = { r: 249/255, g: 255/255, b: 133/255 }
const WORKX_DARK = { r: 30/255, g: 30/255, b: 30/255 }

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

    // 1. Create production index / cover page
    const indexPage = pdfDoc.addPage([pageWidth, pageHeight])

    // Header
    indexPage.drawText('PRODUCTIE-OVERZICHT', {
      x: 50,
      y: pageHeight - 80,
      size: 24,
      font: helveticaBold,
      color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
    })

    // Bundle info
    let y = pageHeight - 130
    indexPage.drawText(bundle.title, {
      x: 50,
      y,
      size: 16,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })

    y -= 25
    if (bundle.caseNumber) {
      indexPage.drawText(`Zaaknummer: ${bundle.caseNumber}`, {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      })
      y -= 18
    }

    if (bundle.clientName) {
      indexPage.drawText(`Cliënt: ${bundle.clientName}`, {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      })
      y -= 18
    }

    // Date
    indexPage.drawText(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, {
      x: 50,
      y,
      size: 11,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    })

    // Production list
    y -= 50
    indexPage.drawText('Producties:', {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })

    y -= 30
    for (const production of bundle.productions) {
      // Yellow highlight box
      indexPage.drawRectangle({
        x: 48,
        y: y - 5,
        width: 30,
        height: 20,
        color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
      })

      indexPage.drawText(String(production.productionNumber), {
        x: 56,
        y,
        size: 12,
        font: helveticaBold,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      indexPage.drawText(production.title, {
        x: 90,
        y,
        size: 11,
        font: helvetica,
        color: rgb(0, 0, 0),
      })

      y -= 28

      // Check if we need a new page
      if (y < 100) {
        // Add continuation on new page (simplified for now)
        break
      }
    }

    // 2. Add main document if present
    if (bundle.mainDocumentUrl && bundle.mainDocumentType === 'pdf') {
      try {
        // Extract base64 data
        const base64Data = bundle.mainDocumentUrl.split(',')[1]
        if (base64Data) {
          const mainDocBytes = Buffer.from(base64Data, 'base64')
          const mainPdf = await PDFDocument.load(mainDocBytes)
          const mainPages = await pdfDoc.copyPages(mainPdf, mainPdf.getPageIndices())
          mainPages.forEach(page => pdfDoc.addPage(page))
        }
      } catch (err) {
        console.error('Error adding main document:', err)
      }
    }

    // 3. Add productions with their sheets
    for (const production of bundle.productions) {
      // Add production sheet (yellow page)
      const sheetPage = pdfDoc.addPage([pageWidth, pageHeight])

      // Yellow background
      sheetPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
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

      // Add production document if present
      if (production.documentUrl && production.documentType === 'pdf') {
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
      } else if (production.documentUrl && production.documentType === 'image') {
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
      }
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Return PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${bundle.title.replace(/\s+/g, '-')}-bundle.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Kon PDF niet genereren' }, { status: 500 })
  }
}
