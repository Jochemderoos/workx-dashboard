// Idempotente seed van kostenposten 2025 uit MT940 (data/mt940-2025.json).
// De JSON wordt eenmalig gegenereerd via scripts/_dump-mt940-2025.ts en
// gecommit naar de repo. Bij elke build worden alleen records toegevoegd
// waarvan de externalRef nog niet in de DB staat.

import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface DumpedTx {
  date: string
  year: number
  month: number
  amount: number
  description: string
  rawKey: string
  externalRef: string
  category: 'UWV' | 'ASR' | 'ZZP' | 'WGL' | null
}

export async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-monthly-costs-2025] geen DATABASE_URL — overslaan')
    return
  }
  const jsonPath = join(process.cwd(), 'data', 'mt940-2025.json')
  if (!existsSync(jsonPath)) {
    console.log('[seed-monthly-costs-2025] data/mt940-2025.json niet gevonden — overslaan')
    return
  }
  const txs: DumpedTx[] = JSON.parse(readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(txs) || txs.length === 0) {
    console.log('[seed-monthly-costs-2025] JSON leeg — overslaan')
    return
  }

  const prisma = new PrismaClient()
  try {
    // Welke externalRefs zitten al in de DB?
    const refs = txs.map(t => t.externalRef)
    const existing = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const existingSet = new Set(existing.map(e => e.externalRef).filter(Boolean) as string[])

    // Leer-aliassen toepassen
    const rawKeys = Array.from(new Set(txs.map(t => t.rawKey).filter(Boolean)))
    const learned = rawKeys.length > 0
      ? await prisma.vendorAlias.findMany({ where: { rawKey: { in: rawKeys } } })
      : []
    const learnedMap = new Map(learned.map(l => [l.rawKey, l.vendorName]))

    const toCreate = txs
      .filter(t => !existingSet.has(t.externalRef))
      .map((t, i) => ({
        year: t.year,
        month: t.month,
        amount: t.amount,
        description: learnedMap.get(t.rawKey) ?? t.description,
        sortOrder: i,
        externalRef: t.externalRef,
        rawKey: t.rawKey,
        category: t.category,
      }))

    if (toCreate.length === 0) {
      console.log(`[seed-monthly-costs-2025] alle ${txs.length} records al aanwezig`)
      return
    }

    // createMany in chunks van 500 (PG limiet ruim binnen)
    let added = 0
    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500)
      await prisma.monthlyCost.createMany({ data: chunk, skipDuplicates: true })
      added += chunk.length
    }
    console.log(`[seed-monthly-costs-2025] ${added} toegevoegd, ${existingSet.size} bestonden al`)
  } catch (err) {
    console.error('[seed-monthly-costs-2025] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()