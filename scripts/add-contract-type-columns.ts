// Idempotent: voegt contractType + contractEndDate toe aan User (bepaalde/onbepaalde tijd).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-contract-type-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contractType" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contractEndDate" TIMESTAMP(3)`)
    console.log('[add-contract-type-columns] kolommen aanwezig')
  } catch (err) {
    console.error('[add-contract-type-columns] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
