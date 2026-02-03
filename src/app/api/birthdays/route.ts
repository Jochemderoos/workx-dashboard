import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600 // 1 hour cache

// GET all team birthdays
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active users with birthdays
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        birthDate: { not: null },
      },
      select: {
        name: true,
        birthDate: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching birthdays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch birthdays' },
      { status: 500 }
    )
  }
}
