import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Zet/haal de voorkeur van de huidige gebruiker om dit programma-
// onderdeel te helpen organiseren (toggle). Iedere ingelogde gebruiker mag dit.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const programId = params.id
    const userId = session.user.id

    const existing = await prisma.lustrumProgramPreference.findUnique({
      where: { programId_userId: { programId, userId } },
    })

    if (existing) {
      await prisma.lustrumProgramPreference.delete({ where: { id: existing.id } })
      return NextResponse.json({ active: false })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    await prisma.lustrumProgramPreference.create({
      data: { programId, userId, name: user?.name || 'Onbekend' },
    })
    return NextResponse.json({ active: true })
  } catch (error) {
    console.error('Error toggling lustrum preference:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
