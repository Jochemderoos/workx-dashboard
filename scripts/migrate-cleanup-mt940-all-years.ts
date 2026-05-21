// Idempotent: voor alle jaren, verwijder MT940-geïmporteerde records die
// volgens de huidige skip-regels niet als bedrijfskost horen te bestaan.
// Werkt alleen op records met externalRef (= via MT940 ingeladen), dus
// handmatig ingevoerde records blijven onaangetast.
//
// Skip-patronen (zelfde als in src/lib/parse-mt940.ts):
//   - Belastingdienst (loonheffing/VPB)
//   - Workx Advocaten interne overboekingen
//   - Bright Pensioen / pensioen (al op loonstrook)
//   - Workx-medewerkers (salaris al op loonstrook)
//   - Partner-holdings BIJ dividend/retour/deel-omschrijving

import { PrismaClient } from '@prisma/client'

const SKIP_LIKE_PATTERNS: string[] = [
  // Belastingdienst
  'belastingdienst',
  // Workx interne overboekingen
  'workx advocaten',
  // Pensioen
  'bright pensioen',
  ' pensioen',
  // Medewerker-achternamen (alleen met externalRef = via MT940)
  'schipper',
  'van der vos',
  'heunen',
  'barbara rip',
  'schellekens',
  'van pesch',
  'van zadelhof',
  'blaauboer',
  'kay maes',
  'heleen pesser',
  'julia groen',
  'niersman',
  'sint truien',
  'sint truiden',
  'loomans',
  'portman',
]

const DIVIDEND_KEYWORDS = ['dividend', 'interim dividend']
const PARTNER_NAMES = ['les dents du midi', 'cavalieri', 'nilsson', 'jader', 'isma b.v.']

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-cleanup-mt940-all-years] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    // 1) Skip-like records (medewerkers/belasting/pensioen/intern)
    const skipLike = await prisma.monthlyCost.deleteMany({
      where: {
        externalRef: { not: null },
        OR: SKIP_LIKE_PATTERNS.map(p => ({
          description: { contains: p, mode: 'insensitive' as const },
        })),
      },
    })

    // 2) Partner-holdings met dividend-omschrijving (niet als kost)
    //    Conservatief: alleen records die ZOWEL een partner-naam ALS een
    //    dividend-keyword in description hebben.
    let dividendCount = 0
    for (const partner of PARTNER_NAMES) {
      for (const div of DIVIDEND_KEYWORDS) {
        const res = await prisma.monthlyCost.deleteMany({
          where: {
            externalRef: { not: null },
            AND: [
              { description: { contains: partner, mode: 'insensitive' } },
              { description: { contains: div, mode: 'insensitive' } },
            ],
          },
        })
        dividendCount += res.count
      }
    }

    console.log(`[migrate-cleanup-mt940-all-years] ${skipLike.count} skip-like records weg, ${dividendCount} dividend-records weg`)
  } catch (err) {
    console.error('[migrate-cleanup-mt940-all-years] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
