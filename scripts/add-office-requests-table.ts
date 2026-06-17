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
    // Office-reactie velden (gemigreerd voor bestaande tabellen)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OfficeRequest" ADD COLUMN IF NOT EXISTS "officeReply" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OfficeRequest" ADD COLUMN IF NOT EXISTS "officeReplyBy" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OfficeRequest" ADD COLUMN IF NOT EXISTS "officeReplyAt" TIMESTAMP(3)
    `)
    // Categorie-kolom
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OfficeRequest" ADD COLUMN IF NOT EXISTS "category" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeRequest_category_idx" ON "OfficeRequest" ("category")
    `)
    // Categorieën-tabel
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficeRequestCategory" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "emoji" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // Default categorieën (alleen invoegen als de tabel leeg is)
    const existingCount = await prisma.officeRequestCategory.count().catch(() => 0)
    if (existingCount === 0) {
      const defaults = [
        { name: 'IT', emoji: '💻', sortOrder: 10 },
        { name: 'Website', emoji: '🌐', sortOrder: 20 },
        { name: 'Printen', emoji: '🖨️', sortOrder: 30 },
        { name: 'Marketing', emoji: '📣', sortOrder: 40 },
        { name: 'Catering', emoji: '🥗', sortOrder: 50 },
        { name: 'Kantoorbenodigdheden', emoji: '📦', sortOrder: 60 },
        { name: 'Overig', emoji: '📌', sortOrder: 999 },
      ]
      for (const d of defaults) {
        await prisma.officeRequestCategory.create({ data: d }).catch(() => {})
      }
    }
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}
