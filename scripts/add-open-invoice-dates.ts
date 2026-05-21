// Idempotent: voegt issueDate en dueDate kolommen toe aan OpenInvoice
// zodat we de exacte data uit het BaseNet Word-export kunnen koppelen
// aan de PDF-import.

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-open-invoice-dates] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "OpenInvoice" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3)`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "OpenInvoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3)`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "OpenInvoice_dueDate_idx" ON "OpenInvoice"("dueDate")`
    )
    console.log('[add-open-invoice-dates] kolommen aanwezig')
  } catch (err) {
    console.error('[add-open-invoice-dates] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
