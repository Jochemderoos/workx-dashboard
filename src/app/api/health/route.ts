import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Health check endpoint - no auth required
// Use this to verify database connection and basic stats
export async function GET() {
  const startTime = Date.now()

  try {
    // Check database connection and get basic stats
    const [userCount, activeUsers, lastUser] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { name: true, updatedAt: true }
      })
    ])

    const dbLatency = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latency: `${dbLatency}ms`,
        users: {
          total: userCount,
          active: activeUsers
        },
        lastActivity: lastUser ? {
          user: lastUser.name,
          at: lastUser.updatedAt
        } : null
      },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 503 })
  }
}
