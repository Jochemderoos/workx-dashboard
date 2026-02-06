import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'Zojuist'
  }
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minuut geleden' : `${diffMinutes} minuten geleden`
  }
  if (diffHours < 24) {
    return diffHours === 1 ? '1 uur geleden' : `${diffHours} uur geleden`
  }
  if (diffDays < 7) {
    return diffDays === 1 ? '1 dag geleden' : `${diffDays} dagen geleden`
  }

  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// GET - Fetch recent audit log activity for the activity feed widget
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const entityTypeFilter = url.searchParams.get('type')

    const whereClause: Record<string, unknown> = {
      action: { notIn: ['LOGIN', 'LOGOUT'] },
      user: { isActive: true },
    }

    if (entityTypeFilter) {
      whereClause.entityType = entityTypeFilter
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const activities = auditLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user.name,
      userAvatar: log.user.avatarUrl ?? null,
      action: log.action,
      entityType: log.entityType,
      description: log.description,
      timeAgo: formatTimeAgo(log.createdAt),
      createdAt: log.createdAt.toISOString(),
    }))

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error fetching dashboard activity:', error)
    return NextResponse.json(
      { error: 'Kon activiteiten niet ophalen' },
      { status: 500 }
    )
  }
}
