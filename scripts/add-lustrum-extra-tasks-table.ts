// Idempotent: maakt de LustrumExtraTask-tabel aan (toewijzing losse taken).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-lustrum-extra-tasks-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LustrumExtraTask" (
        "key" TEXT NOT NULL,
        "responsible" TEXT NOT NULL DEFAULT '[]',
        "updatedById" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LustrumExtraTask_pkey" PRIMARY KEY ("key")
      )
    `)
    console.log('[add-lustrum-extra-tasks-table] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
