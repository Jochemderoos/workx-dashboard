// Idempotent: maakt de onboarding-tabellen aan.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-onboarding-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OnboardingTemplate" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OnboardingTemplate_category_sortOrder_idx" ON "OnboardingTemplate"("category", "sortOrder")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OnboardingEmployee" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "startDate" TIMESTAMP(3),
        "role" TEXT,
        "isArchived" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OnboardingEmployee_isArchived_createdAt_idx" ON "OnboardingEmployee"("isArchived", "createdAt")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OnboardingItem" (
        "id" TEXT PRIMARY KEY,
        "employeeId" TEXT NOT NULL,
        "templateId" TEXT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isCompleted" BOOLEAN NOT NULL DEFAULT false,
        "completedAt" TIMESTAMP(3),
        "completedBy" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("employeeId") REFERENCES "OnboardingEmployee"("id") ON DELETE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OnboardingItem_employeeId_sortOrder_idx" ON "OnboardingItem"("employeeId", "sortOrder")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OnboardingItem_employeeId_isCompleted_idx" ON "OnboardingItem"("employeeId", "isCompleted")`
    )

    console.log('[add-onboarding-tables] tabellen aanwezig')
  } catch (err) {
    console.error('[add-onboarding-tables] mislukt:', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()