// Eenmalige bulk-import van telefoonnummers vanuit workxadvocaten.nl
// (handmatig samengesteld, juni 2026). PARTNER + ADMIN only.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Nummer-mapping zoals op workxadvocaten.nl/team
const PHONE_MAPPING: Record<string, string> = {
  'Marnix Ritmeester': '+31 6 24 23 87 03',
  'Jochem de Roos': '+31 6 45 26 03 91',
  'Maaike de Jong': '+31 6 26 65 73 78',
  'Bas den Ridder': '+31 6 46 72 62 88',
  'Juliette Niersman': '+31 6 51 13 75 67',
  'Justine Schellekens': '+31 6 19 16 20 05',
  'Marlieke Schipper': '+31 6 19 65 07 72',
  'Wies van Pesch': '+31 6 49 05 76 72',
  'Emma van der Vos': '+31 6 52 83 94 95',
  'Kay Maes': '+31 6 12 69 36 68',
  'Julia Groen': '+31 6 44 19 33 10',
  'Erika van Zadelhof': '+31 6 30 10 59 38',
  'Barbara Rip': '+31 6 13 20 98 77',
  'Heleen Pesser': '+31 6 13 23 19 80',
  'Alexander Collot d\'Escury': '+31 6 23 52 85 46',
  'Lodewijk van Thiel': '+31 6 30 48 71 25',
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || !['PARTNER', 'ADMIN'].includes(me.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, phoneNumber: true },
    })

    const updated: { name: string; oldPhone: string | null; newPhone: string }[] = []
    const skipped: string[] = []

    for (const [name, phone] of Object.entries(PHONE_MAPPING)) {
      // Match op exacte naam (case-insensitive) of beginstring
      const lc = name.toLowerCase()
      const user = users.find(u =>
        u.name.toLowerCase() === lc ||
        u.name.toLowerCase().startsWith(lc.split(' ')[0]) // valt terug op voornaam-match
      )
      if (!user) {
        skipped.push(name)
        continue
      }
      // Update alleen als waarde anders is (idempotent)
      if (user.phoneNumber === phone) {
        skipped.push(`${name} (al ingevuld)`)
        continue
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneNumber: phone },
      })
      updated.push({ name: user.name, oldPhone: user.phoneNumber, newPhone: phone })
    }

    return NextResponse.json({ updated, skipped, totalMappings: Object.keys(PHONE_MAPPING).length })
  } catch (error) {
    console.error('Error bulk-importing phones:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
