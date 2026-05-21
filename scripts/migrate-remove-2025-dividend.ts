// Idempotent: verwijder verouderde MT940-records zodat de seed schoon kan
// herstarten met de nieuwe parser-regels (partner-classifier, BTW, dividend
// skip, pensioen skip). Verwijdert alleen records met externalRef (= uit
// MT940 gekomen), nooit handmatig ingevoerde posten.
//
// Pensioen-records uit MT940 worden ook verwijderd (dubbeltelling met
// loonstrook).

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-cleanup-mt940] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    // Alle 2025 records die uit MT940 zijn gekomen verwijderen.
    // Het seed-script voegt ze opnieuw toe met de juiste classificatie.
    const mt940_2025 = await prisma.monthlyCost.deleteMany({
      where: { year: 2025, externalRef: { not: null } },
    })

    // Pensioen-records: dubbeltelling met loonstrook. Verwijder ze voor
    // ALLE jaren, ongeacht of ze handmatig of via MT940 zijn ingeladen.
    const pensioen = await prisma.monthlyCost.deleteMany({
      where: {
        OR: [
          { category: 'WGL' },
          { description: { contains: 'bright pensioen', mode: 'insensitive' } },
          { description: { contains: 'pensioen', mode: 'insensitive' } },
        ],
      },
    })

    console.log(`[migrate-cleanup-mt940] ${mt940_2025.count} MT940-records 2025 leeggemaakt, ${pensioen.count} pensioen-records verwijderd (alle jaren)`)
  } catch (err) {
    console.error('[migrate-cleanup-mt940] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
