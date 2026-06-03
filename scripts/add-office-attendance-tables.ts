// Idempotent: maakt OfficeAttendanceEntry + OfficePhoneDay aan.
// Voor de Office-aanwezigheidspagina (back office / admin).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-office-attendance-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficeAttendanceEntry" (
        "id" TEXT PRIMARY KEY,
        "personKey" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "status" TEXT NOT NULL,
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "OfficeAttendanceEntry_personKey_date_key"
        ON "OfficeAttendanceEntry" ("personKey", "date")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeAttendanceEntry_date_idx"
        ON "OfficeAttendanceEntry" ("date")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficePhoneDay" (
        "id" TEXT PRIMARY KEY,
        "date" DATE NOT NULL UNIQUE,
        "mode" TEXT NOT NULL DEFAULT 'AUTO',
        "forwardTo" TEXT,
        "coverBy" TEXT,
        "note" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('[add-office-attendance-tables] tabellen + indexen aanwezig')
  } catch (err) {
    console.error('[add-office-attendance-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()