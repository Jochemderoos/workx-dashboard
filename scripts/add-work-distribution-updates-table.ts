// Idempotent: maakt WorkDistributionUpdate tabel aan (tussentijdse
// werkverdeling-updates van medewerkers aan de partners).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-work-distribution-updates-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkDistributionUpdate" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "weekStartDate" DATE NOT NULL,
        "message" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkDistributionUpdate_createdAt_idx" ON "WorkDistributionUpdate"("createdAt")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkDistributionUpdate_userId_idx" ON "WorkDistributionUpdate"("userId")`)

    console.log('[add-work-distribution-updates-table] klaar')
  } catch (err) {
    console.error('[add-work-distribution-updates-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
