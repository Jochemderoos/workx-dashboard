// Idempotent: voegt submittedForReviewAt + reviewedAt + reviewedById toe
// aan DevelopmentPlan voor de "inleveren bij partners"-flow.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-development-plan-review-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DevelopmentPlan" ADD COLUMN IF NOT EXISTS "submittedForReviewAt" TIMESTAMP(3)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "DevelopmentPlan" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "DevelopmentPlan" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT`)
    console.log('[add-development-plan-review-columns] klaar')
  } catch (err) {
    console.error('[add-development-plan-review-columns] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
