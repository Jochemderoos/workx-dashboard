import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Workx brand colors
const WORKX_LIME = { r: 249/255, g: 255/255, b: 133/255 }
const WORKX_DARK = { r: 30/255, g: 30/255, b: 30/255 }

/**
 * POST - Generate print data for Electron
 *
 * Returns structured data for printing to different trays:
 * - Tray 1: Normal white paper (for main document without logo - logo is pre-printed)
 * - Tray 2: Yellow paper with logo (for production sheets - only "PRODUCTIE X" text)
 *
 * The actual documents/attachments go to the normal tray.
 */
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

    // Check access: owner or shared user
    if (bundle.createdById !== session.user.id) {
      const access = await prisma.bundleAccess.findUnique({
        where: { bundleId_userId: { bundleId: params.id, userId: session.user.id } },
      })
      if (!access) {
        return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
      }
    }

    // A4 size in points
    const pageWidth = 595.28
    const pageHeight = 841.89

    // Create separate PDFs for different trays

    // 1. Main document PDF (Tray 1 - white paper, printed WITHOUT logo)
    let mainDocumentPdf: string | null = null
    if (bundle.mainDocumentUrl && bundle.mainDocumentType === 'pdf') {
      // Just pass through the original PDF
      mainDocumentPdf = bundle.mainDocumentUrl
    }

    // 2. Create individual production sheet PDFs (one per production)
    // and interleave with production documents for correct assembly order
    const helveticaBold = await PDFDocument.create().then(async d => {
      const font = await d.embedFont(StandardFonts.HelveticaBold)
      return font
    })

    const label = bundle.productionLabel || 'PRODUCTIE'
    const isBijlage = bundle.productionLabel === 'BIJLAGE'
    const listTitle = isBijlage ? 'Bijlagenlijst' : 'Productielijst'

    // Generate productielijst PDF page (same tray as processtuk)
    let productielijstPdf: string | null = null
    if (bundle.productions.length > 0 && bundle.includeProductielijst) {
      const listDoc = await PDFDocument.create()
      const listBoldFont = await listDoc.embedFont(StandardFonts.HelveticaBold)
      const listFont = await listDoc.embedFont(StandardFonts.Helvetica)
      const listPage = listDoc.addPage([pageWidth, pageHeight])

      // Title
      listPage.drawText(listTitle, {
        x: 30,
        y: pageHeight - 80,
        size: 28,
        font: listBoldFont,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      // Production list
      let y = pageHeight - 130
      for (const production of bundle.productions) {
        const numText = String(production.productionNumber)
        const numWidth = Math.max(40, listBoldFont.widthOfTextAtSize(numText, 14) + 16)

        // Yellow highlight box
        listPage.drawRectangle({
          x: 30,
          y: y - 8,
          width: numWidth,
          height: 28,
          color: rgb(WORKX_LIME.r, WORKX_LIME.g, WORKX_LIME.b),
        })

        // Production number
        listPage.drawText(numText, {
          x: 38,
          y: y,
          size: 14,
          font: listBoldFont,
          color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
        })

        // Production title
        listPage.drawText(production.title, {
          x: 30 + numWidth + 15,
          y: y,
          size: 12,
          font: listFont,
          color: rgb(0, 0, 0),
        })

        y -= 38
        if (y < 80) break
      }

      const listBytes = await listDoc.save()
      productielijstPdf = `data:application/pdf;base64,${Buffer.from(listBytes).toString('base64')}`
    }

    // Build interleaved print jobs: productievel → productie, per production
    const interleavedJobs: Array<{
      name: string
      tray: number
      copies: number
      documentUrl: string | null
      description: string
    }> = []

    for (const production of bundle.productions) {
      // Create individual production sheet PDF
      const sheetPdf = await PDFDocument.create()
      const sheetFont = await sheetPdf.embedFont(StandardFonts.HelveticaBold)
      const sheetPage = sheetPdf.addPage([pageWidth, pageHeight])

      const productionText = `${label} ${production.productionNumber}`
      const textWidth = sheetFont.widthOfTextAtSize(productionText, 48)

      sheetPage.drawText(productionText, {
        x: (pageWidth - textWidth) / 2,
        y: pageHeight / 2,
        size: 48,
        font: sheetFont,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })

      const sheetBytes = await sheetPdf.save()
      const sheetBase64 = `data:application/pdf;base64,${Buffer.from(sheetBytes).toString('base64')}`

      // Add production sheet (yellow paper)
      interleavedJobs.push({
        name: `Productievel ${production.productionNumber}`,
        tray: 2,
        copies: 1,
        documentUrl: sheetBase64,
        description: `Productievel ${production.productionNumber} - geel papier`,
      })

      // Add production document (normal paper) if it exists
      if (production.documentUrl) {
        interleavedJobs.push({
          name: `${isBijlage ? 'Bijlage' : 'Productie'} ${production.productionNumber}: ${production.title}`,
          tray: 1,
          copies: 1,
          documentUrl: production.documentUrl,
          description: `${isBijlage ? 'Bijlage' : 'Productie'} ${production.productionNumber}`,
        })
      }
    }

    // Return print data structure
    return NextResponse.json({
      bundleId: bundle.id,
      bundleTitle: bundle.title,
      caseNumber: bundle.caseNumber,
      clientName: bundle.clientName,

      // Print jobs: processtuk → productielijst → interleaved productievel + productie
      printJobs: [
        // Job 1: Main document (processtuk)
        {
          name: 'Processtuk',
          tray: 1,
          copies: 1,
          documentUrl: mainDocumentPdf,
          description: 'Hoofddocument - printen op briefpapier',
        },

        // Job 2: Productielijst (same tray as processtuk)
        ...(productielijstPdf ? [{
          name: listTitle,
          tray: 1,
          copies: 1,
          documentUrl: productielijstPdf,
          description: `${listTitle} - overzicht van alle producties`,
        }] : []),

        // Jobs 3+: Interleaved productievel → productie per production
        ...interleavedJobs,
      ],

      // Print order instructions
      printOrder: [
        'Processtuk eerst',
        ...(productielijstPdf ? [`${listTitle} (onderdeel processtuk)`] : []),
        'Dan per productie: productievel (geel) → bijlage (blanco)',
      ],
    })
  } catch (error) {
    console.error('Error generating print data:', error)
    return NextResponse.json({ error: 'Kon print data niet genereren' }, { status: 500 })
  }
}
