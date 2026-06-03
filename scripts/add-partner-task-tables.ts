// Idempotent: maakt de tabellen voor 'Verantwoordelijk (partner)' aan en
// voegt de partnerTaskId-kolom toe aan Responsibility. Veilig om bij
// elke build te draaien.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-partner-task-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerTaskChapter" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PartnerTaskChapter_sortOrder_idx" ON "PartnerTaskChapter"("sortOrder")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerTask" (
        "id" TEXT PRIMARY KEY,
        "chapterId" TEXT NOT NULL,
        "task" TEXT NOT NULL,
        "responsibleId" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isPublic" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PartnerTask_chapterId_idx" ON "PartnerTask"("chapterId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PartnerTask_responsibleId_idx" ON "PartnerTask"("responsibleId")`
    )

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Responsibility" ADD COLUMN IF NOT EXISTS "partnerTaskId" TEXT`
    )
    // Unique-index (eerder uniqueness was: één Responsibility per PartnerTask)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Responsibility_partnerTaskId_key" ON "Responsibility"("partnerTaskId") WHERE "partnerTaskId" IS NOT NULL`
    )

    console.log('[add-partner-task-tables] tabellen en kolommen aanwezig')
  } catch (err) {
    console.error('[add-partner-task-tables] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()