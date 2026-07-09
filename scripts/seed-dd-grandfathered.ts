// Eenmalige snapshot: markeert alle DD-zaken die NU al in het overzicht
// (kunnen) staan als grandfathered=true, zodat ze zichtbaar blijven ook al
// bevat hun naam niet DD/VDD/Due Diligence. Nieuwe zaken (na deze snapshot)
// moeten wél een van die trefwoorden bevatten om te verschijnen.
//
// Run-once: draait alleen als er nog geen enkele grandfathered=true bestaat.
// Zo grandfathert een latere deploy geen zaken die ná invoering zijn
// binnengekomen.

import { PrismaClient } from '@prisma/client'

// Zelfde aliassen als in de DD-projecten pagina (matchDDClient).
const CLIENT_ALIASES: Record<string, string> = {
  debreij: 'De Breij',
  'de breij': 'De Breij',
  stek: 'Stek',
  'jb law': 'JB Law',
  strauswolfs: 'Strauswolfs',
  strasuwolfs: 'Strauswolfs',
  cleber: 'Cleber',
}

function matchDDClient(projectName: string): boolean {
  const lower = projectName.toLowerCase()
  return Object.keys(CLIENT_ALIASES).some((alias) => lower.includes(alias))
}

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-dd-grandfathered] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // Run-once: al eerder gedaan? dan niets doen.
    const already = await prisma.dDProjectEstimate.count({ where: { grandfathered: true } })
    if (already > 0) {
      console.log(`[seed-dd-grandfathered] al gedaan (${already} gemarkeerd) — overslaan`)
      return
    }

    // Alle unieke projectnamen uit de volledige urenhistorie.
    const rows = await prisma.workloadDetail.findMany({
      distinct: ['projectName'],
      select: { projectName: true },
    })
    const ddNames = rows.map((r) => r.projectName).filter((n) => n && matchDDClient(n))

    let marked = 0
    for (const projectName of ddNames) {
      await prisma.dDProjectEstimate.upsert({
        where: { projectName },
        // Bestaande estimate: alleen grandfathered zetten, rest ongemoeid
        // (hidden/expectedHours/members blijven staan).
        update: { grandfathered: true },
        create: { projectName, grandfathered: true, expectedHours: 0 },
      })
      marked++
    }
    console.log(`[seed-dd-grandfathered] ${marked} bestaande DD-zaken gemarkeerd als grandfathered`)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
