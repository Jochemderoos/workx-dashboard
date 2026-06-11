// Idempotent: maakt WorkxOuting + WorkxOutingAttendance tabellen aan.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-workx-outings-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkxOuting" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "location" TEXT,
        "description" TEXT,
        "organizerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "imageUrl" TEXT,
        "slackNoticedAt" TIMESTAMP(3),
        "reminderSentAt" TEXT NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // Idempotent: kolom toevoegen voor bestaande deploys
    await prisma.$executeRawUnsafe(`ALTER TABLE "WorkxOuting" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxOuting_date_idx" ON "WorkxOuting"("date")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxOuting_organizerId_idx" ON "WorkxOuting"("organizerId")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkxOutingAttendance" (
        "id" TEXT PRIMARY KEY,
        "outingId" TEXT NOT NULL REFERENCES "WorkxOuting"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "plusOnes" INTEGER NOT NULL DEFAULT 0,
        "response" TEXT NOT NULL DEFAULT 'in',
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "WorkxOutingAttendance_outingId_userId_key" ON "WorkxOutingAttendance"("outingId", "userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxOutingAttendance_outingId_idx" ON "WorkxOutingAttendance"("outingId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WorkxOutingAttendance_userId_idx" ON "WorkxOutingAttendance"("userId")`)

    console.log('[add-workx-outings-tables] klaar')
  } catch (err) {
    console.error('[add-workx-outings-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
