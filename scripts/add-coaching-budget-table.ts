// Idempotent: maakt de CoachingBudget-tabel aan.
// Eén rij per user — bijhouden hoeveel van het €1.500 ex btw / 3-jaars coachingbudget is besteed.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-coaching-budget-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CoachingBudget" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "periodStart" TIMESTAMP(3) NOT NULL,
        "usedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "notes" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('[add-coaching-budget-table] tabel aanwezig')
  } catch (err) {
    console.error('[add-coaching-budget-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()