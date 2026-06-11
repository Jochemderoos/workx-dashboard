// Idempotent: maakt YearAgenda-tabel aan voor de Jaaragenda-pagina.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-year-agenda-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "YearAgenda" (
        "id" TEXT PRIMARY KEY,
        "year" INTEGER NOT NULL UNIQUE,
        "goals" TEXT NOT NULL DEFAULT '[]',
        "months" TEXT NOT NULL DEFAULT '{}',
        "theme" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "YearAgenda_year_idx" ON "YearAgenda"("year")`)
    console.log('[add-year-agenda-table] klaar')
  } catch (err) {
    console.error('[add-year-agenda-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
