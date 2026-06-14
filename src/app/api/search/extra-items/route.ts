// Dynamische zoek-items uit de database. Statische data (menu, hr-docs,
// factoids) zit in lib/search-index. Hier verzamelen we alles wat in de DB
// staat en geïndexeerd moet zijn — bevriende kantoren, en later eventueel
// andere recordsets.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SearchItem } from '@/lib/search-index'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const items: SearchItem[] = []

  // Bevriende kantoren — per kantoor één item, met alle relevante velden
  // zodat zowel naam, plaats, contactpersoon, rechtsgebied/land doorzoekbaar zijn.
  try {
    const kantoren = await prisma.bevriendKantoor.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    for (const k of kantoren) {
      const isIntl = k.type === 'international'
      const bits = [k.plaats, k.contactDaar, k.email, k.telefoon, k.bijzonderheden].filter(Boolean).join(' · ')
      items.push({
        id: `bevriend-kantoor:${k.id}`,
        kind: 'detail',
        label: k.naam,
        description: `Bevriend kantoor — ${isIntl ? 'internationaal' : 'NL'} · ${k.category}${bits ? ` · ${bits.slice(0, 80)}` : ''}`,
        href: `/dashboard/bevriende-kantoren?focus=${encodeURIComponent(k.id)}`,
        synonyms: [
          'bevriende kantoren', 'bevriend kantoor',
          k.category.toLowerCase(),
          k.plaats?.toLowerCase() || '',
          k.contactDaar?.toLowerCase() || '',
          k.naam.toLowerCase(),
        ].filter(Boolean),
        body: [k.naam, k.adres, k.plaats, k.email, k.telefoon, k.contactDaar, k.contactWorkx, k.bijzonderheden]
          .filter(Boolean).join(' '),
        section: 'Bevriende kantoren',
      })
    }
  } catch (err) {
    console.error('extra-items bevriende kantoren failed', err)
  }

  return NextResponse.json({ items }, {
    headers: { 'Cache-Control': 'private, max-age=300' }, // 5 min cache
  })
}
