// Idempotent: maakt JarSession-tabel aan.
import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-jar-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "JarSession" (
        "id" TEXT PRIMARY KEY,
        "date" TIMESTAMP(3) NOT NULL,
        "name" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "JarSession_year_date_idx" ON "JarSession"("year", "date")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "JarSession_year_date_unique" ON "JarSession"("year", "date")`
    )
    console.log('[add-jar-table] tabel aanwezig')
  } catch (err) {
    console.error('[add-jar-table] mislukt:', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()