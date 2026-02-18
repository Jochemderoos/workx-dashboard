import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

/**
 * Chunked upload for large files (>4.5MB Vercel body limit).
 *
 * Flow:
 * 1. Client splits file into ~2MB chunks, base64-encodes each
 * 2. Client POSTs each chunk with uploadId, chunkIndex, totalChunks
 * 3. When all chunks are received, server assembles and creates AIDocument
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()
  const { uploadId, chunkIndex, totalChunks, data, fileName, fileSize, fileType, projectId } = body

  if (!uploadId || chunkIndex === undefined || !totalChunks || !data) {
    return NextResponse.json({ error: 'Ongeldige chunk data' }, { status: 400 })
  }

  // Store chunk
  await prisma.fileUploadChunk.upsert({
    where: { uploadId_chunkIndex: { uploadId, chunkIndex } },
    create: {
      uploadId,
      chunkIndex,
      totalChunks,
      data,
      fileName: chunkIndex === 0 ? fileName : null,
      fileSize: chunkIndex === 0 ? fileSize : null,
      fileType: chunkIndex === 0 ? fileType : null,
      projectId: chunkIndex === 0 ? projectId : null,
      userId: session.user.id,
    },
    update: { data },
  })

  // Check if all chunks are uploaded
  const uploadedCount = await prisma.fileUploadChunk.count({
    where: { uploadId },
  })

  if (uploadedCount < totalChunks) {
    return NextResponse.json({
      ok: true,
      uploaded: uploadedCount,
      total: totalChunks,
    })
  }

  // All chunks received — assemble the file
  try {
    const chunks = await prisma.fileUploadChunk.findMany({
      where: { uploadId },
      orderBy: { chunkIndex: 'asc' },
    })

    // Get metadata from first chunk
    const meta = chunks[0]
    // IMPORTANT: Decode each chunk separately and concatenate buffers.
    // Each chunk is independently base64-encoded, so concatenating the base64
    // strings produces invalid base64 (internal padding chars). Decoding each
    // chunk individually and concatenating the resulting buffers gives the
    // correct full file.
    const chunkBuffers = chunks.map(c => Buffer.from(c.data, 'base64'))
    const buffer = Buffer.concat(chunkBuffers)
    const ext = (meta.fileType || 'pdf').toLowerCase()

    console.log(`[upload] Assembled ${chunks.length} chunks: ${buffer.length} bytes for ${meta.fileName}`)

    // Extract text based on file type
    let textContent = ''
    if (ext === 'txt' || ext === 'md') {
      textContent = buffer.toString('utf-8')
    } else if (ext === 'pdf') {
      try {
        textContent = await extractTextFromPdfDirect(buffer)
        console.log(`[upload] PDF extracted: ${textContent.length} chars`)
      } catch (pdfErr) {
        console.error(`[upload] PDF extraction failed:`, pdfErr instanceof Error ? pdfErr.message : pdfErr)
        try {
          textContent = extractTextFromPdfBuffer(buffer)
        } catch {
          textContent = '[PDF tekst kon niet worden geëxtraheerd]'
        }
      }
    } else if (ext === 'docx') {
      try {
        textContent = await extractTextFromDocx(buffer)
      } catch {
        textContent = '[DOCX tekst kon niet worden geëxtraheerd]'
      }
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      textContent = `[Afbeelding: ${meta.fileName}]`
    }

    // Store as base64 for native Claude document/image blocks
    // IMPORTANT: Re-encode from buffer — concatenated chunk base64 has internal
    // padding characters (==) that make it invalid. buffer.toString('base64')
    // produces clean, valid base64.
    const actualSize = meta.fileSize || buffer.length
    const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext}`
    let fileUrl: string | null = null
    if (actualSize <= 32 * 1024 * 1024) {
      const cleanBase64 = buffer.toString('base64')
      fileUrl = `data:${mimeType};base64,${cleanBase64}`
    }

    // Auto-split large scanned PDFs into pages so Claude can read them via vision
    const isScannedPdf = ext === 'pdf' && (
      !textContent ||
      textContent.length < 100 ||
      textContent.startsWith('[')
    )
    // Only auto-split very large scanned PDFs. Native PDF blocks work up to ~5MB.
    if (isScannedPdf && actualSize > 5 * 1024 * 1024 && fileUrl) {
      console.log(`[upload] Scanned PDF detected (${(actualSize / 1024 / 1024).toFixed(1)}MB). Auto-splitting...`)
      try {
        const splitDocs = await autoSplitPdf(buffer, meta.fileName || 'upload', meta.projectId, session.user.id)
        if (splitDocs.length > 0) {
          await prisma.fileUploadChunk.deleteMany({ where: { uploadId } })
          console.log(`[upload] Auto-split into ${splitDocs.length} pages`)
          return NextResponse.json({
            ...splitDocs[0],
            autoSplit: true,
            splitDocuments: splitDocs,
            totalPages: splitDocs.length,
            message: `PDF is automatisch opgesplitst in ${splitDocs.length} pagina's.`,
          }, { status: 201 })
        }
      } catch (splitErr) {
        console.error(`[upload] Auto-split failed:`, splitErr instanceof Error ? splitErr.message : splitErr)
        // Fall through to normal document creation
      }
    }

    // Create the document
    const document = await prisma.aIDocument.create({
      data: {
        name: meta.fileName || 'upload',
        fileType: ext,
        fileSize: actualSize,
        content: textContent || null,
        fileUrl,
        projectId: meta.projectId || null,
        userId: session.user.id,
      },
    })

    // Cleanup chunks
    await prisma.fileUploadChunk.deleteMany({ where: { uploadId } })

    console.log(`[upload] Document created: ${document.id} (${document.name})`)
    return NextResponse.json(document, { status: 201 })
  } catch (err) {
    console.error('[upload] Assembly failed:', err)
    // Cleanup on error
    await prisma.fileUploadChunk.deleteMany({ where: { uploadId } }).catch(() => {})
    return NextResponse.json({ error: 'Bestand kon niet worden verwerkt' }, { status: 500 })
  }
}

// --- Text extraction functions (same as documents/route.ts) ---

async function extractTextFromPdfDirect(buffer: Buffer): Promise<string> {
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
    if (pageText.trim()) pages.push(pageText.trim())
  }
  return pages.join('\n\n') || '[Geen tekst gevonden in PDF]'
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
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
  return textParts.join(' ').trim() || '[Geen tekst gevonden in PDF]'
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    // @ts-expect-error adm-zip has no type declarations
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(buffer)
    const docEntry = zip.getEntry('word/document.xml')
    if (!docEntry) return '[Kon document.xml niet vinden in DOCX]'
    const xml = docEntry.getData().toString('utf-8')
    return xml
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || '[Geen tekst gevonden in DOCX]'
  } catch {
    return '[DOCX parsing mislukt]'
  }
}

/** Auto-split a scanned PDF into individual pages for better Claude processing */
async function autoSplitPdf(
  buffer: Buffer,
  originalName: string,
  projectId: string | null,
  userId: string,
): Promise<Array<{ id: string; name: string; fileType: string; fileSize: number; createdAt: Date }>> {
  const { PDFDocument } = await import('pdf-lib')
  const pdfBytes = new Uint8Array(buffer)
  const sourcePdf = await PDFDocument.load(pdfBytes)
  const totalPages = sourcePdf.getPageCount()

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
        projectId: projectId || null,
        userId,
      },
    })

    createdDocs.push(doc)
  }

  return createdDocs
}
