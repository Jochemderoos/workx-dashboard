/**
 * Eenmalige setup: pgvector extensie activeren en embedding kolom toevoegen
 *
 * Gebruik:
 *   node scripts/setup-pgvector.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== pgvector Setup ===\n')

  // 1. Enable pgvector extension
  console.log('1. pgvector extensie activeren...')
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')
    console.log('   ✓ pgvector extensie actief')
  } catch (err) {
    console.error('   ✗ Fout bij activeren pgvector:', err.message)
    console.log('   → Activeer pgvector handmatig in Supabase Dashboard > Database > Extensions')
    process.exit(1)
  }

  // 2. Add embedding column to SourceChunk
  console.log('2. Embedding kolom toevoegen aan SourceChunk...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SourceChunk"
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
    `)
    console.log('   ✓ Embedding kolom toegevoegd (vector(1536))')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ✓ Embedding kolom bestaat al')
    } else {
      console.error('   ✗ Fout:', err.message)
      process.exit(1)
    }
  }

  // 3. Create ivfflat index for fast similarity search
  console.log('3. Vector index aanmaken (ivfflat, cosine)...')
  try {
    // First check how many rows have embeddings
    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "SourceChunk" WHERE embedding IS NOT NULL
    `)
    const embeddedCount = Number(result[0].count)
    console.log(`   ${embeddedCount} chunks hebben al een embedding`)

    // ivfflat needs at least some rows for lists parameter
    // Use HNSW index instead - works better for any number of rows
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS source_chunk_embedding_idx;
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS source_chunk_embedding_idx
      ON "SourceChunk"
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `)
    console.log('   ✓ HNSW index aangemaakt (cosine similarity)')
  } catch (err) {
    console.log(`   ⚠ Index kan later aangemaakt worden: ${err.message}`)
  }

  // 4. Verify setup
  console.log('\n4. Verificatie...')
  const chunks = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embedding
    FROM "SourceChunk"
  `)
  console.log(`   Totaal chunks: ${chunks[0].total}`)
  console.log(`   Met embedding: ${chunks[0].with_embedding}`)
  console.log(`   Zonder embedding: ${Number(chunks[0].total) - Number(chunks[0].with_embedding)}`)

  console.log('\n=== Setup voltooid ===')
  console.log('Volgende stap: node scripts/generate-embeddings.js')

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fout:', err)
  process.exit(1)
})
