import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  userName: string
  userPhoto?: string | null
  createdAt: Date
  metadata?: {
    status?: string
    priority?: string
  }
}

// GET - Fetch recent activity across the dashboard
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0]

    // Fetch all sources in parallel
    const [recentVacations, todayAttendance, recentWorkItems, recentFeedback, recentZaken] = await Promise.all([
      // 1. Recent vacation requests
      prisma.vacationRequest.findMany({
        where: { createdAt: { gte: weekAgo } },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // 2. Today's office attendance
      prisma.officeAttendance.findMany({
        where: { date: todayStr },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // 3. Recent work items
      prisma.workItem.findMany({
        where: { createdAt: { gte: weekAgo } },
        include: { createdBy: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // 4. Recent feedback
      prisma.feedback.findMany({
        where: { createdAt: { gte: weekAgo } },
        include: { submittedBy: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // 5. Recent zaken
      prisma.zaak.findMany({
        where: { createdAt: { gte: weekAgo } },
        include: { createdBy: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const activities: ActivityItem[] = []

    recentVacations.forEach((v) => {
      activities.push({
        id: `vacation-${v.id}`,
        type: v.status === 'APPROVED' ? 'vacation_approved' : 'vacation_request',
        title: v.status === 'APPROVED' ? 'kreeg vakantie goedgekeurd' : 'vroeg vakantie aan',
        description: `${new Date(v.startDate).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })} - ${new Date(v.endDate).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`,
        userName: v.user.name,
        userPhoto: v.user.avatarUrl,
        createdAt: v.createdAt,
        metadata: { status: v.status },
      })
    })

    todayAttendance.forEach((a) => {
      activities.push({
        id: `attendance-${a.id}`,
        type: 'office_attendance',
        title: 'is op kantoor',
        description: a.timeSlot === 'MORNING' ? 'Ochtend' : a.timeSlot === 'AFTERNOON' ? 'Middag' : 'Hele dag',
        userName: a.user.name,
        userPhoto: a.user.avatarUrl,
        createdAt: a.createdAt,
      })
    })

    recentWorkItems.forEach((w) => {
      activities.push({
        id: `work-${w.id}`,
        type: 'work_item',
        title: 'maakte een nieuwe taak',
        description: w.title,
        userName: w.createdBy?.name || 'Onbekend',
        userPhoto: w.createdBy?.avatarUrl,
        createdAt: w.createdAt,
        metadata: { priority: w.priority },
      })
    })

    recentFeedback.forEach((f) => {
      activities.push({
        id: `feedback-${f.id}`,
        type: 'feedback',
        title: f.type === 'BUG' ? 'meldde een bug' : 'deelde een idee',
        description: f.title,
        userName: f.submittedBy.name,
        userPhoto: f.submittedBy.avatarUrl,
        createdAt: f.createdAt,
      })
    })

    recentZaken.forEach((z) => {
      activities.push({
        id: `zaak-${z.id}`,
        type: 'zaak',
        title: 'maakte een nieuwe zaak',
        description: z.shortDescription,
        userName: z.createdBy?.name || 'Onbekend',
        userPhoto: z.createdBy?.avatarUrl,
        createdAt: z.createdAt,
      })
    })

    // Sort by createdAt (newest first) and limit
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      activities: activities.slice(0, limit),
      total: activities.length,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
