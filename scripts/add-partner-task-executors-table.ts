// Idempotent: maakt PartnerTaskExecutor-tabel aan.
import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-partner-task-executors-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerTaskExecutor" (
        "id" TEXT PRIMARY KEY,
        "taskId" TEXT NOT NULL REFERENCES "PartnerTask"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PartnerTaskExecutor_taskId_userId_key" ON "PartnerTaskExecutor"("taskId", "userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartnerTaskExecutor_taskId_idx" ON "PartnerTaskExecutor"("taskId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartnerTaskExecutor_userId_idx" ON "PartnerTaskExecutor"("userId")`)
    console.log('[add-partner-task-executors-table] klaar')
  } catch (err) {
    console.error('[add-partner-task-executors-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
