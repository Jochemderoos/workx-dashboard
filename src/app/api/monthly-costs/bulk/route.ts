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

    // Filter dubbele externalRefs en check bestaande records
    const refs: string[] = items
      .map((i: { externalRef?: string }) => i.externalRef)
      .filter((r: string | undefined): r is string => typeof r === 'string' && r.length > 0)
    const existingByRef = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: refs } },
      select: { externalRef: true },
    })
    const dupSet = new Set(existingByRef.map(r => r.externalRef).filter(Boolean))

    // Tweede dedup-laag: content-key (year, month, abs(amount), description-normalized)
    // Hiermee voorkomen we duplicaten van transacties die in verschillende
    // MT940-uploads een andere externalRef krijgen maar functioneel hetzelfde zijn
    // (bv. management fee 1x per maand).
    const normalizeDesc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
    const contentKey = (year: number, month: number, amount: number, desc: string) =>
      `${year}-${month}|${Math.abs(amount).toFixed(2)}|${normalizeDesc(desc)}`

    // Pak alle bestaande costs van betrokken maanden om te dedupen op content
    const periodsInItems = new Set(items.map((i: any) => `${i.year}-${i.month}`))
    const yearMonths = Array.from(periodsInItems).map((s: any) => {
      const [y, m] = String(s).split('-').map(Number)
      return { year: y, month: m }
    })
    const existingInPeriods = yearMonths.length > 0
      ? await prisma.monthlyCost.findMany({
          where: { OR: yearMonths.map(ym => ({ year: ym.year, month: ym.month })) },
          select: { year: true, month: true, amount: true, description: true },
        })
      : []
    const contentDupSet = new Set(
      existingInPeriods.map(c => contentKey(c.year, c.month, c.amount, c.description))
    )

    let added = 0
    let skipped = 0

    // Per maand sortOrder bijhouden
    const sortByMonth: Record<string, number> = {}

    for (const it of items as Array<{ year: number; month: number; amount: number; description: string; externalRef?: string; rawKey?: string; category?: string }>) {
      if (it.externalRef && dupSet.has(it.externalRef)) {
        skipped++
        continue
      }
      if (!it.year || !it.month || it.amount == null || !it.description?.trim()) {
        skipped++
        continue
      }
      // Content-key dup-check (zelfde bedrag + omschrijving in dezelfde maand)
      const ck = contentKey(it.year, it.month, it.amount, it.description)
      if (contentDupSet.has(ck)) {
        skipped++
        continue
      }
      contentDupSet.add(ck) // ook binnen dezelfde batch dedupen
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

    // Slack DM naar Jochem / Hanna / Lotte (uploader uitgesloten) — niet-blokkerend
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

    return NextResponse.json({ added, skipped })
  } catch (error) {
    console.error('Error bulk-importing monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
