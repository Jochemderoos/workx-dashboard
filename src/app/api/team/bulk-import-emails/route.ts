// Eenmalige bulk-import van emails vanuit workxadvocaten.nl
// SAFE-MODE: vult alleen in als de huidige email leeg is (of placeholder).
// Bestaande emails worden NOOIT overschreven (zou login breken).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EMAIL_MAPPING: Record<string, string> = {
  'Marnix Ritmeester': 'marnix.ritmeester@workxadvocaten.nl',
  'Jochem de Roos': 'jochem.deroos@workxadvocaten.nl',
  'Maaike de Jong': 'maaike.dejong@workxadvocaten.nl',
  'Bas den Ridder': 'bas.denridder@workxadvocaten.nl',
  'Juliette Niersman': 'juliette.niersman@workxadvocaten.nl',
  'Justine Schellekens': 'justine.schellekens@workxadvocaten.nl',
  'Marlieke Schipper': 'marlieke.schipper@workxadvocaten.nl',
  'Wies van Pesch': 'wies.vanpesch@workxadvocaten.nl',
  'Emma van der Vos': 'emma.vandervos@workxadvocaten.nl',
  'Kay Maes': 'kay.maes@workxadvocaten.nl',
  'Julia Groen': 'julia.groen@workxadvocaten.nl',
  'Erika van Zadelhof': 'erika.vanzadelhof@workxadvocaten.nl',
  'Barbara Rip': 'barbara.rip@workxadvocaten.nl',
  'Heleen Pesser': 'heleen.pesser@workxadvocaten.nl',
  'Alexander Collot d\'Escury': 'alexander.collot@workxadvocaten.nl',
  'Lodewijk van Thiel': 'lodewijk.vanthiel@workxadvocaten.nl',
  'Hanna Blaauboer': 'hanna.blaauboer@workxadvocaten.nl',
}

function looksEmpty(email: string | null | undefined): boolean {
  if (!email) return true
  const lc = email.trim().toLowerCase()
  if (!lc) return true
  if (lc.includes('placeholder')) return true
  if (lc.includes('@example.')) return true
  return false
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
      select: { id: true, name: true, email: true },
    })

    const updated: { name: string; oldEmail: string | null; newEmail: string }[] = []
    const skippedExisting: { name: string; email: string }[] = []
    const notFound: string[] = []

    for (const [name, email] of Object.entries(EMAIL_MAPPING)) {
      const lc = name.toLowerCase()
      const user = users.find(u =>
        u.name.toLowerCase() === lc ||
        u.name.toLowerCase().startsWith(lc.split(' ')[0])
      )
      if (!user) {
        notFound.push(name)
        continue
      }
      if (!looksEmpty(user.email)) {
        // Bestaande email — niet overschrijven (login afhankelijkheid)
        skippedExisting.push({ name: user.name, email: user.email })
        continue
      }
      // Update — maar check op duplicate eerst
      const dup = await prisma.user.findUnique({ where: { email } })
      if (dup && dup.id !== user.id) {
        skippedExisting.push({ name: user.name, email: `${user.email || '(leeg)'} → ${email} reeds in gebruik door ${dup.name}` })
        continue
      }
      await prisma.user.update({ where: { id: user.id }, data: { email } })
      updated.push({ name: user.name, oldEmail: user.email, newEmail: email })
    }

    return NextResponse.json({
      updated,
      skippedExisting,
      notFound,
      note: 'Bestaande emails worden NOOIT overschreven (login-afhankelijkheid). Alleen lege/placeholder emails worden ingevuld.',
    })
  } catch (error) {
    console.error('Error bulk-importing emails:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
