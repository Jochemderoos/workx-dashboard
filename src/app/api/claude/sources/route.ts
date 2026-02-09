import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: lijst alle bronnen
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const sources = await prisma.aISource.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      url: true,
      category: true,
      isActive: true,
      isProcessed: true,
      lastSynced: true,
      processedAt: true,
      pagesCrawled: true,
      createdAt: true,
      credentials: true, // Need to check if credentials exist
      // Exclude full content from list
      content: false,
      summary: false,
    },
  })

  // Don't send credentials content, just whether they exist
  const sanitized = sources.map(s => ({
    ...s,
    hasCredentials: !!s.credentials,
    credentials: undefined,
  }))

  return NextResponse.json(sanitized)
}

// POST: nieuwe bron toevoegen
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') || ''

  // Handle file upload (document source)
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const category = formData.get('category') as string || 'arbeidsrecht'

    if (!file || !name?.trim()) {
      return NextResponse.json({ error: 'Naam en bestand zijn verplicht' }, { status: 400 })
    }

    // Extract text from uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    let content = ''
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    if (ext === 'txt' || ext === 'md') {
      content = buffer.toString('utf-8')
    } else if (ext === 'pdf') {
      content = await extractTextFromPdf(buffer)
    } else if (ext === 'docx') {
      try {
        // @ts-expect-error adm-zip has no type declarations
        const AdmZip = (await import('adm-zip')).default
        const zip = new AdmZip(buffer)
        const docEntry = zip.getEntry('word/document.xml')
        if (docEntry) {
          const xml = docEntry.getData().toString('utf-8')
          content = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
      } catch {
        content = '[DOCX parsing mislukt]'
      }
    }

    // Limit content to prevent database issues (max ~500K chars for large legal documents)
    if (content.length > 500000) {
      content = content.slice(0, 500000) + '\n\n[... tekst ingekort vanwege omvang ...]'
    }

    const source = await prisma.aISource.create({
      data: {
        name: name.trim(),
        type: 'document',
        description: description?.trim() || `${ext.toUpperCase()} document — ${(buffer.length / 1024).toFixed(0)} KB`,
        content,
        category,
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      ...source,
      content: undefined, // Don't return full content
      contentLength: content.length,
    }, { status: 201 })
  }

  // Handle JSON body (website/API source)
  const { name, type, description, url, credentials, category } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  // For website sources, optionally fetch and extract content
  let content: string | null = null
  if (type === 'website' && url) {
    try {
      const headers: Record<string, string> = {}
      if (credentials?.cookie) headers['Cookie'] = credentials.cookie
      if (credentials?.token) headers['Authorization'] = `Bearer ${credentials.token}`

      const response = await fetch(url, { headers })
      if (response.ok) {
        const html = await response.text()
        // Strip HTML tags to get plain text content
        content = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100000) // Max 100K chars
      }
    } catch {
      // Website fetch failed - that's OK, we still save the source reference
    }
  }

  const source = await prisma.aISource.create({
    data: {
      name: name.trim(),
      type: type || 'website',
      description: description?.trim() || null,
      url: url?.trim() || null,
      credentials: credentials ? JSON.stringify(credentials) : null,
      content,
      category: category || 'arbeidsrecht',
      userId: session.user.id,
      lastSynced: content ? new Date() : null,
    },
  })

  return NextResponse.json(source, { status: 201 })
}

/** Extract text from PDF using pdfjs-dist directly (works in serverless, no native deps) */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getDocument: any
    try {
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
      getDocument = mod.getDocument
    } catch {
      const mod = await import('pdfjs-dist')
      getDocument = mod.getDocument
    }
    const uint8 = new Uint8Array(buffer)
    const doc = await getDocument({ data: uint8, useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items.map((item: any) => item.str).join(' ')
      if (pageText.trim()) pages.push(pageText.trim())
    }
    return pages.join('\n\n') || ''
  } catch (err) {
    console.error('[sources] PDF extraction failed:', err instanceof Error ? err.message : err)
    return extractTextFromPdfBasic(buffer)
  }
}

/** Basic PDF text extraction fallback */
function extractTextFromPdfBasic(buffer: Buffer): string {
  const content = buffer.toString('latin1')
  const textParts: string[] = []
  const textBlocks = content.match(/BT[\s\S]*?ET/g) || []
  for (const block of textBlocks) {
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || []
    for (const tj of tjMatches) {
      const match = tj.match(/\(([^)]*)\)/)
      if (match) textParts.push(match[1])
    }
  }
  return textParts.join(' ').trim() || ''
}
