import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB (Claude ondersteunt PDFs tot 32MB)
const ALLOWED_TYPES = ['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp']
// PDFs over this size AND scanned get auto-split into pages
const AUTO_SPLIT_THRESHOLD = 2 * 1024 * 1024 // 2MB

// GET: lijst documenten (optioneel filter op projectId)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  // Documents stay user-scoped (chat attachments are personal)
  const where: Record<string, unknown> = { userId: session.user.id }

  if (projectId === 'null' || projectId === '') {
    where.projectId = null // Kennisbank (geen project)
  } else if (projectId) {
    where.projectId = projectId
  }

  const documents = await prisma.aIDocument.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      fileType: true,
      fileSize: true,
      projectId: true,
      createdAt: true,
    },
  })

  return NextResponse.json(documents)
}

// POST: document uploaden
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null
  const description = formData.get('description') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Geen bestand geselecteerd' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Bestand is te groot (max 32MB)' }, { status: 400 })
  }

  // Validate file type
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_TYPES.includes(extension)) {
    return NextResponse.json(
      { error: `Bestandstype niet ondersteund. Toegestaan: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  // Read file content
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Extract text content based on file type
  let textContent = ''

  if (extension === 'txt' || extension === 'md') {
    textContent = buffer.toString('utf-8')
  } else if (extension === 'pdf') {
    // For PDF: extract text using pdfjs-dist directly (no native canvas dependency)
    try {
      textContent = await extractTextFromPdfDirect(buffer)
      console.log(`[documents] PDF extracted: ${textContent.length} chars from ${file.name}`)
      // If extracted text is too short, it's likely a scanned document — try OCR
      if (textContent.length < 100 || textContent.includes('[Geen tekst gevonden')) {
        console.log(`[documents] PDF appears to be scanned, attempting OCR for ${file.name}`)
        try {
          const ocrText = await extractTextWithOCR(buffer)
          if (ocrText.length > textContent.length) {
            textContent = ocrText
            console.log(`[documents] OCR extracted: ${ocrText.length} chars from ${file.name}`)
          }
        } catch (ocrErr) {
          console.error(`[documents] OCR failed for ${file.name}:`, ocrErr instanceof Error ? ocrErr.message : ocrErr)
        }
      }
    } catch (pdfErr) {
      console.error(`[documents] pdfjs-dist failed for ${file.name}:`, pdfErr instanceof Error ? pdfErr.message : pdfErr)
      try {
        textContent = extractTextFromPdfBuffer(buffer)
        console.log(`[documents] PDF fallback extracted: ${textContent.length} chars from ${file.name}`)
      } catch (fallbackErr) {
        console.error(`[documents] PDF fallback also failed:`, fallbackErr)
        // Last resort: try OCR
        try {
          textContent = await extractTextWithOCR(buffer)
          console.log(`[documents] OCR fallback extracted: ${textContent.length} chars from ${file.name}`)
        } catch {
          textContent = '[PDF tekst kon niet worden geëxtraheerd — het document is mogelijk een scan zonder OCR-laag]'
        }
      }
    }
  } else if (extension === 'docx') {
    // For DOCX: extract plain text
    try {
      textContent = await extractTextFromDocx(buffer)
    } catch {
      textContent = '[DOCX tekst kon niet worden geëxtraheerd]'
    }
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    // For images: no text extraction needed, Claude will analyze the image directly
    textContent = `[Afbeelding: ${file.name}]`
  }

  // Store file as base64 data URL for native API support (PDFs, images)
  // PDFs up to 32MB: stored as base64 for native Claude document blocks
  // Images up to 10MB: stored as base64 for native Claude vision blocks
  // Other files: text content only, no base64 needed
  let fileUrl: string | null = null
  const isPdfOrImage = extension === 'pdf' || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)
  const maxBase64Size = isPdfOrImage ? 32 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size <= maxBase64Size) {
    const mimeType = file.type || `application/${extension}`
    fileUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
  }

  // Auto-split large scanned PDFs into individual pages.
  // This ensures each page is small enough for Claude's native document blocks,
  // allowing Claude to "see" scanned content via vision.
  const isScannedPdf = extension === 'pdf' && (
    !textContent ||
    textContent.length < 100 ||
    textContent.startsWith('[')
  )
  if (isScannedPdf && file.size > AUTO_SPLIT_THRESHOLD && fileUrl) {
    console.log(`[documents] Scanned PDF detected (${(file.size / 1024 / 1024).toFixed(1)}MB, ${textContent.length} chars text). Auto-splitting into pages...`)
    try {
      const splitDocs = await autoSplitPdf(buffer, file.name, fileUrl, projectId, session.user.id)
      if (splitDocs.length > 0) {
        console.log(`[documents] Auto-split ${file.name} into ${splitDocs.length} pages`)
        return NextResponse.json({
          ...splitDocs[0], // Return first page as the "main" document
          autoSplit: true,
          splitDocuments: splitDocs,
          totalPages: splitDocs.length,
          message: `PDF is automatisch opgesplitst in ${splitDocs.length} pagina's voor betere verwerking.`,
        }, { status: 201 })
      }
    } catch (splitErr) {
      console.error(`[documents] Auto-split failed for ${file.name}:`, splitErr instanceof Error ? splitErr.message : splitErr)
      // Fall through to normal document creation
    }
  }

  const document = await prisma.aIDocument.create({
    data: {
      name: file.name,
      description: description?.trim() || null,
      fileType: extension,
      fileSize: file.size,
      content: textContent || null,
      fileUrl,
      projectId: projectId && projectId !== 'null' ? projectId : null,
      userId: session.user.id,
    },
  })

  return NextResponse.json(document, { status: 201 })
}

/** Extract text from PDF using pdfjs-dist (works in serverless, no native deps) */
async function extractTextFromPdfDirect(buffer: Buffer): Promise<string> {
  // Try multiple import paths for pdfjs-dist compatibility across environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getDocument: any
  try {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
    getDocument = mod.getDocument
  } catch {
    // Fallback to main entry
    const mod = await import('pdfjs-dist')
    getDocument = mod.getDocument
  }

  const uint8 = new Uint8Array(buffer)
  const doc = await getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise

  console.log(`[documents] pdfjs loaded PDF: ${doc.numPages} pages`)

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(' ')
    if (pageText.trim()) pages.push(pageText.trim())
  }
  return pages.join('\n\n') || '[Geen tekst gevonden in PDF - mogelijk een gescand document]'
}

/** Extract text from PDF buffer using basic parsing */
function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Basic PDF text extraction - look for text between BT and ET operators
  const content = buffer.toString('latin1')
  const textParts: string[] = []

  // Match text objects between BT (Begin Text) and ET (End Text)
  const textBlocks = content.match(/BT[\s\S]*?ET/g) || []
  for (const block of textBlocks) {
    // Extract text from Tj and TJ operators
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || []
    for (const tj of tjMatches) {
      const match = tj.match(/\(([^)]*)\)/)
      if (match) textParts.push(match[1])
    }
  }

  return textParts.join(' ').trim() || '[Geen tekst gevonden in PDF - upload als TXT voor betere resultaten]'
}

/** Extract text from scanned PDF using Tesseract.js OCR (optional dependency) */
async function extractTextWithOCR(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import — tesseract.js is an optional dependency
    // Install with: npm install tesseract.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tesseract = require('tesseract.js') as { createWorker: (lang: string) => Promise<{ recognize: (buf: Buffer) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> }> }
    const worker = await tesseract.createWorker('nld+eng') // Dutch + English
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    return text.trim() || '[OCR kon geen tekst herkennen uit dit document]'
  } catch (err) {
    console.error('[documents] Tesseract OCR not available:', err instanceof Error ? err.message : err)
    return '[Gescand document — installeer tesseract.js voor OCR-ondersteuning: npm install tesseract.js]'
  }
}

/** Extract text from DOCX buffer */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  // DOCX is a ZIP containing XML files
  // We try a basic extraction from word/document.xml
  try {
    // @ts-expect-error adm-zip has no type declarations
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(buffer)
    const docEntry = zip.getEntry('word/document.xml')
    if (!docEntry) return '[Kon document.xml niet vinden in DOCX]'

    const xml = docEntry.getData().toString('utf-8')
    // Strip XML tags to get plain text
    const text = xml
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return text || '[Geen tekst gevonden in DOCX]'
  } catch {
    return '[DOCX parsing mislukt]'
  }
}

/** Auto-split a scanned PDF into individual pages for better Claude processing */
async function autoSplitPdf(
  buffer: Buffer,
  originalName: string,
  _originalFileUrl: string,
  projectId: string | null,
  userId: string,
): Promise<Array<{ id: string; name: string; fileType: string; fileSize: number; createdAt: Date }>> {
  const { PDFDocument } = await import('pdf-lib')
  const pdfBytes = new Uint8Array(buffer)
  const sourcePdf = await PDFDocument.load(pdfBytes)
  const totalPages = sourcePdf.getPageCount()

  // For very large PDFs, group pages (e.g., 3 per chunk) to keep document count manageable
  const pagesPerChunk = totalPages > 20 ? 3 : 1
  const baseName = originalName.replace(/\.pdf$/i, '')

  const createdDocs: Array<{ id: string; name: string; fileType: string; fileSize: number; createdAt: Date }> = []

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const endPage = Math.min(startPage + pagesPerChunk, totalPages)
    const newPdf = await PDFDocument.create()
    const pageIndices = Array.from({ length: endPage - startPage }, (_, i) => startPage + i)
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    for (const page of copiedPages) {
      newPdf.addPage(page)
    }

    const newPdfBytes = await newPdf.save()
    const newBase64 = Buffer.from(newPdfBytes).toString('base64')
    const newFileUrl = `data:application/pdf;base64,${newBase64}`

    // Try to extract text from this chunk
    let textContent = ''
    try {
      textContent = await extractTextFromPdfDirect(Buffer.from(newPdfBytes))
    } catch { /* best-effort */ }

    const label = pagesPerChunk === 1
      ? `p${startPage + 1}`
      : `p${startPage + 1}-${endPage}`
    const newName = `${baseName} (${label}).pdf`

    const doc = await prisma.aIDocument.create({
      data: {
        name: newName,
        fileType: 'pdf',
        fileSize: newPdfBytes.length,
        content: textContent || null,
        fileUrl: newFileUrl,
        projectId: projectId && projectId !== 'null' ? projectId : null,
        userId,
      },
    })

    createdDocs.push(doc)
  }

  return createdDocs
}
