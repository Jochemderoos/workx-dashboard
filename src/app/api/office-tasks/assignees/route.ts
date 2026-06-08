// Geeft de selecteerbare verantwoordelijken voor office-tasks terug.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const FIRST_NAMES = ['Jochem', 'Hanna', 'Bente', 'Lotte']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: FIRST_NAMES.map(fn => ({ name: { startsWith: fn } })),
      },
      select: { id: true, name: true, avatarUrl: true, email: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(users)
  } catch (err) {
    console.error('assignees GET failed', err)
    return NextResponse.json({ error: 'Kon verantwoordelijken niet ophalen' }, { status: 500 })
  }
}
