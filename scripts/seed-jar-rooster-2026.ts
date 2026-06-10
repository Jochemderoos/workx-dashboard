// Seed JAR rooster 2026 — 16 sessies op donderdag, eens per 3 weken
// (16.00–17.15 — tijd alleen in label, niet in date).
import { PrismaClient } from '@prisma/client'

const SESSIONS_2026: Array<{ month: number; day: number; name: string }> = [
  { month: 2, day: 12, name: 'Wies van Pesch' },
  { month: 3, day: 5, name: "Alexander Collot d'Escury" },
  { month: 3, day: 26, name: 'Julia Groen' },
  { month: 4, day: 16, name: 'Marnix Ritmeester' },
  { month: 5, day: 7, name: 'Heleen Pesser' },
  { month: 5, day: 28, name: 'Marlieke Schipper' },
  { month: 6, day: 18, name: 'Emma van der Vos' },
  { month: 7, day: 9, name: 'Maaike de Jong' },
  { month: 7, day: 30, name: 'Kay Maes' },
  { month: 8, day: 20, name: 'Jochem de Roos' },
  { month: 9, day: 10, name: 'Barbara Rip' },
  { month: 10, day: 1, name: 'Erika van Zadelhof' },
  { month: 10, day: 22, name: 'Justine Schellekens' },
  { month: 11, day: 12, name: 'Bas den Ridder' },
  { month: 12, day: 3, name: 'Juliette Niersman' },
  { month: 12, day: 24, name: 'Wies van Pesch' },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-jar-rooster-2026] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    let created = 0
    let skipped = 0
    for (const s of SESSIONS_2026) {
      // Donderdag 16:00 lokale tijd. Use UTC offset roughly — 14:00 UTC.
      const date = new Date(Date.UTC(2026, s.month - 1, s.day, 14, 0, 0))
      const existing = await prisma.jarSession.findFirst({
        where: { year: 2026, date },
      })
      if (existing) { skipped++; continue }
      await prisma.jarSession.create({
        data: { date, name: s.name, year: 2026 },
      })
      created++
    }
    console.log(`[seed-jar-rooster-2026] ${created} sessies aangemaakt, ${skipped} bestonden al`)
  } catch (err) {
    console.error('[seed-jar-rooster-2026] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()