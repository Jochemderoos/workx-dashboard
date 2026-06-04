// Idempotent: maakt Laetitia Wezenbeek aan met startdatum + contract-eval reminders.
// 4e jaars advocaat op jaarcontract, in dienst 1 september 2026.
// Evaluatie-reminders: 4 maanden na start (2027-01-01) en 3 maanden later (2027-04-01).

import { PrismaClient } from '@prisma/client'

const EMAIL = 'laetitia.wezenbeek@workxadvocaten.nl'
const NAME = 'Laetitia Wezenbeek'
const START_DATE = new Date('2026-09-01T00:00:00+02:00')
const CONTRACT_EVALUATIONS = JSON.stringify([
  '2027-01-01', // 4 maanden na start
  '2027-04-01', // 7 maanden na start (3 maanden na 1e eval)
])

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-laetitia] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contractEvaluations" TEXT
    `)

    const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (existing) {
      await prisma.user.update({
        where: { email: EMAIL },
        data: {
          name: NAME,
          role: 'EMPLOYEE',
          startDate: START_DATE,
          contractEvaluations: CONTRACT_EVALUATIONS,
          isActive: true,
        },
      })
      console.log('[seed-laetitia] bijgewerkt')
    } else {
      await prisma.user.create({
        data: {
          email: EMAIL,
          name: NAME,
          password: 'placeholder-needs-reset',
          role: 'EMPLOYEE',
          startDate: START_DATE,
          contractEvaluations: CONTRACT_EVALUATIONS,
          department: 'Arbeidsrecht',
          werkdagen: '1,2,3,4,5',
          isActive: true,
        },
      })
      console.log('[seed-laetitia] aangemaakt')
    }
  } catch (err) {
    console.error('[seed-laetitia] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
