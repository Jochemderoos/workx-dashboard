// Idempotent: maakt YearPlan, YearPlanItem en YearPlanEvaluation aan.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-year-plan-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "YearPlan" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "YearPlan_userId_year_key" ON "YearPlan"("userId", "year")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlan_userId_idx" ON "YearPlan"("userId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlan_year_idx" ON "YearPlan"("year")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "YearPlanItem" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "YearPlan"("id") ON DELETE CASCADE,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'todo',
        "progress" INTEGER NOT NULL DEFAULT 0,
        "targetDate" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "position" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlanItem_planId_idx" ON "YearPlanItem"("planId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlanItem_category_idx" ON "YearPlanItem"("category")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "YearPlanEvaluation" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "YearPlan"("id") ON DELETE CASCADE,
        "evaluatorId" TEXT NOT NULL,
        "evaluatorName" TEXT NOT NULL,
        "notes" TEXT NOT NULL,
        "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlanEvaluation_planId_idx" ON "YearPlanEvaluation"("planId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "YearPlanEvaluation_evaluatorId_idx" ON "YearPlanEvaluation"("evaluatorId")
    `)

    console.log('[add-year-plan-tables] klaar')
  } catch (err) {
    console.error('[add-year-plan-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
