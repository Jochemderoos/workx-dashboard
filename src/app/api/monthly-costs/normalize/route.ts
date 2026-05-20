import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeVendor } from '@/lib/cost-vendor'

async function requireAccess() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

// POST - normaliseer omschrijvingen van alle kostenposten met externalRef
// (= geïmporteerd uit MT940). Past dezelfde vendor-extractie toe als nieuwe
// imports, zodat reeds-geïmporteerde posten dezelfde nette stijl krijgen
// als de handmatig ingevoerde posten.
export async function POST() {
  const guard = await requireAccess()
  if (guard.error) return guard.error

  try {
    const imported = await prisma.monthlyCost.findMany({
      where: { externalRef: { not: null } },
      select: { id: true, description: true, rawKey: true },
    })

    // Verzamel alle rawKeys (waar al bekend) + bereken ontbrekende.
    const normalized = imported.map(row => {
      const { vendorName, rawKey } = normalizeVendor(row.description)
      return { id: row.id, oldDesc: row.description, vendorName, rawKey: row.rawKey || rawKey }
    })

    // Eerder geleerde aliassen ophalen — die overrulen de standaard-naam.
    const rawKeys = Array.from(new Set(normalized.map(n => n.rawKey).filter(Boolean)))
    const learned = rawKeys.length > 0
      ? await prisma.vendorAlias.findMany({ where: { rawKey: { in: rawKeys } } })
      : []
    const learnedMap = new Map(learned.map(l => [l.rawKey, l.vendorName]))

    let updated = 0
    for (const n of normalized) {
      const finalDesc = learnedMap.get(n.rawKey) ?? n.vendorName
      if (finalDesc && (finalDesc !== n.oldDesc || !n.rawKey)) {
        await prisma.monthlyCost.update({
          where: { id: n.id },
          data: { description: finalDesc, rawKey: n.rawKey || null },
        })
        if (finalDesc !== n.oldDesc) updated++
      }
    }
    return NextResponse.json({ scanned: imported.length, updated, learnedApplied: learned.length })
  } catch (error) {
    console.error('Error normalizing monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
