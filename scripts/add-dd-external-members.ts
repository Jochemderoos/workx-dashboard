// Idempotent: DD-projecten kunnen externen (zzp'ers) als lid krijgen die geen
// dashboard-account hebben. userId wordt daarvoor optioneel en er komt een
// externalName bij. Bestaande leden houden hun userId en blijven ongemoeid.
import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-dd-external-members] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DDProjectMember" ALTER COLUMN "userId" DROP NOT NULL`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DDProjectMember" ADD COLUMN IF NOT EXISTS "externalName" TEXT`
    )
    // Voorkomt dat dezelfde externe twee keer aan één project hangt.
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "DDProjectMember_projectId_externalName_key" ON "DDProjectMember"("projectId", "externalName")`
    )
    console.log('[add-dd-external-members] kolom + index aanwezig')
  } catch (err) {
    console.error('[add-dd-external-members] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()
