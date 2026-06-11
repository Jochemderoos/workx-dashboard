// Idempotent: voegt category kolom toe aan TrainingSession en Certificate.
// Waarden: 'WWFT' | 'INTERVISIE' | 'PO_ARBEIDSRECHT' | 'PO_ANDERS' | null

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-training-category-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TrainingSession" ADD COLUMN IF NOT EXISTS "category" TEXT`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TrainingSession_category_idx" ON "TrainingSession"("category")`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "category" TEXT`)
    console.log('[add-training-category-columns] klaar')
  } catch (err) {
    console.error('[add-training-category-columns] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
