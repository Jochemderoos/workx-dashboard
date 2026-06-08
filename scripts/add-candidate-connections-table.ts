// Idempotent: maakt CandidateConnection aan.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-candidate-connections-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CandidateConnection" (
        "id" TEXT PRIMARY KEY,
        "candidateKey" TEXT NOT NULL,
        "candidateType" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CandidateConnection_unique"
      ON "CandidateConnection"("candidateKey", "candidateType", "userId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CandidateConnection_key_type_idx"
      ON "CandidateConnection"("candidateKey", "candidateType")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CandidateConnection_userId_idx"
      ON "CandidateConnection"("userId")
    `)
    console.log('[add-candidate-connections-table] klaar')
  } catch (err) {
    console.error('[add-candidate-connections-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
