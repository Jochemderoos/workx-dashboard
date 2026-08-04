import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyImport } from '@/lib/slack-import-notify'

async function requireAccess() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

// POST - bulk-import van kostenposten uit MT940 preview
// body: { items: [{ year, month, amount, description, externalRef }] }
export async function POST(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error
  try {
    const { items } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Geen items ontvangen' }, { status: 400 })
    }

    type IncomingItem = { year: number; month: number; amount: number; description: string; externalRef?: string; rawKey?: string; category?: string }
    const validItems = items as IncomingItem[]

    // --- DEDUP LAAG 1: externalRef ---
    // Hash van datum+bedrag+raw-description uit parser. Werkt zolang de
    // raw-description van de bank stabiel is.
    const refs: string[] = validItems
      .map(i => i.externalRef)
      .filter((r): r is string => typeof r === 'string' && r.length > 0)
    const existingByRef = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const dupSet = new Set(existingByRef.map(r => r.externalRef).filter(Boolean))

    // --- DEDUP LAAG 2: content-fingerprint (year, month, rawKey/desc, amount) ---
    // Vangt het scenario waarin dezelfde transactie 2× geüpload wordt maar de
    // bank-description net iets verschilt (= andere externalRef). Tactiek:
    // voor elke (year, month, rawKey, amount)-combinatie houden we bij hoeveel
    // er al in de DB staan; we voegen alleen het verschil met de batch toe.
    // Zo blijven legitieme herhalingen (bv. 3× Albert Heijn €25) doorgaan.
    const contentKey = (it: IncomingItem) => {
      const k = it.rawKey || `desc:${it.description.toLowerCase().trim().slice(0, 50)}`
      return `${it.year}-${it.month}|${k}|${it.amount.toFixed(2)}`
    }
    const incomingCounts = new Map<string, number>()
    for (const it of validItems) {
      if (!it.year || !it.month || it.amount == null) continue
      const k = contentKey(it)
      incomingCounts.set(k, (incomingCounts.get(k) || 0) + 1)
    }
    // Haal DB-counts voor exact dezelfde fingerprints op (parallel, in chunks)
    const dbCountMap = new Map<string, number>()
    const fingerprintEntries = Array.from(incomingCounts.keys())
    const FP_CHUNK = 100
    for (let i = 0; i < fingerprintEntries.length; i += FP_CHUNK) {
      const slice = fingerprintEntries.slice(i, i + FP_CHUNK)
      await Promise.all(slice.map(async k => {
        const [ym, keyPart, amtStr] = k.split('|')
        const [yStr, mStr] = ym.split('-')
        const year = Number(yStr)
        const month = Number(mStr)
        const amount = Number(amtStr)
        const where: Record<string, unknown> = { year, month, amount }
        if (keyPart.startsWith('desc:')) {
          where.rawKey = null
          where.description = { equals: keyPart.slice(5), mode: 'insensitive' }
        } else {
          where.rawKey = keyPart
        }
        const count = await prisma.monthlyCost.count({ where })
        dbCountMap.set(k, count)
      }))
    }
    // allowedExtras = wat we maximaal nog mogen toevoegen per fingerprint
    const allowedExtras = new Map<string, number>()
    incomingCounts.forEach((batchCount, k) => {
      const dbCount = dbCountMap.get(k) ?? 0
      allowedExtras.set(k, Math.max(batchCount - dbCount, 0))
    })

    let added = 0
    let skipped = 0
    let skippedContent = 0

    // Per maand sortOrder bijhouden
    const sortByMonth: Record<string, number> = {}

    for (const it of validItems) {
      if (it.externalRef && dupSet.has(it.externalRef)) {
        skipped++
        continue
      }
      if (!it.year || !it.month || it.amount == null || !it.description?.trim()) {
        skipped++
        continue
      }
      // Content-fingerprint check: als de DB al dezelfde fingerprint heeft
      // gezien minstens zo vaak als deze batch, skippen.
      const fk = contentKey(it)
      const remaining = allowedExtras.get(fk) ?? 0
      if (remaining <= 0) {
        skipped++
        skippedContent++
        continue
      }
      allowedExtras.set(fk, remaining - 1)
      // BINNEN-BATCH dedup: als deze externalRef nu wordt toegevoegd,
      // zorg dat hij hierna ook als 'duplicate' wordt herkend.
      if (it.externalRef) dupSet.add(it.externalRef)
      const key = `${it.year}-${it.month}`
      if (!(key in sortByMonth)) {
        const maxSort = await prisma.monthlyCost.aggregate({
          where: { year: it.year, month: it.month },
          _max: { sortOrder: true },
        })
        sortByMonth[key] = (maxSort._max.sortOrder ?? -1) + 1
      }
      await prisma.monthlyCost.create({
        data: {
          year: Number(it.year),
          month: Number(it.month),
          amount: Number(it.amount),
          description: String(it.description).trim(),
          category: it.category || null,
          externalRef: it.externalRef || null,
          rawKey: it.rawKey || null,
          sortOrder: sortByMonth[key]++,
        },
      })
      added++
    }

    // Melding naar Jochem / Hanna / Lotte / Bente (uploader uitgesloten) — niet-blokkerend
    if (added > 0) {
      const uploader = await prisma.user.findUnique({
        where: { id: guard.session!.user.id },
        select: { id: true, name: true },
      })
      if (uploader) {
        void notifyImport({
          uploaderId: uploader.id,
          uploaderName: uploader.name,
          type: 'kosten',
          summary: `${added} kostenposten toegevoegd${skipped > 0 ? `, ${skipped} overgeslagen (duplicaten)` : ''}.`,
        })
      }
    }

    return NextResponse.json({ added, skipped, skippedContent })
  } catch (error) {
    console.error('Error bulk-importing monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
