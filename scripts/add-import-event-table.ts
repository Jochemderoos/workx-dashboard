import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-import-event] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
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
    await prisma.$disconnect().catch(() => {})
  }
}
main()
