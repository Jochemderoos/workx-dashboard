// Idempotent: maakt de DashboardPin-tabel aan voor persoonlijke homepage-pins.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-dashboard-pins-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DashboardPin" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "widgetKey" TEXT NOT NULL,
        "placement" TEXT NOT NULL DEFAULT 'top',
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPin_userId_widgetKey_key" ON "DashboardPin"("userId", "widgetKey")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DashboardPin_userId_idx" ON "DashboardPin"("userId")`
    )
    console.log('[add-dashboard-pins-table] tabel aanwezig')
  } catch (err) {
    console.error('[add-dashboard-pins-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
