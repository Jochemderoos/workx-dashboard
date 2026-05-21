import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseMT940 } from '@/lib/parse-mt940'

async function requireAccess() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

// POST - MT940-bestand uploaden → JSON met parsed transacties (met duplicaat-flag)
export async function POST(req: NextRequest) {
  const guard = await requireAccess()
  if (guard.error) return guard.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }
    const text = await file.text()
    if (!text.includes(':61:')) {
      return NextResponse.json({ error: 'Bestand lijkt geen MT940. Verwacht :61:-regels.' }, { status: 400 })
    }
    const txs = parseMT940(text)

    if (txs.length === 0) {
      return NextResponse.json({ transactions: [], duplicateCount: 0 })
    }

    // Duplicaten opzoeken
    const existingRefs = await prisma.monthlyCost.findMany({
      where: { externalRef: { in: txs.map(t => t.externalRef) } },
      select: { externalRef: true },
    })
    const dupSet = new Set(existingRefs.map(r => r.externalRef).filter(Boolean))

    // Leer-aliassen toepassen: voor elke unieke rawKey kijken of de
    // gebruiker eerder een handmatige correctie heeft opgeslagen, en die
    // dan gebruiken in plaats van de standaard-vendornaam.
    const rawKeys = Array.from(new Set(txs.map(t => t.rawKey).filter(Boolean)))
    const learned = rawKeys.length > 0
      ? await prisma.vendorAlias.findMany({ where: { rawKey: { in: rawKeys } } })
      : []
    const learnedMap = new Map(learned.map(l => [l.rawKey, l.vendorName]))

    const result = txs.map(t => ({
      date: t.date.toISOString().slice(0, 10),
      year: t.date.getFullYear(),
      month: t.date.getMonth() + 1,
      amount: t.amount,
      description: learnedMap.get(t.rawKey) ?? t.description,
      rawKey: t.rawKey,
      externalRef: t.externalRef,
      category: t.category || null,
      isDuplicate: dupSet.has(t.externalRef),
      isLearned: learnedMap.has(t.rawKey),
    }))

    return NextResponse.json({
      transactions: result,
      duplicateCount: result.filter(r => r.isDuplicate).length,
      learnedCount: result.filter(r => r.isLearned).length,
    })
  } catch (error) {
    console.error('Error parsing MT940:', error)
    return NextResponse.json({ error: 'Kon bestand niet verwerken' }, { status: 500 })
  }
}
