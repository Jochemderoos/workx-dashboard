// Idempotent: voegt category-kolom toe aan MonthlyCost voor UWV/ASR-classificatie.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-monthly-cost-category] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MonthlyCost" ADD COLUMN IF NOT EXISTS "category" TEXT`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MonthlyCost_category_idx" ON "MonthlyCost"("category")`
    )
    console.log('[add-monthly-cost-category] kolom aanwezig')
  } catch (err) {
    console.error('[add-monthly-cost-category] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()