import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-client-classification] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClientClassification" (
        "id" TEXT PRIMARY KEY,
        "clientKey" TEXT NOT NULL UNIQUE,
        "displayName" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "notes" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedById" TEXT
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ClientClassification_type_idx" ON "ClientClassification" ("type")
    `)
    console.log('[add-client-classification] tabel + index aanwezig')
  } catch (err) {
    console.error('[add-client-classification] mislukt:', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
main()
