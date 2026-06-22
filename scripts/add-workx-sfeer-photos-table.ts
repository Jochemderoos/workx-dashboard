// Idempotent: maakt WorkxSfeerPhoto tabel aan (geüploade sfeer-foto's voor
// het Polaroid-moodboard op de Workx uitjes pagina).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-workx-sfeer-photos-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkxSfeerPhoto" (
        "id" TEXT PRIMARY KEY,
        "url" TEXT NOT NULL,
        "caption" TEXT,
        "uploadedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxSfeerPhoto_createdAt_idx" ON "WorkxSfeerPhoto"("createdAt")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxSfeerPhoto_uploadedById_idx" ON "WorkxSfeerPhoto"("uploadedById")`)

    console.log('[add-workx-sfeer-photos-table] klaar')
  } catch (err) {
    console.error('[add-workx-sfeer-photos-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
