// Idempotent: dedupliceert MonthlyCost op externalRef (echte dubbele MT940-
// imports — zelfde transactie 2×) en legt daarna een UNIEKE index op externalRef,
// zodat dubbele imports voortaan op databaseniveau geweigerd worden.
// NULL-externalRefs (handmatige posten) blijven toegestaan (Postgres: NULLs distinct).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-monthly-cost-externalref-unique] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // 1. Verwijder dubbele rijen (zelfde externalRef), behoud de oudste (laagste id).
    const deleted: number = await prisma.$executeRawUnsafe(`
      DELETE FROM "MonthlyCost"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "externalRef" ORDER BY id) AS rn
          FROM "MonthlyCost"
          WHERE "externalRef" IS NOT NULL
        ) t WHERE t.rn > 1
      )
    `)
    if (deleted > 0) console.log(`[add-monthly-cost-externalref-unique] ${deleted} dubbele kostenpost(en) verwijderd`)

    // 2. Oude non-unieke index opruimen + unieke index plaatsen.
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "MonthlyCost_externalRef_idx"`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyCost_externalRef_key" ON "MonthlyCost"("externalRef")`)

    console.log('[add-monthly-cost-externalref-unique] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
