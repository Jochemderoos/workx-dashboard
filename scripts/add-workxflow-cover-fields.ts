// Idempotent: voeg customLabel + skipCoverSheet kolommen toe aan
// WorkxflowProduction. Maakt het mogelijk om per productie het gele
// vel een eigen naam te geven of helemaal te verbergen.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-workxflow-cover-fields] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "WorkxflowProduction" ADD COLUMN IF NOT EXISTS "customLabel" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "WorkxflowProduction" ADD COLUMN IF NOT EXISTS "skipCoverSheet" BOOLEAN NOT NULL DEFAULT false
    `)
    console.log('[add-workxflow-cover-fields] kolommen aanwezig')
  } catch (err) {
    console.error('[add-workxflow-cover-fields] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
