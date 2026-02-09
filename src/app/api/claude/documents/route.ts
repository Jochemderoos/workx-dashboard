import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['pdf', 'docx', 'txt', 'md']

// GET: lijst documenten (optioneel filter op projectId)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

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
    return NextResponse.json({ error: 'Bestand is te groot (max 10MB)' }, { status: 400 })
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
    } catch (pdfErr) {
      console.error(`[documents] pdfjs-dist failed for ${file.name}:`, pdfErr instanceof Error ? pdfErr.message : pdfErr)
      try {
        textContent = extractTextFromPdfBuffer(buffer)
        console.log(`[documents] PDF fallback extracted: ${textContent.length} chars from ${file.name}`)
      } catch (fallbackErr) {
        console.error(`[documents] PDF fallback also failed:`, fallbackErr)
        textContent = '[PDF tekst kon niet worden geëxtraheerd]'
      }
    }
  } else if (extension === 'docx') {
    // For DOCX: extract plain text
    try {
      textContent = await extractTextFromDocx(buffer)
    } catch {
      textContent = '[DOCX tekst kon niet worden geëxtraheerd]'
    }
  }

  // Store file as base64 data URL for small files, or just text for larger ones
  let fileUrl: string | null = null
  if (file.size <= 5 * 1024 * 1024) {
    const mimeType = file.type || `application/${extension}`
    fileUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
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
