// Eenmalig idempotent: laad de bekende UWV (zwangerschapsverlof) en
// ASR (verzuimverzekering) bijschrijvingen voor 2025 + 2026 in als
// negatieve MonthlyCost-records. Bedragen overgenomen uit de
// bankafschriften van de gebruiker. Bij volgende builds: skip
// bestaande records via deterministische externalRef.
//
// Verwijder dit script + buildchain-regel zodra alle records in de
// productie-DB staan en toekomstige uploads via de MT940-flow gaan.

import { PrismaClient } from '@prisma/client'

interface Entry {
  year: number
  month: number
  day: number
  category: 'UWV' | 'ASR'
  amount: number   // positief uit de bank; we slaan negatief op
}

const HISTORIC: Entry[] = [
  // === UWV bijschrijvingen (zwangerschapsverlof / WAZO) ===
  { year: 2026, month: 2,  day: 11, category: 'UWV', amount: 18203.66 },
  { year: 2025, month: 9,  day: 24, category: 'UWV', amount: 27963.23 },
  { year: 2025, month: 8,  day: 27, category: 'UWV', amount: 6171.65 },
  { year: 2025, month: 7,  day: 14, category: 'UWV', amount: 647.00 },
  { year: 2025, month: 5,  day: 16, category: 'UWV', amount: 1294.00 },
  { year: 2025, month: 4,  day: 9,  category: 'UWV', amount: 6031.22 },
  { year: 2025, month: 2,  day: 12, category: 'UWV', amount: 4691.04 },

  // === ASR bijschrijvingen (verzuimverzekering) ===
  { year: 2026, month: 4,  day: 7,  category: 'ASR', amount: 4265.12 },
  { year: 2025, month: 9,  day: 9,  category: 'ASR', amount: 4556.84 },
  { year: 2025, month: 8,  day: 1,  category: 'ASR', amount: 5464.75 },
  { year: 2025, month: 7,  day: 22, category: 'ASR', amount: 7124.19 },
  { year: 2025, month: 6,  day: 26, category: 'ASR', amount: 10033.20 },
  { year: 2025, month: 6,  day: 13, category: 'ASR', amount: 1880.34 },
  { year: 2025, month: 5,  day: 14, category: 'ASR', amount: 418.75 },
  { year: 2025, month: 5,  day: 9,  category: 'ASR', amount: 14257.56 },
  { year: 2025, month: 4,  day: 1,  category: 'ASR', amount: 6948.48 },
  { year: 2025, month: 3,  day: 3,  category: 'ASR', amount: 3464.31 },
  { year: 2025, month: 2,  day: 26, category: 'ASR', amount: 2618.98 },
  { year: 2025, month: 2,  day: 13, category: 'ASR', amount: 445.36 },
  { year: 2025, month: 2,  day: 10, category: 'ASR', amount: 47.95 },
  { year: 2025, month: 2,  day: 10, category: 'ASR', amount: 38.14 },
]

function refOf(e: Entry, idx: number): string {
  // Deterministisch — zelfde entry geeft altijd zelfde ref → idempotent
  return `historic-${e.category}-${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}-${e.amount.toFixed(2)}-${idx}`
}

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-uwv-asr-historic] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    let added = 0
    let skipped = 0
    for (let i = 0; i < HISTORIC.length; i++) {
      const e = HISTORIC[i]
      const externalRef = refOf(e, i)
      const exists = await prisma.monthlyCost.findFirst({
        where: { externalRef },
        select: { id: true },
      })
      if (exists) { skipped++; continue }

      const label = e.category === 'UWV'
        ? 'UWV-uitkering (zwangerschapsverlof)'
        : 'ASR-vergoeding (verzuimverzekering)'

      const maxSort = await prisma.monthlyCost.aggregate({
        where: { year: e.year, month: e.month },
        _max: { sortOrder: true },
      })
      await prisma.monthlyCost.create({
        data: {
          year: e.year,
          month: e.month,
          amount: -Math.abs(e.amount), // negatief = terugbetaling
          description: label,
          category: e.category,
          externalRef,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      })
      added++
    }
    console.log(`[seed-uwv-asr-historic] ${added} toegevoegd, ${skipped} overgeslagen`)
  } catch (err) {
    console.error('[seed-uwv-asr-historic] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()