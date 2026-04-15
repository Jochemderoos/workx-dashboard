import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Create a team announcement (PARTNER/ADMIN only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Alleen partners en admins kunnen mededelingen versturen' }, { status: 403 })
    }

    const body = await request.json()
    const { title, message, recipientIds, priority, icon } = body

    if (!message || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'Bericht en ontvangers zijn verplicht' }, { status: 400 })
    }

    // Store recipients: if ["ALL"], store "ALL", otherwise store JSON array of IDs
    const recipients = recipientIds.includes('ALL') ? 'ALL' : JSON.stringify(recipientIds)

    const announcement = await prisma.teamAnnouncement.create({
      data: {
        senderId: session.user.id,
        title: title?.trim() || null,
        message,
        recipients,
        priority: priority || 'normal',
        icon: icon || null,
      },
      include: {
        sender: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json(announcement)
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// GET - Get announcements for the current user (last 7 days)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get all announcements from the last 7 days
    const allAnnouncements = await prisma.teamAnnouncement.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        sender: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter: only show announcements where user is a recipient or it's for ALL
    const userAnnouncements = allAnnouncements.filter((a) => {
      if (a.recipients === 'ALL') return true
      try {
        const ids = JSON.parse(a.recipients)
        return Array.isArray(ids) && ids.includes(userId)
      } catch {
        return false
      }
    })

    return NextResponse.json(userAnnouncements)
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
