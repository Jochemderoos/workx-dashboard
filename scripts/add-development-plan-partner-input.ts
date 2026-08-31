// Idempotent: apart veld voor partner-input per ontwikkelplan-onderdeel.
// Tot nu toe deelden medewerker en partner één evaluatie-veld, waardoor niet
// te zien was wie wat geschreven had. De bestaande tekst in "evaluation"
// blijft staan als zelfevaluatie van de medewerker.
import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-development-plan-partner-input] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DevelopmentPlanItem" ADD COLUMN IF NOT EXISTS "partnerEvaluation" TEXT`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DevelopmentPlanItem" ADD COLUMN IF NOT EXISTS "partnerEvaluationBy" TEXT`
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DevelopmentPlanItem" ADD COLUMN IF NOT EXISTS "partnerEvaluationAt" TIMESTAMP(3)`
    )
    console.log('[add-development-plan-partner-input] kolommen aanwezig')
  } catch (err) {
    console.error('[add-development-plan-partner-input] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()
