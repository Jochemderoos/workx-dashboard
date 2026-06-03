// Idempotent: telt kostenZzp op bij kostenExtern in FinancialData2026 en
// zet kostenZzp daarna op alleen nullen. Bij volgende runs is kostenZzp
// al leeg, dan gebeurt er niets. Veilig om bij elke build te draaien.
//
// Verwijder dit script + de buildCommand-regel zodra in alle omgevingen
// duidelijk is dat de ZZP-data is samengevoegd.

import { PrismaClient } from '@prisma/client'

const EMPTY_12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-zzp] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const data = await prisma.financialData2026.findFirst()
    if (!data) {
      console.log('[migrate-zzp] geen FinancialData2026 record — overslaan')
      return
    }

    const zzp: number[] = data.kostenZzp ? JSON.parse(data.kostenZzp) : EMPTY_12
    const extern: number[] = data.kostenExtern ? JSON.parse(data.kostenExtern) : EMPTY_12

    const zzpHasValues = zzp.some((v) => v && v !== 0)
    if (!zzpHasValues) {
      console.log('[migrate-zzp] kostenZzp is leeg — niets te migreren')
      return
    }

    const merged = EMPTY_12.map((_, i) => (extern[i] || 0) + (zzp[i] || 0))
    await prisma.financialData2026.update({
      where: { id: data.id },
      data: {
        kostenExtern: JSON.stringify(merged),
        kostenZzp: JSON.stringify(EMPTY_12),
      },
    })
    console.log(`[migrate-zzp] ZZP samengevoegd met Kosten Extern (totaal +${zzp.reduce((s, v) => s + (v || 0), 0)})`)
  } catch (err) {
    console.error('[migrate-zzp] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()