// CandidateConnection: meerdere users kunnen zich koppelen aan een kandidaat
// die door iemand anders is aangedragen. Werkt op naam-basis (lowercased).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeKey(name: string): string {
  return name.trim().toLowerCase()
}

// GET — lijst connections voor één kandidaat (?name=...&type=...) OF voor alle
// (gebruikt door recruitment-pagina om per kandidaat het netwerk te tonen)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const type = searchParams.get('type')

  try {
    const where: any = {}
    if (name) where.candidateKey = makeKey(name)
    if (type) where.candidateType = type
    const connections = await prisma.candidateConnection.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(connections)
  } catch (err) {
    console.error('candidate-connections GET failed', err)
    return NextResponse.json({ error: 'Kon connections niet ophalen' }, { status: 500 })
  }
}

// POST — voegt mezelf toe als 'ook in netwerk van' deze kandidaat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.candidateName?.trim() || !body.candidateType) {
      return NextResponse.json({ error: 'candidateName en candidateType verplicht' }, { status: 400 })
    }
    const conn = await prisma.candidateConnection.upsert({
      where: {
        candidateKey_candidateType_userId: {
          candidateKey: makeKey(body.candidateName),
          candidateType: body.candidateType,
          userId: session.user.id,
        },
      },
      create: {
        candidateKey: makeKey(body.candidateName),
        candidateType: body.candidateType,
        userId: session.user.id,
        notes: body.notes?.trim() || null,
      },
      update: {
        // Notes kunnen worden bijgewerkt bij her-aanroepen
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    return NextResponse.json(conn)
  } catch (err) {
    console.error('candidate-connections POST failed', err)
    return NextResponse.json({ error: 'Kon connection niet aanmaken' }, { status: 500 })
  }
}

// DELETE — verwijdert mezelf als kenner
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const type = searchParams.get('type')
  if (!name || !type) return NextResponse.json({ error: 'name en type verplicht' }, { status: 400 })

  try {
    await prisma.candidateConnection.deleteMany({
      where: {
        candidateKey: makeKey(name),
        candidateType: type,
        userId: session.user.id,
      },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('candidate-connections DELETE failed', err)
    return NextResponse.json({ error: 'Kon connection niet verwijderen' }, { status: 500 })
  }
}
