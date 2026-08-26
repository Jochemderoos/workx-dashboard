// Idempotent: geeft JarSession een "type" (JAR of VAAN), zodat hetzelfde
// rooster-mechanisme ook het VAAN AR-updaterooster kan dragen.
// Bestaande rijen worden JAR — dat is de default.
import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-jar-session-type] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "JarSession" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'JAR'`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "JarSession_type_date_idx" ON "JarSession"("type", "date")`
    )
    // Nieuwe unique index eerst aanmaken, pas daarna de oude weggooien — zo
    // staat de tabel geen moment zonder bescherming tegen dubbele data.
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "JarSession_year_date_type_unique" ON "JarSession"("year", "date", "type")`
    )
    await prisma.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "JarSession_year_date_unique"`
    )
    console.log('[add-jar-session-type] kolom + indexen aanwezig')
  } catch (err) {
    console.error('[add-jar-session-type] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()
