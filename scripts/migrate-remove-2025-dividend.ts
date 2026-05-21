// Idempotent: verwijder ten onrechte als 'kost' geseede 2025-records die
// dividenduitkeringen naar partner-holdings zijn. Voor 2025 zijn dat de
// betalingen aan Les Dents Du Midi / Meneer Nilsson / Cavalieri / Jader —
// geen factuur, geen BTW, geen bedrijfskost (winstdeling).
//
// Verwijdert MonthlyCost-records waarbij:
//   year = 2025
//   AND (category = 'MGMT' OR description bevat een holding-naam)

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-remove-2025-dividend] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const dividend = await prisma.monthlyCost.deleteMany({
      where: {
        year: 2025,
        OR: [
          { category: 'MGMT' },
          { description: { contains: 'les dents du midi', mode: 'insensitive' } },
          { description: { contains: 'meneer nilsson', mode: 'insensitive' } },
          { description: { contains: 'cavalieri', mode: 'insensitive' } },
          { description: { contains: 'jader', mode: 'insensitive' } },
        ],
      },
    })
    // Bright/pensioen records uit MT940-imports: dubbeltelling met werkgeverslasten
    // (zit al op de loonstrook). Alleen records met externalRef = uit MT940.
    const pensioen = await prisma.monthlyCost.deleteMany({
      where: {
        externalRef: { not: null },
        OR: [
          { category: 'WGL' },
          { description: { contains: 'bright pensioen', mode: 'insensitive' } },
        ],
      },
    })
    console.log(`[migrate-remove-2025-dividend] ${dividend.count} dividend verwijderd uit 2025, ${pensioen.count} pensioen-records uit MT940 verwijderd`)
  } catch (err) {
    console.error('[migrate-remove-2025-dividend] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
