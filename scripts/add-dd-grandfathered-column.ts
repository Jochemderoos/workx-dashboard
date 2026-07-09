// Idempotent: voegt lifecycle-kolommen toe aan DDProjectEstimate.
//  - grandfathered: bestond al bij invoering keyword-filter (zie
//    seed-dd-grandfathered.ts), zodat lopende zaken zonder DD/VDD/Due
//    Diligence in de naam zichtbaar blijven.
//  - completed:  afgerond (uit lopend overzicht, heropenen kan).
//  - activated:  handmatig geactiveerd (toon bij actieve zaken ook al zijn
//    er 7 dagen geen uren geschreven).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-dd-grandfathered-column] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DDProjectEstimate" ADD COLUMN IF NOT EXISTS "grandfathered" BOOLEAN NOT NULL DEFAULT false`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DDProjectEstimate" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN NOT NULL DEFAULT false`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DDProjectEstimate" ADD COLUMN IF NOT EXISTS "activated" BOOLEAN NOT NULL DEFAULT false`
    )
    console.log('[add-dd-grandfathered-column] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
