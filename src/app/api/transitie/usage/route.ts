// Overzicht: wie gebruikt de transitievergoeding-tool en voor welke zaken.
// EXPLICIET: alleen Jochem ziet dit — bedragen worden NIET gedeeld.
// Doel: zicht op tool-adoptie, NIET op inhoud van berekeningen.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_EMAILS = ['jochem.deroos@workxadvocaten.nl']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!ALLOWED_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const calculations = await prisma.transitieCalculation.findMany({
      where: { userId: { not: null } },
      select: {
        id: true,
        userId: true,
        employerName: true,
        employeeName: true,
        createdAt: true,
        multiplier: true, // nodig om TV vs variant te kunnen labelen, geen bedrag
      },
      orderBy: { createdAt: 'desc' },
    })

    // User-info apart ophalen (geen Prisma-relation tussen calc en user)
    const userIds = Array.from(new Set(calculations.map(c => c.userId).filter(Boolean) as string[]))
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    return NextResponse.json(calculations.map(c => ({
      id: c.id,
      employerName: c.employerName,
      employeeName: c.employeeName,
      createdAt: c.createdAt,
      multiplier: c.multiplier,
      user: c.userId ? userMap.get(c.userId) || null : null,
    })))
  } catch (error) {
    console.error('transitie usage failed:', error)
    return NextResponse.json({ error: 'Kon usage niet ophalen' }, { status: 500 })
  }
}
