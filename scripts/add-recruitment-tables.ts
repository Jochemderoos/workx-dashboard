// Idempotent: maakt RecruitmentEntry + RecruitmentCandidate-tabellen aan.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-recruitment-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RecruitmentEntry" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "visibilityIdeas" TEXT,
        "willPostHimself" TEXT,
        "postingFormat" TEXT,
        "submittedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RecruitmentEntry_submittedAt_idx" ON "RecruitmentEntry"("submittedAt")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RecruitmentCandidate" (
        "id" TEXT PRIMARY KEY,
        "entryId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "experienceYear" INTEGER,
        "currentOffice" TEXT,
        "inNetwork" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "approachStatus" TEXT,
        "approachedBy" TEXT,
        "approachNotes" TEXT,
        "networkOwner" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RecruitmentCandidate_entryId_fkey"
          FOREIGN KEY ("entryId") REFERENCES "RecruitmentEntry"("id") ON DELETE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RecruitmentCandidate_entryId_idx" ON "RecruitmentCandidate"("entryId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RecruitmentCandidate_type_idx" ON "RecruitmentCandidate"("type")
    `)
    console.log('[add-recruitment-tables] tabellen aanwezig')
  } catch (err) {
    console.error('[add-recruitment-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
