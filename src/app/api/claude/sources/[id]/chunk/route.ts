import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CHUNK_SIZE = 5000 // ~1400 tokens per chunk

/**
 * POST: Split source content into searchable chunks
 * Can be called after uploading/updating a source to enable smart retrieval
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const source = await prisma.aISource.findFirst({
    where: { id: params.id },
    select: { id: true, name: true, content: true },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  if (!source.content || source.content.length < 100) {
    return NextResponse.json({ error: 'Bron heeft onvoldoende content' }, { status: 400 })
  }

  // Delete existing chunks for this source
  await prisma.sourceChunk.deleteMany({ where: { sourceId: source.id } })

  // Split content into chunks
  const chunks = splitIntoSmartChunks(source.content, CHUNK_SIZE)

  // Batch insert chunks
  const created = await prisma.sourceChunk.createMany({
    data: chunks.map((chunk, index) => ({
      sourceId: source.id,
      chunkIndex: index,
      content: chunk.content,
      heading: chunk.heading || null,
    })),
  })

  return NextResponse.json({
    success: true,
    sourceName: source.name,
    chunksCreated: created.count,
    totalContentLength: source.content.length,
    avgChunkSize: Math.round(source.content.length / created.count),
  })
}

/**
 * Split text into chunks, trying to respect section boundaries.
 * Detects headings (lines starting with caps, article numbers, etc.)
 */
function splitIntoSmartChunks(
  text: string,
  targetSize: number
): Array<{ content: string; heading: string | null }> {
  const chunks: Array<{ content: string; heading: string | null }> = []
  const lines = text.split('\n')
  let currentChunk = ''
  let currentHeading: string | null = null

  // Patterns that indicate a new section/heading
  const headingPattern = /^(#{1,4}\s|Artikel\s+\d|Art\.\s*\d|Afdeling\s+\d|Titel\s+\d|Boek\s+\d|Hoofdstuk\s+\d|\d+\.\d+[\s.]|[A-Z][A-Z\s]{5,}$)/

  for (const line of lines) {
    const isHeading = headingPattern.test(line.trim())

    // If we hit a heading and current chunk is big enough, start a new chunk
    if (isHeading && currentChunk.length > targetSize * 0.3) {
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), heading: currentHeading })
      }
      currentChunk = line + '\n'
      currentHeading = line.trim().slice(0, 200)
      continue
    }

    currentChunk += line + '\n'

    // Force split if chunk gets too large
    if (currentChunk.length >= targetSize) {
      // Try to split at a paragraph boundary
      const lastParagraph = currentChunk.lastIndexOf('\n\n', targetSize)
      const lastSentence = currentChunk.lastIndexOf('. ', targetSize)
      const splitPoint = lastParagraph > targetSize * 0.5
        ? lastParagraph
        : lastSentence > targetSize * 0.5
          ? lastSentence + 2
          : targetSize

      chunks.push({
        content: currentChunk.slice(0, splitPoint).trim(),
        heading: currentHeading,
      })
      currentChunk = currentChunk.slice(splitPoint).trim() + '\n'
      // Keep the same heading for continuation
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), heading: currentHeading })
  }

  return chunks
}
