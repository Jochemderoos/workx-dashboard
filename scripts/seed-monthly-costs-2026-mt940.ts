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

export async function main(externalPrisma?: PrismaClient) {
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

  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // DEDUP LAAG 1: externalRef
    const refs = filtered.map(t => t.externalRef)
    const existing = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const existingSet = new Set(existing.map(e => e.externalRef).filter(Boolean) as string[])

    // DEDUP LAAG 2: content-fingerprint (year, month, rawKey, amount).
    // Vangt het scenario waarin een user al heeft geüpload (met andere
    // externalRef-hashes wegens minimale verschillen in bank-description) —
    // anders zou de seed bij elke deploy dezelfde transactie opnieuw
    // toevoegen.
    const fp = (year: number, month: number, rawKey: string, amount: number) =>
      `${year}-${month}|${rawKey}|${amount.toFixed(2)}`

    const batchByFp = new Map<string, number>()
    for (const t of filtered) {
      if (existingSet.has(t.externalRef)) continue
      const k = fp(t.year, t.month, t.rawKey, t.amount)
      batchByFp.set(k, (batchByFp.get(k) || 0) + 1)
    }

    const dbCountByFp = new Map<string, number>()
    const fpEntries = Array.from(batchByFp.keys())
    const FP_CHUNK = 100
    for (let i = 0; i < fpEntries.length; i += FP_CHUNK) {
      const slice = fpEntries.slice(i, i + FP_CHUNK)
      await Promise.all(slice.map(async k => {
        const [ym, rawKey, amtStr] = k.split('|')
        const [yStr, mStr] = ym.split('-')
        const count = await prisma.monthlyCost.count({
          where: {
            year: Number(yStr),
            month: Number(mStr),
            rawKey,
            amount: Number(amtStr),
          },
        })
        dbCountByFp.set(k, count)
      }))
    }
    const allowedExtras = new Map<string, number>()
    batchByFp.forEach((batchCount, k) => {
      const dbCount = dbCountByFp.get(k) ?? 0
      allowedExtras.set(k, Math.max(batchCount - dbCount, 0))
    })

    // Leer-aliassen toepassen
    const rawKeys = Array.from(new Set(filtered.map(t => t.rawKey).filter(Boolean)))
    const learned = rawKeys.length > 0
      ? await prisma.vendorAlias.findMany({ where: { rawKey: { in: rawKeys } } })
      : []
    const learnedMap = new Map(learned.map(l => [l.rawKey, l.vendorName]))

    const toCreate: Array<{ year: number; month: number; amount: number; description: string; sortOrder: number; externalRef: string; rawKey: string; category: 'UWV'|'ASR'|'ZZP'|'MGMT'|null }> = []
    let skippedByContent = 0
    let i = 0
    for (const t of filtered) {
      if (existingSet.has(t.externalRef)) { i++; continue }
      const k = fp(t.year, t.month, t.rawKey, t.amount)
      const remaining = allowedExtras.get(k) ?? 0
      if (remaining <= 0) { skippedByContent++; i++; continue }
      allowedExtras.set(k, remaining - 1)
      toCreate.push({
        year: t.year,
        month: t.month,
        amount: t.amount,
        description: learnedMap.get(t.rawKey) ?? t.description,
        sortOrder: i++,
        externalRef: t.externalRef,
        rawKey: t.rawKey,
        category: t.category,
      })
    }

    if (toCreate.length === 0) {
      console.log(`[seed-monthly-costs-2026-mt940] niets te seeden (${existingSet.size} via externalRef bekend, ${skippedByContent} via content-fingerprint)`)
      return
    }

    let added = 0
    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500)
      await prisma.monthlyCost.createMany({ data: chunk, skipDuplicates: true })
      added += chunk.length
    }
    const mgmtAdded = toCreate.filter(t => t.category === 'MGMT').length
    console.log(`[seed-monthly-costs-2026-mt940] ${added} toegevoegd (waarvan ${mgmtAdded} MGMT), ${existingSet.size} via externalRef bekend, ${skippedByContent} via content-fingerprint geskipt`)
  } catch (err) {
    console.error('[seed-monthly-costs-2026-mt940] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()