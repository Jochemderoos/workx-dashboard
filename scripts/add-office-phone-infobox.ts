// Idempotent: voegt 'infoboxBy' kolom toe aan OfficePhoneDay.
// Slaat de naam op van de persoon die infobox bijhoudt op die dag.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-office-phone-infobox] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OfficePhoneDay" ADD COLUMN IF NOT EXISTS "infoboxBy" TEXT
    `)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}
