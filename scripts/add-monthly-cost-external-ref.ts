// Idempotent: voegt externalRef-kolom toe aan MonthlyCost voor dubbele-
// import-detectie bij MT940-uploads.

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-monthly-cost-external-ref] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MonthlyCost" ADD COLUMN IF NOT EXISTS "externalRef" TEXT`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MonthlyCost_externalRef_idx" ON "MonthlyCost"("externalRef")`
    )
    console.log('[add-monthly-cost-external-ref] kolom aanwezig')
  } catch (err) {
    console.error('[add-monthly-cost-external-ref] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
