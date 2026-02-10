import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/push-notifications'
import { sendDirectMessage } from '@/lib/slack'

/**
 * Parse a date string to a Date object, ensuring we get the correct local date
 * regardless of timezone. This handles both ISO strings and date-only strings.
 */
function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate())
  }
  if (dateStr.includes('T')) {
    const date = new Date(dateStr)
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'

    // Check if user is admin or partner (can see all vacations)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (all || isAdmin) {
      // Get all approved requests (for calendar view) - or all for admins
      const requests = await prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
          endDate: {
            gte: new Date(new Date().getFullYear(), 0, 1), // From start of current year
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { startDate: 'asc' }
      })
      return NextResponse.json(requests)
    }

    // Get user's own requests
    const requests = await prisma.vacationRequest.findMany({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching vacation requests:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen requests' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { startDate, endDate, days, reason, userId: requestedUserId } = await req.json()

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Check if current user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    // Determine target user
    // Admin/Partner can create for anyone, employees only for themselves
    let targetUserId = session.user.id
    if (requestedUserId && requestedUserId !== session.user.id) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Je mag alleen vakantie voor jezelf aanvragen' },
          { status: 403 }
        )
      }
      targetUserId = requestedUserId
    }

    // Calculate days if not provided - use parseLocalDate to avoid timezone issues
    const start = parseLocalDate(startDate)
    const end = parseLocalDate(endDate)
    const calculatedDays = days || Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check available days (skip for admin when creating for others)
    if (!isAdmin || targetUserId === session.user.id) {
      const currentYear = new Date().getFullYear()
      const vacationBalance = await prisma.vacationBalance.findFirst({
        where: {
          userId: targetUserId,
          year: currentYear,
        }
      })

      if (vacationBalance) {
        const available = vacationBalance.overgedragenVorigJaar + vacationBalance.opbouwLopendJaar + (vacationBalance.bijgekocht || 0) - vacationBalance.opgenomenLopendJaar
        if (calculatedDays > available) {
          return NextResponse.json(
            { error: 'Niet genoeg vakantiedagen beschikbaar' },
            { status: 400 }
          )
        }
      }
    }

    // Auto-approve when created by admin/partner
    const status = isAdmin ? 'APPROVED' : 'PENDING'
    const approvedBy = isAdmin ? session.user.id : null

    const request = await prisma.vacationRequest.create({
      data: {
        userId: targetUserId,
        startDate: start,
        endDate: end,
        days: calculatedDays,
        reason,
        status,
        approvedBy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    // If auto-approved, update vacation balance
    if (status === 'APPROVED') {
      const currentYear = new Date().getFullYear()
      await prisma.vacationBalance.updateMany({
        where: {
          userId: targetUserId,
          year: currentYear,
        },
        data: {
          opgenomenLopendJaar: {
            increment: calculatedDays
          }
        }
      })
    }

    // Notify admin(s) when a non-admin creates a PENDING request
    if (status === 'PENDING') {
      const requesterName = request.user?.name || 'Medewerker'
      const startStr = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
      const endStr = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
      const dashboardUrl = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

      // Find all admins to notify
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, email: true, name: true }
      })

      for (const admin of admins) {
        // Push notification
        sendPushNotification(admin.id, {
          title: 'Nieuwe vakantieaanvraag',
          body: `${requesterName} vraagt ${calculatedDays} werkdagen vakantie aan (${startStr} – ${endStr})`,
          url: '/dashboard',
          tag: 'vacation-request',
        }).catch(() => {})

        // Slack DM
        sendDirectMessage(admin.email, `🏖️ Nieuwe vakantieaanvraag van ${requesterName} (${calculatedDays} werkdagen)\n${startStr} – ${endStr}${reason ? `\nReden: ${reason}` : ''}\n${dashboardUrl}/dashboard`, [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🏖️ Nieuwe vakantieaanvraag', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${requesterName}* vraagt vakantie aan:\n📅 ${startStr} – ${endStr}\n📊 *${calculatedDays} werkdagen*${reason ? `\n💬 ${reason}` : ''}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '✅ Bekijk in Dashboard', emoji: true },
                url: `${dashboardUrl}/dashboard`,
                style: 'primary',
              },
            ],
          },
        ]).catch(() => {})
      }
    }

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('Error creating vacation request:', error)
    return NextResponse.json(
      { error: 'Kon niet aanmaken request' },
      { status: 500 }
    )
  }
}
