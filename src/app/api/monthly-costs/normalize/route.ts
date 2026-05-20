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
      select: { id: true, description: true },
    })

    let updated = 0
    for (const row of imported) {
      const next = normalizeVendor(row.description)
      if (next && next !== row.description) {
        await prisma.monthlyCost.update({
          where: { id: row.id },
          data: { description: next },
        })
        updated++
      }
    }
    return NextResponse.json({ scanned: imported.length, updated })
  } catch (error) {
    console.error('Error normalizing monthly costs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
