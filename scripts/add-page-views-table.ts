// Idempotent: maakt de PageView-tabel aan (anonieme gebruiks-analytics).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-page-views-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PageView" (
        "id" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path")`)
    console.log('[add-page-views-table] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
