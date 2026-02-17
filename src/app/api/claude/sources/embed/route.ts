import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateEmbeddingsBatch, storeChunkEmbedding, getEmbeddingStats } from '@/lib/embeddings'

const BATCH_SIZE = 50 // OpenAI can handle up to 2048, but 50 keeps requests manageable

/**
 * POST: Generate embeddings for chunks of a specific source (or all sources)
 * Body: { sourceId?: string } — if omitted, processes all sources
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is niet geconfigureerd' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const sourceId = body.sourceId as string | undefined

  // Find chunks without embeddings
  const whereClause: any = { embedding: null }
  if (sourceId) {
    whereClause.sourceId = sourceId
  }

  // We can't filter on embedding IS NULL via Prisma (Unsupported type),
  // so use raw SQL to get chunk IDs without embeddings
  let chunkIds: string[]
  if (sourceId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id FROM "SourceChunk"
      WHERE "sourceId" = $1 AND embedding IS NULL
      ORDER BY "chunkIndex"
    `, sourceId) as Array<{ id: string }>
    chunkIds = rows.map(r => r.id)
  } else {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id FROM "SourceChunk"
      WHERE embedding IS NULL
      ORDER BY "sourceId", "chunkIndex"
    `) as Array<{ id: string }>
    chunkIds = rows.map(r => r.id)
  }

  if (chunkIds.length === 0) {
    const stats = await getEmbeddingStats(sourceId ? [sourceId] : undefined)
    return NextResponse.json({
      message: 'Alle chunks hebben al embeddings',
      stats,
    })
  }

  // Process in batches
  let processed = 0
  let errors = 0

  for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
    const batchIds = chunkIds.slice(i, i + BATCH_SIZE)

    // Fetch chunk contents
    const chunks = await prisma.sourceChunk.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, content: true, heading: true },
    })

    // Prepare texts for embedding (include heading for context)
    const texts = chunks.map(c =>
      c.heading ? `${c.heading}\n\n${c.content}` : c.content
    )

    try {
      const embeddings = await generateEmbeddingsBatch(texts)

      // Store each embedding
      for (let j = 0; j < chunks.length; j++) {
        await storeChunkEmbedding(chunks[j].id, embeddings[j])
      }

      processed += chunks.length
    } catch (err: any) {
      console.error(`Embedding batch fout (batch ${i / BATCH_SIZE + 1}):`, err.message)
      errors += batchIds.length
      // Continue with next batch
    }
  }

  const stats = await getEmbeddingStats(sourceId ? [sourceId] : undefined)

  return NextResponse.json({
    success: true,
    processed,
    errors,
    stats,
  })
}

/**
 * GET: Check embedding status for sources
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const sourceId = req.nextUrl.searchParams.get('sourceId')

  // Get stats per source
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      s.id,
      s.name,
      COUNT(sc.id)::int as "totalChunks",
      COUNT(sc.embedding)::int as "withEmbedding"
    FROM "AISource" s
    LEFT JOIN "SourceChunk" sc ON sc."sourceId" = s.id
    WHERE s."isActive" = true
    ${sourceId ? `AND s.id = '${sourceId}'` : ''}
    GROUP BY s.id, s.name
    HAVING COUNT(sc.id) > 0
    ORDER BY s.name
  `) as Array<{
    id: string
    name: string
    totalChunks: number
    withEmbedding: number
  }>

  return NextResponse.json({
    sources: rows.map(r => ({
      id: r.id,
      name: r.name,
      totalChunks: Number(r.totalChunks),
      withEmbedding: Number(r.withEmbedding),
      percentage: Number(r.totalChunks) > 0
        ? Math.round((Number(r.withEmbedding) / Number(r.totalChunks)) * 100)
        : 0,
    })),
  })
}
