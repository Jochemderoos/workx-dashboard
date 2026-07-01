// Idempotent: maakt de LustrumProgramPreference-tabel aan (voorkeuren van
// teamleden om een lustrum-programmaonderdeel te helpen organiseren).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-lustrum-program-preferences] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LustrumProgramPreference" (
        "id" TEXT NOT NULL,
        "programId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LustrumProgramPreference_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LustrumProgramPreference_programId_userId_key" ON "LustrumProgramPreference"("programId", "userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LustrumProgramPreference_programId_idx" ON "LustrumProgramPreference"("programId")`)
    console.log('[add-lustrum-program-preferences] klaar')
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
