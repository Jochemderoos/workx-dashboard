/**
 * Embedding utilities voor semantic search met OpenAI text-embedding-3-small + pgvector
 */

import { prisma } from '@/lib/prisma'

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Generate embedding vector for a text using OpenAI API.
 * Returns a 1536-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is niet geconfigureerd')
  }

  // Truncate to ~8000 tokens (~32000 chars) to stay within model limits
  const truncated = text.slice(0, 32000)

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Embedding API fout (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in a single API call (batch).
 * More efficient than calling one by one.
 * Max 2048 inputs per call.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is niet geconfigureerd')
  }

  // Truncate each text
  const truncated = texts.map(t => t.slice(0, 32000))

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Embedding API fout (${response.status}): ${error}`)
  }

  const data = await response.json()
  // Sort by index to maintain order
  const sorted = data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index)
  return sorted.map((item: { embedding: number[] }) => item.embedding)
}

/**
 * Search for similar chunks using pgvector cosine similarity.
 * Returns chunks sorted by similarity (highest first).
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  sourceIds: string[],
  maxResults: number = 35
): Promise<Array<{
  id: string
  sourceId: string
  chunkIndex: number
  content: string
  heading: string | null
  similarity: number
}>> {
  if (sourceIds.length === 0) return []

  // Format embedding as pgvector string: [0.1,0.2,...]
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  // Use raw SQL for pgvector cosine similarity search
  // 1 - (a <=> b) gives cosine similarity (0-1, higher = more similar)
  const results = await prisma.$queryRawUnsafe(`
    SELECT
      id,
      "sourceId",
      "chunkIndex",
      content,
      heading,
      1 - (embedding <=> $1::vector) as similarity
    FROM "SourceChunk"
    WHERE "sourceId" = ANY($2::text[])
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `, embeddingStr, sourceIds, maxResults)

  return (results as any[]).map(r => ({
    id: r.id,
    sourceId: r.sourceId,
    chunkIndex: r.chunkIndex,
    content: r.content,
    heading: r.heading,
    similarity: Number(r.similarity),
  }))
}

/**
 * Store an embedding for a specific chunk.
 */
export async function storeChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const embeddingStr = `[${embedding.join(',')}]`
  await prisma.$executeRawUnsafe(
    `UPDATE "SourceChunk" SET embedding = $1::vector WHERE id = $2`,
    embeddingStr,
    chunkId
  )
}

/**
 * Count chunks with and without embeddings for given sources.
 */
export async function getEmbeddingStats(sourceIds?: string[]): Promise<{
  total: number
  withEmbedding: number
  withoutEmbedding: number
}> {
  let result: any[]
  if (sourceIds && sourceIds.length > 0) {
    result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(embedding)::int as with_embedding
      FROM "SourceChunk"
      WHERE "sourceId" = ANY($1::text[])
    `, sourceIds)
  } else {
    result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(embedding)::int as with_embedding
      FROM "SourceChunk"
    `)
  }

  const total = Number(result[0].total)
  const withEmbedding = Number(result[0].with_embedding)
  return {
    total,
    withEmbedding,
    withoutEmbedding: total - withEmbedding,
  }
}
