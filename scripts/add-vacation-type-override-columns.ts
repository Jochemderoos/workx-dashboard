// Idempotent: voegt kolommen toe voor de vakantie/verlof-herziening.
//  - VacationRequest.type: "vakantie" (telt van saldo af) of "onbetaald".
//  - VacationBalance.opgenomenOverride: noodgeval-override door Hanna;
//    als gezet telt deze i.p.v. de automatisch afgeleide som.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-vacation-type-override-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VacationRequest" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'vakantie'`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "VacationBalance" ADD COLUMN IF NOT EXISTS "opgenomenOverride" DOUBLE PRECISION`
    )
    console.log('[add-vacation-type-override-columns] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
