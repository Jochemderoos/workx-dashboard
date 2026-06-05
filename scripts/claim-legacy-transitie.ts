// Eenmalig: wijs legacy transitie-records (userId=null) toe aan eigenaren
// op basis van werkgever-naam. Idempotent — records die al een eigenaar
// hebben worden niet aangeraakt.

import { PrismaClient } from '@prisma/client'

const MAPPINGS: { employerPattern: string; userName: string }[] = [
  { employerPattern: 'Epex', userName: 'Juliette' },
  { employerPattern: 'DBC', userName: 'Marnix' },
  { employerPattern: 'Shiva', userName: 'Marnix' },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[claim-legacy-transitie] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    for (const m of MAPPINGS) {
      const user = await prisma.user.findFirst({
        where: { isActive: true, name: { contains: m.userName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!user) {
        console.warn(`[claim-legacy-transitie] geen user voor "${m.userName}" — overslaan`)
        continue
      }
      const upd = await prisma.transitieCalculation.updateMany({
        where: {
          userId: null,
          employerName: { contains: m.employerPattern, mode: 'insensitive' },
        },
        data: { userId: user.id },
      })
      console.log(`[claim-legacy-transitie] ${m.employerPattern} → ${user.name}: ${upd.count} record(s)`)
    }
  } catch (err) {
    console.error('[claim-legacy-transitie] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
