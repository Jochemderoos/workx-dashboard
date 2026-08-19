import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PINNABLE_BY_KEY, OFFICE_DEFAULT_TOP, isOfficeRole, CUSTOMIZED_SENTINEL } from '@/lib/pinnable-widgets'

interface PinInput {
  widgetKey: string
  placement: 'top' | 'below'
  sortOrder?: number
}

// GET - de effectieve pins van de huidige gebruiker.
// Nog nooit aangepast → rol-defaults (office-team krijgt de office-kernvakjes).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const rows = await prisma.dashboardPin.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'asc' },
    })
    const customized = rows.length > 0
    const real = rows.filter(r => r.widgetKey !== CUSTOMIZED_SENTINEL && PINNABLE_BY_KEY[r.widgetKey])

    if (customized) {
      return NextResponse.json({
        customized: true,
        pins: real.map(r => ({ widgetKey: r.widgetKey, placement: r.placement, sortOrder: r.sortOrder })),
      })
    }

    // Defaults op basis van rol
    const role = (session.user as { role?: string }).role
    const defaults = isOfficeRole(role)
      ? OFFICE_DEFAULT_TOP.map((k, i) => ({ widgetKey: k, placement: 'top' as const, sortOrder: i }))
      : []
    return NextResponse.json({ customized: false, pins: defaults })
  } catch (error) {
    console.error('Error fetching dashboard pins:', error)
    return NextResponse.json({ error: 'Kon pins niet ophalen' }, { status: 500 })
  }
}

// PUT - vervang de volledige pin-set van de gebruiker.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const body = await req.json()
    const raw: PinInput[] = Array.isArray(body?.pins) ? body.pins : []

    // Valideer: alleen bekende keys + geldige plaatsing, ontdubbel op key.
    const seen = new Set<string>()
    const clean = raw
      .filter(p => p && PINNABLE_BY_KEY[p.widgetKey] && (p.placement === 'top' || p.placement === 'below'))
      .filter(p => (seen.has(p.widgetKey) ? false : (seen.add(p.widgetKey), true)))
      .map((p, i) => ({
        userId: session.user.id,
        widgetKey: p.widgetKey,
        placement: p.placement,
        sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : i,
      }))

    await prisma.$transaction([
      prisma.dashboardPin.deleteMany({ where: { userId: session.user.id } }),
      prisma.dashboardPin.createMany({
        data: clean.length > 0
          ? clean
          // Lege set → sentinel-rij zodat defaults niet terugkomen.
          : [{ userId: session.user.id, widgetKey: CUSTOMIZED_SENTINEL, placement: 'none', sortOrder: 0 }],
      }),
    ])

    return NextResponse.json({ success: true, count: clean.length })
  } catch (error) {
    console.error('Error saving dashboard pins:', error)
    return NextResponse.json({ error: 'Kon pins niet opslaan' }, { status: 500 })
  }
}
