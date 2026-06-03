import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-import-event] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ImportEvent" (
        "id" TEXT PRIMARY KEY,
        "type" TEXT NOT NULL,
        "uploaderId" TEXT NOT NULL,
        "uploaderName" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ImportEvent_createdAt_idx" ON "ImportEvent" ("createdAt")
    `)
    console.log('[add-import-event] tabel + index aanwezig')
  } catch (err) {
    console.error('[add-import-event] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()