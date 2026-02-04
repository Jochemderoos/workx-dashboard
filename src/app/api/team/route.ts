import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600 // 1 hour cache

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }


    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phoneNumber: true,
        startDate: true,
        createdAt: true,
        _count: {
          select: {
            assignedWork: {
              where: {
                status: {
                  in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW']
                }
              }
            }
          }
        },
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen team' },
      { status: 500 }
    )
  }
}
