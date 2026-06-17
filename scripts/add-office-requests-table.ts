// Idempotent: maakt OfficeRequest tabel aan voor verzoeken aan Office team.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-office-requests-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficeRequest" (
        "id" TEXT PRIMARY KEY,
        "requesterId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "assigneeName" TEXT,
        "confidential" BOOLEAN NOT NULL DEFAULT false,
        "completedAt" TIMESTAMP(3),
        "completedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OfficeRequest_requesterId_fkey"
          FOREIGN KEY ("requesterId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeRequest_completedAt_idx" ON "OfficeRequest" ("completedAt")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeRequest_createdAt_idx" ON "OfficeRequest" ("createdAt")
    `)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}
