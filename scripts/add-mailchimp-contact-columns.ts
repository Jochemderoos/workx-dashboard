// Idempotent: voegt kolommen toe aan MailchimpContact voor de geïmporteerde
// audience (taal-tag, seminar, uitgeschreven, bron).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-mailchimp-contact-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MailchimpContact" ADD COLUMN IF NOT EXISTS "taal" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "MailchimpContact" ADD COLUMN IF NOT EXISTS "seminar" BOOLEAN NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "MailchimpContact" ADD COLUMN IF NOT EXISTS "unsubscribed" BOOLEAN NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "MailchimpContact" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'dashboard'`)
    console.log('[add-mailchimp-contact-columns] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
