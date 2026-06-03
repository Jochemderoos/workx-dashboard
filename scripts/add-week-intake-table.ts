// Idempotent: maakt WeekIntake-tabel + indexen aan.
// Per medewerker per target-week: wat hebben ze liggen, beschikbaarheid, bijzonderheden.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-week-intake-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WeekIntake" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "weekStartDate" DATE NOT NULL,
        "work" TEXT NOT NULL,
        "availability" TEXT,
        "notes" TEXT,
        "submittedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WeekIntake_userId_fkey" FOREIGN KEY ("userId")
          REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "WeekIntake_userId_weekStartDate_key"
        ON "WeekIntake" ("userId", "weekStartDate")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "WeekIntake_weekStartDate_idx"
        ON "WeekIntake" ("weekStartDate")
    `)
    console.log('[add-week-intake-table] tabel + indexen aanwezig')
  } catch (err) {
    console.error('[add-week-intake-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()