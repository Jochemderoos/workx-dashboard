// Idempotent:
// 1. Maakt de PartnerTaskAssignment-tabel (multi-persoon per PartnerTask).
// 2. Verwijdert de oude unique-only constraint op Responsibility.partnerTaskId,
//    zodat één PartnerTask meerdere Responsibility-records kan hebben
//    (één per verantwoordelijke).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-partner-task-assignments-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // Drop oude unique index (heette eerder ..._key) en vervang door gewone index
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Responsibility_partnerTaskId_key"`)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Responsibility_partnerTaskId_idx" ON "Responsibility"("partnerTaskId")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerTaskAssignment" (
        "id" TEXT PRIMARY KEY,
        "taskId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PartnerTaskAssignment_taskId_userId_key" ON "PartnerTaskAssignment"("taskId", "userId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PartnerTaskAssignment_taskId_idx" ON "PartnerTaskAssignment"("taskId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PartnerTaskAssignment_userId_idx" ON "PartnerTaskAssignment"("userId")`
    )

    console.log('[add-partner-task-assignments-table] tabel en indexes aanwezig')
  } catch (err) {
    console.error('[add-partner-task-assignments-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()