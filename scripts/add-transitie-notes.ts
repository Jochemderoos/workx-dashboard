// Idempotent: voeg notes-veld toe aan TransitieCalculation.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-transitie-notes] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TransitieCalculation" ADD COLUMN IF NOT EXISTS "notes" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TransitieCalculation" ADD COLUMN IF NOT EXISTS "multiplier" DOUBLE PRECISION
    `)
    console.log('[add-transitie-notes] kolommen aanwezig')
  } catch (err) {
    console.error('[add-transitie-notes] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
