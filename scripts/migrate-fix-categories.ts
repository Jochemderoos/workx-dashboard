// Idempotent: corrigeer bestaande MonthlyCost-records.
//   - Tentoo: was ZZP, terug naar null (= gewone overige kost)
//   - Bright Pensioen: was null, naar WGL (= telt mee bij werkgeverslasten)

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-fix-categories] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    const tentoo = await prisma.monthlyCost.findMany({
      where: { category: 'ZZP', description: { contains: 'tentoo', mode: 'insensitive' } },
      select: { id: true },
    })
    if (tentoo.length > 0) {
      await prisma.monthlyCost.updateMany({
        where: { id: { in: tentoo.map(t => t.id) } },
        data: { category: null },
      })
    }

    const bright = await prisma.monthlyCost.findMany({
      where: {
        category: null,
        OR: [
          { description: { contains: 'bright pensioen', mode: 'insensitive' } },
          { description: { contains: 'pensioen', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
    if (bright.length > 0) {
      await prisma.monthlyCost.updateMany({
        where: { id: { in: bright.map(b => b.id) } },
        data: { category: 'WGL' },
      })
    }

    console.log(`[migrate-fix-categories] ${tentoo.length} Tentoo terug naar null, ${bright.length} Bright/Pensioen naar WGL`)
  } catch (err) {
    console.error('[migrate-fix-categories] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()