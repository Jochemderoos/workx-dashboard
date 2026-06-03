// Idempotent: voegt VendorAlias-tabel + MonthlyCost.rawKey-kolom toe
// voor het 'slim leren' van handmatige correcties op MT940-imports.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-vendor-alias-learning] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MonthlyCost" ADD COLUMN IF NOT EXISTS "rawKey" TEXT`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MonthlyCost_rawKey_idx" ON "MonthlyCost"("rawKey")`
    )
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VendorAlias" (
        "rawKey"     TEXT PRIMARY KEY,
        "vendorName" TEXT NOT NULL,
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('[add-vendor-alias-learning] schema bijgewerkt')
  } catch (err) {
    console.error('[add-vendor-alias-learning] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()