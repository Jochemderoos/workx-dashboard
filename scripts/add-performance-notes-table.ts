// Idempotent: maakt de PerformanceNote-tabel aan + indexen.
// Per medewerker noteren partners + Hanna performance-feedback.

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-performance-notes-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PerformanceNote" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "noteDate" TIMESTAMP(3) NOT NULL,
        "sentiment" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "discussed" BOOLEAN NOT NULL DEFAULT false,
        "discussedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PerformanceNote_userId_fkey" FOREIGN KEY ("userId")
          REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "PerformanceNote_authorId_fkey" FOREIGN KEY ("authorId")
          REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PerformanceNote_userId_noteDate_idx"
        ON "PerformanceNote" ("userId", "noteDate")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PerformanceNote_authorId_idx"
        ON "PerformanceNote" ("authorId")
    `)
    console.log('[add-performance-notes-table] tabel + indexen aanwezig')
  } catch (err) {
    console.error('[add-performance-notes-table] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
