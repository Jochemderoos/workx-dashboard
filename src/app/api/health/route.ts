import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Health check endpoint - basic connectivity check only
export async function GET() {
  const startTime = Date.now()

  try {
    // Simple database ping - no sensitive data
    await prisma.$queryRaw`SELECT 1`

    const dbLatency = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latency: `${dbLatency}ms`,
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
      }
    }, { status: 503 })
  }
}
