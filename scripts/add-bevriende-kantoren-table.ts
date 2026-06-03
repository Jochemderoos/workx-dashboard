// Idempotent: maakt de tabel voor 'Bevriende kantoren' aan.
// Veilig om bij elke build te draaien.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-bevriende-kantoren-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BevriendKantoor" (
        "id" TEXT PRIMARY KEY,
        "type" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "naam" TEXT NOT NULL,
        "adres" TEXT,
        "plaats" TEXT,
        "email" TEXT,
        "telefoon" TEXT,
        "contactDaar" TEXT,
        "contactWorkx" TEXT,
        "bijzonderheden" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "BevriendKantoor_type_category_sortOrder_idx" ON "BevriendKantoor"("type", "category", "sortOrder")`
    )
    console.log('[add-bevriende-kantoren-table] tabel aanwezig')
  } catch (err) {
    console.error('[add-bevriende-kantoren-table] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()