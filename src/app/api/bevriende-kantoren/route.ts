import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  return { session }
}

// GET - alle kantoren, gegroepeerd per type
export async function GET() {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    const rows = await prisma.bevriendKantoor.findMany({
      orderBy: [{ type: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { naam: 'asc' }],
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching bevriende kantoren:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - nieuw kantoor toevoegen
export async function POST(req: NextRequest) {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    if (!body.type || !body.category || !body.naam) {
      return NextResponse.json({ error: 'type, category en naam zijn verplicht' }, { status: 400 })
    }
    if (!['national', 'international'].includes(body.type)) {
      return NextResponse.json({ error: 'type moet national of international zijn' }, { status: 400 })
    }
    // SortOrder = volgende beschikbare binnen die categorie
    const max = await prisma.bevriendKantoor.aggregate({
      _max: { sortOrder: true },
      where: { type: body.type, category: body.category },
    })
    const created = await prisma.bevriendKantoor.create({
      data: {
        type: body.type,
        category: String(body.category).trim(),
        naam: String(body.naam).trim(),
        adres: body.adres ? String(body.adres).trim() : null,
        plaats: body.plaats ? String(body.plaats).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        telefoon: body.telefoon ? String(body.telefoon).trim() : null,
        contactDaar: body.contactDaar ? String(body.contactDaar).trim() : null,
        contactWorkx: body.contactWorkx ? String(body.contactWorkx).trim() : null,
        bijzonderheden: body.bijzonderheden ? String(body.bijzonderheden).trim() : null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating bevriend kantoor:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
