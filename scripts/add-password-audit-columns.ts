// Idempotent: voegt audit-kolommen voor wachtwoord-resets toe aan User.
// Draait bij elke Vercel build; doet niets als kolommen al bestaan.
// Veilig om te laten staan, maar mag verwijderd worden zodra in alle
// omgevingen aanwezig.

import { PrismaClient } from '@prisma/client'

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[add-password-audit] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPasswordChangeAt" TIMESTAMP(3)`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPasswordChangedById" TEXT`
    )
    console.log('[add-password-audit] kolommen aanwezig')
  } catch (err) {
    console.error('[add-password-audit] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()