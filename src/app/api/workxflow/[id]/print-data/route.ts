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

    if (bundle.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
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

    // 2. Production sheets PDF (Tray 2 - yellow paper with logo, only "PRODUCTIE X" text)
    const sheetsPdf = await PDFDocument.create()
    const helveticaBold = await sheetsPdf.embedFont(StandardFonts.HelveticaBold)

    for (const production of bundle.productions) {
      const sheetPage = sheetsPdf.addPage([pageWidth, pageHeight])

      // NO background color - the paper is already yellow with logo
      // Just add the text "PRODUCTIE X" centered

      const productionText = `PRODUCTIE ${production.productionNumber}`
      const textWidth = helveticaBold.widthOfTextAtSize(productionText, 48)

      sheetPage.drawText(productionText, {
        x: (pageWidth - textWidth) / 2,
        y: pageHeight / 2,
        size: 48,
        font: helveticaBold,
        color: rgb(WORKX_DARK.r, WORKX_DARK.g, WORKX_DARK.b),
      })
    }

    const sheetsBytes = await sheetsPdf.save()
    const sheetsPdfBase64 = `data:application/pdf;base64,${Buffer.from(sheetsBytes).toString('base64')}`

    // 3. Production documents (Tray 1 - normal paper)
    const productionDocuments: Array<{
      productionNumber: number
      title: string
      documentUrl: string | null
      documentType: string | null
    }> = bundle.productions.map(p => ({
      productionNumber: p.productionNumber,
      title: p.title,
      documentUrl: p.documentUrl,
      documentType: p.documentType,
    }))

    // Return print data structure
    return NextResponse.json({
      bundleId: bundle.id,
      bundleTitle: bundle.title,
      caseNumber: bundle.caseNumber,
      clientName: bundle.clientName,

      // Print jobs organized by tray
      printJobs: [
        // Job 1: Main document (processtuk) - Tray 1, NO logo (logo pre-printed on paper)
        {
          name: 'Processtuk',
          tray: 1, // Normal paper tray
          copies: 1,
          documentUrl: mainDocumentPdf,
          description: 'Hoofddocument - printen op briefpapier (logo al aanwezig)',
        },

        // Job 2: Production sheets - Tray 2, yellow paper with logo
        {
          name: 'Productiebladen',
          tray: 2, // Yellow paper tray
          copies: 1,
          documentUrl: sheetsPdfBase64,
          description: 'Productiebladen - printen op geel papier (logo al aanwezig)',
        },

        // Job 3+: Individual production documents - Tray 1, normal paper
        ...productionDocuments
          .filter(p => p.documentUrl)
          .map((p, index) => ({
            name: `Productie ${p.productionNumber}: ${p.title}`,
            tray: 1, // Normal paper tray
            copies: 1,
            documentUrl: p.documentUrl,
            description: `Bijlage productie ${p.productionNumber}`,
          })),
      ],

      // Print order instructions
      printOrder: [
        'Processtuk eerst printen op briefpapier (lade 1)',
        'Dan productiebladen op geel papier (lade 2)',
        'Daarna de bijlagen per productie op normaal papier (lade 1)',
      ],

      // Tray configuration hints for the desktop app
      trayConfig: {
        1: {
          name: 'Normaal/Briefpapier',
          description: 'Wit papier met Workx logo (voor processtuk en bijlagen)',
          paperType: 'letterhead',
        },
        2: {
          name: 'Geel productie-papier',
          description: 'Geel papier met Workx logo (voor productiebladen)',
          paperType: 'yellow-letterhead',
        },
      },
    })
  } catch (error) {
    console.error('Error generating print data:', error)
    return NextResponse.json({ error: 'Kon print data niet genereren' }, { status: 500 })
  }
}
