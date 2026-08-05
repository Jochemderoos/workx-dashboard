// Idempotent: RecurringLeave-tabel (vaste terugkerende verlofdagen) +
// VacationRequest.childNumber (ouderschapsverlof per kind).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-recurring-leave] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "VacationRequest" ADD COLUMN IF NOT EXISTS "childNumber" INTEGER`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RecurringLeave" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "weekday" INTEGER NOT NULL,
        "dayValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
        "childNumber" INTEGER,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3),
        "note" TEXT,
        "createdById" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RecurringLeave_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RecurringLeave_userId_idx" ON "RecurringLeave"("userId")`)
    console.log('[add-recurring-leave] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
