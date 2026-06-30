// Idempotent: maakt de StockPhoto-tabel aan (professionele kantoorfoto's
// die het team kan downloaden voor nieuwsbrieven/pitches).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-stock-photos-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StockPhoto" (
        "id" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "title" TEXT,
        "category" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "uploadedById" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StockPhoto_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockPhoto_createdAt_idx" ON "StockPhoto"("createdAt")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockPhoto_uploadedById_idx" ON "StockPhoto"("uploadedById")`)
    // Foreign key (alleen toevoegen als die nog niet bestaat)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'StockPhoto_uploadedById_fkey'
        ) THEN
          ALTER TABLE "StockPhoto"
            ADD CONSTRAINT "StockPhoto_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log('[add-stock-photos-table] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
