// Idempotente seed van 2026 MT940-records.
//
// Strategie om dubbeltelling met handmatige Excel-import (jan-apr) te
// voorkomen:
//   - MGMT records (management fee partners): altijd seeden — die zaten
//     niet in Excel (geen handmatige invoer mogelijk omdat ze toen onbekend
//     waren).
//   - Records voor maand >= 5: altijd seeden — daar is geen Excel-data
//     voor (mei+ kwam pas via MT940 binnen).
//   - Records voor maand 1-4 en category != MGMT: SKIPPEN — Excel
//     handmatige invoer dekt deze al.
//
// Idempotency: via externalRef + skipDuplicates.

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
  category: 'UWV' | 'ASR' | 'ZZP' | 'MGMT' | null
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-monthly-costs-2026-mt940] geen DATABASE_URL — overslaan')
    return
  }
  const jsonPath = join(process.cwd(), 'data', 'mt940-2026.json')
  if (!existsSync(jsonPath)) {
    console.log('[seed-monthly-costs-2026-mt940] data/mt940-2026.json niet gevonden — overslaan')
    return
  }
  const all: DumpedTx[] = JSON.parse(readFileSync(jsonPath, 'utf8'))
  if (!Array.isArray(all) || all.length === 0) {
    console.log('[seed-monthly-costs-2026-mt940] JSON leeg — overslaan')
    return
  }

  // Filter: MGMT altijd, anders alleen maand >= 5
  const filtered = all.filter(t => t.category === 'MGMT' || t.month >= 5)
  if (filtered.length === 0) {
    console.log('[seed-monthly-costs-2026-mt940] niets te seeden na filter')
    return
  }

  const prisma = new PrismaClient()
  try {
    // Welke externalRefs zitten al in de DB?
    const refs = filtered.map(t => t.externalRef)
    const existing = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const existingSet = new Set(existing.map(e => e.externalRef).filter(Boolean) as string[])

    // Leer-aliassen toepassen
    const rawKeys = Array.from(new Set(filtered.map(t => t.rawKey).filter(Boolean)))
    const learned = rawKeys.length > 0
      ? await prisma.vendorAlias.findMany({ where: { rawKey: { in: rawKeys } } })
      : []
    const learnedMap = new Map(learned.map(l => [l.rawKey, l.vendorName]))

    const toCreate = filtered
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
      console.log(`[seed-monthly-costs-2026-mt940] alle ${filtered.length} records al aanwezig`)
      return
    }

    let added = 0
    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500)
      await prisma.monthlyCost.createMany({ data: chunk, skipDuplicates: true })
      added += chunk.length
    }
    const mgmtAdded = toCreate.filter(t => t.category === 'MGMT').length
    console.log(`[seed-monthly-costs-2026-mt940] ${added} toegevoegd (waarvan ${mgmtAdded} MGMT), ${existingSet.size} bestonden al`)
  } catch (err) {
    console.error('[seed-monthly-costs-2026-mt940] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
