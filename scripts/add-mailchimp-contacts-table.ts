// Idempotent: maakt de MailchimpContact-tabel aan (aangedragen contactpersonen
// voor de Mailchimp-lijst).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-mailchimp-contacts-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MailchimpContact" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "company" TEXT,
        "addedById" TEXT NOT NULL,
        "addedByName" TEXT NOT NULL,
        "addedToMailchimp" BOOLEAN NOT NULL DEFAULT false,
        "processedById" TEXT,
        "processedByName" TEXT,
        "processedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MailchimpContact_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MailchimpContact_addedToMailchimp_idx" ON "MailchimpContact"("addedToMailchimp")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MailchimpContact_createdAt_idx" ON "MailchimpContact"("createdAt")`)
    console.log('[add-mailchimp-contacts-table] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
