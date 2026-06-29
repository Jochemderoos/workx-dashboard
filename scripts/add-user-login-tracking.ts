// Idempotent: voegt login-tracking velden toe aan User (lastLoginAt, loginCount).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-user-login-tracking] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0`)
    console.log('[add-user-login-tracking] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
