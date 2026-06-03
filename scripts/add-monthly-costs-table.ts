// Idempotent: maakt de MonthlyCost-tabel aan voor de Kosten-pagina.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-monthly-costs-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MonthlyCost" (
        "id" TEXT PRIMARY KEY,
        "year" INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "description" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MonthlyCost_year_month_idx" ON "MonthlyCost"("year", "month")`
    )
    console.log('[add-monthly-costs-table] tabel aanwezig')
  } catch (err) {
    console.error('[add-monthly-costs-table] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()