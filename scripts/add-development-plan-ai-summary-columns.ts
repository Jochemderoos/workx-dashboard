// Idempotent: voegt aiSummary + aiSummaryAt toe aan DevelopmentPlan
// voor het Totaaloverzicht-widget dat Claude-gegenereerde samenvattingen
// per plan toont.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-development-plan-ai-summary-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DevelopmentPlan" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "DevelopmentPlan" ADD COLUMN IF NOT EXISTS "aiSummaryAt" TIMESTAMP(3)`)
    console.log('[add-development-plan-ai-summary-columns] klaar')
  } catch (err) {
    console.error('[add-development-plan-ai-summary-columns] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
