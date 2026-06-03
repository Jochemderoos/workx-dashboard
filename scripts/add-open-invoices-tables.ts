// Idempotent: maakt OpenInvoice en OpenInvoiceLine tabellen aan voor de
// Debiteuren-pagina (BaseNet PDF-import).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-open-invoices-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OpenInvoice" (
        "id" TEXT PRIMARY KEY,
        "invoiceNumber" TEXT NOT NULL,
        "bookYear" INTEGER NOT NULL,
        "bookPeriod" INTEGER NOT NULL,
        "projectCode" TEXT,
        "projectName" TEXT,
        "clientName" TEXT,
        "totalExcl" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalIncl" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalBtw" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "primaryUserId" TEXT,
        "reminderSentAt" TIMESTAMP(3),
        "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "OpenInvoice_invoiceNumber_key" ON "OpenInvoice"("invoiceNumber")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OpenInvoice_primaryUserId_idx" ON "OpenInvoice"("primaryUserId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OpenInvoice_bookYear_bookPeriod_idx" ON "OpenInvoice"("bookYear", "bookPeriod")`
    )

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OpenInvoiceLine" (
        "id" TEXT PRIMARY KEY,
        "invoiceId" TEXT NOT NULL,
        "attorneyName" TEXT NOT NULL,
        "userId" TEXT,
        "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OpenInvoiceLine_invoiceId_idx" ON "OpenInvoiceLine"("invoiceId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OpenInvoiceLine_userId_idx" ON "OpenInvoiceLine"("userId")`
    )

    console.log('[add-open-invoices-tables] tabellen aanwezig')
  } catch (err) {
    console.error('[add-open-invoices-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()