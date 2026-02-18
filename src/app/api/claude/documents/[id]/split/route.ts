import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

interface PageRange {
  start: number
  end: number
  label?: string
}

// POST: split a PDF document into multiple documents by page ranges
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { pageRanges } = await req.json() as { pageRanges: PageRange[] }

  if (!pageRanges || !Array.isArray(pageRanges) || pageRanges.length === 0) {
    return NextResponse.json({ error: 'Geen paginabereiken opgegeven' }, { status: 400 })
  }

  // Validate page ranges
  for (const range of pageRanges) {
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 1 || range.end < range.start) {
      return NextResponse.json({ error: `Ongeldig paginabereik: ${range.start}-${range.end}` }, { status: 400 })
    }
  }

  // Fetch the source document
  const document = await prisma.aIDocument.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
      fileType: 'pdf',
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'PDF niet gevonden' }, { status: 404 })
  }

  if (!document.fileUrl?.startsWith('data:application/pdf;base64,')) {
    return NextResponse.json({ error: 'PDF-bestandsgegevens niet beschikbaar' }, { status: 400 })
  }

  try {
    const { PDFDocument } = await import('pdf-lib')
    const base64Data = document.fileUrl.split(',')[1]
    const pdfBytes = Buffer.from(base64Data, 'base64')
    const sourcePdf = await PDFDocument.load(pdfBytes)
    const totalPages = sourcePdf.getPageCount()

    // Validate ranges against actual page count
    for (const range of pageRanges) {
      if (range.end > totalPages) {
        return NextResponse.json(
          { error: `Paginabereik ${range.start}-${range.end} overschrijdt het aantal pagina's (${totalPages})` },
          { status: 400 }
        )
      }
    }

    // Extract text per page for split documents
    let pageTexts: string[] = []
    try {
      pageTexts = await extractTextPerPage(pdfBytes)
    } catch {
      // Text extraction is best-effort
    }

    const baseName = document.name.replace(/\.pdf$/i, '')
    const createdDocs: Array<{ id: string; name: string; fileType: string; fileSize: number; createdAt: string }> = []

    for (const range of pageRanges) {
      const newPdf = await PDFDocument.create()
      // pdf-lib uses 0-based page indices
      const pageIndices = Array.from(
        { length: range.end - range.start + 1 },
        (_, i) => range.start - 1 + i
      )
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
      for (const page of copiedPages) {
        newPdf.addPage(page)
      }

      const newPdfBytes = await newPdf.save()
      const newBase64 = Buffer.from(newPdfBytes).toString('base64')
      const fileUrl = `data:application/pdf;base64,${newBase64}`

      // Build text content for this range
      let textContent = ''
      if (pageTexts.length > 0) {
        const rangeTexts = pageTexts.slice(range.start - 1, range.end).filter(Boolean)
        textContent = rangeTexts.join('\n\n')
      }

      const label = range.label || `p${range.start}-${range.end}`
      const newName = `${baseName} (${label}).pdf`

      const newDoc = await prisma.aIDocument.create({
        data: {
          name: newName,
          fileType: 'pdf',
          fileSize: newPdfBytes.length,
          content: textContent || null,
          fileUrl,
          projectId: document.projectId,
          userId: session.user.id,
        },
      })

      createdDocs.push({
        id: newDoc.id,
        name: newDoc.name,
        fileType: newDoc.fileType,
        fileSize: newDoc.fileSize,
        createdAt: newDoc.createdAt.toISOString(),
      })
    }

    return NextResponse.json({
      documents: createdDocs,
      totalPages,
    })
  } catch (err) {
    console.error('[split] Error splitting PDF:', err)
    return NextResponse.json(
      { error: 'Fout bij het splitsen van de PDF. Controleer of het bestand niet beschadigd of beveiligd is.' },
      { status: 500 }
    )
  }
}

// GET: get page count for a PDF document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const document = await prisma.aIDocument.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
      fileType: 'pdf',
    },
    select: { id: true, name: true, fileUrl: true },
  })

  if (!document) {
    return NextResponse.json({ error: 'PDF niet gevonden' }, { status: 404 })
  }

  if (!document.fileUrl?.startsWith('data:application/pdf;base64,')) {
    return NextResponse.json({ error: 'PDF-bestandsgegevens niet beschikbaar' }, { status: 400 })
  }

  try {
    const { PDFDocument } = await import('pdf-lib')
    const base64Data = document.fileUrl.split(',')[1]
    const pdfBytes = Buffer.from(base64Data, 'base64')
    const pdf = await PDFDocument.load(pdfBytes)

    return NextResponse.json({
      pageCount: pdf.getPageCount(),
      name: document.name,
    })
  } catch {
    return NextResponse.json({ error: 'Kon PDF niet lezen' }, { status: 500 })
  }
}

/** Extract text per page using pdfjs-dist */
async function extractTextPerPage(pdfBytes: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getDocument: any
  try {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
    getDocument = mod.getDocument
  } catch {
    const mod = await import('pdfjs-dist')
    getDocument = mod.getDocument
  }

  const uint8 = new Uint8Array(pdfBytes)
  const doc = await getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(' ')
    pages.push(pageText.trim())
  }
  return pages
}
