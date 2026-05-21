// Idempotent: zet category='ZZP' op bestaande MonthlyCost-records waarvan
// de omschrijving Nectaro, Lodewijk of Tentoo bevat (externe advocaten/
// payrolling). Verandert geen bedragen — alleen tagging.

import { PrismaClient } from '@prisma/client'

const ZZP_PATTERN = /nectaro|lodewijk|tentoo/i

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-zzp-category] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const candidates = await prisma.monthlyCost.findMany({
      where: { category: null },
      select: { id: true, description: true },
    })
    let updated = 0
    for (const c of candidates) {
      if (ZZP_PATTERN.test(c.description)) {
        await prisma.monthlyCost.update({ where: { id: c.id }, data: { category: 'ZZP' } })
        updated++
      }
    }
    console.log(`[migrate-zzp-category] ${updated} records gemarkeerd als ZZP`)
  } catch (err) {
    console.error('[migrate-zzp-category] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
