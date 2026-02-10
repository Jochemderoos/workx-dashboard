import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/push-notifications'
import { sendDirectMessage } from '@/lib/slack'

/**
 * Parse a date string to a Date object, ensuring we get the correct local date
 * regardless of timezone.
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

// PATCH - Approve/reject or edit a vacation request
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    const body = await req.json()
    const { status, startDate, endDate, reason, rejectionReason } = body

    const request = await prisma.vacationRequest.findUnique({
      where: { id: params.id }
    })

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const isOwnRequest = request.userId === session.user.id
    if (!isAdmin && !isOwnRequest) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Employees can only edit their own pending requests
    if (!isAdmin && request.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Je kunt alleen aanvragen met status "wachtend" bewerken' },
        { status: 403 }
      )
    }

    // Handle status changes (approve/reject) - admin only
    if (status && ['APPROVED', 'REJECTED'].includes(status)) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Alleen beheerders kunnen aanvragen goedkeuren' }, { status: 403 })
      }

      const wasApproved = request.status === 'APPROVED'

      const updatedRequest = await prisma.vacationRequest.update({
        where: { id: params.id },
        data: {
          status,
          approvedBy: session.user.id,
        },
        include: {
          user: { select: { id: true, name: true, email: true, werkdagen: true } }
        }
      })

      // Update vacation balance based on status change
      const currentYear = new Date().getFullYear()
      if (status === 'APPROVED' && !wasApproved) {
        // Newly approved - add days
        await prisma.vacationBalance.updateMany({
          where: { userId: request.userId, year: currentYear },
          data: { opgenomenLopendJaar: { increment: request.days } }
        })

        // Create VacationPeriod for the calendar/agenda
        const balance = await prisma.vacationBalance.findFirst({
          where: { userId: request.userId },
        })
        if (balance) {
          const userWerkdagen = updatedRequest.user?.werkdagen || '1,2,3,4,5'
          await prisma.vacationPeriod.create({
            data: {
              userId: request.userId,
              balanceId: balance.id,
              year: currentYear,
              startDate: request.startDate,
              endDate: request.endDate,
              werkdagen: userWerkdagen,
              days: request.days,
              note: request.reason,
              createdById: session.user.id,
            },
          }).catch((e: any) => console.error('Error creating VacationPeriod:', e))
        }
      } else if (status === 'REJECTED' && wasApproved) {
        // Was approved, now rejected - remove days
        await prisma.vacationBalance.updateMany({
          where: { userId: request.userId, year: currentYear },
          data: { opgenomenLopendJaar: { decrement: request.days } }
        })
      }

      // Notify the employee about the decision
      const employee = updatedRequest.user
      if (employee) {
        const reqStart = parseLocalDate(request.startDate)
        const reqEnd = parseLocalDate(request.endDate)
        const startStr = reqStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
        const endStr = reqEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

        if (status === 'APPROVED') {
          // Push notification
          sendPushNotification(request.userId, {
            title: 'Vakantieaanvraag goedgekeurd ✓',
            body: `Je vakantie van ${startStr} t/m ${endStr} (${request.days} dagen) is goedgekeurd.`,
            url: '/dashboard',
            tag: 'vacation-approved',
          }).catch(() => {})

          // Slack DM
          if (employee.email) {
            sendDirectMessage(employee.email, `✅ Je vakantieaanvraag is goedgekeurd!\n${startStr} – ${endStr} (${request.days} werkdagen)`, [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ *Je vakantieaanvraag is goedgekeurd!*\n📅 ${startStr} – ${endStr}\n📊 *${request.days} werkdagen*\nVeel plezier! 🏖️`,
                },
              },
            ]).catch(() => {})
          }
        } else if (status === 'REJECTED') {
          const rejectMsg = rejectionReason ? `\nReden: ${rejectionReason}` : ''

          // Push notification
          sendPushNotification(request.userId, {
            title: 'Vakantieaanvraag afgewezen',
            body: `Je vakantie van ${startStr} t/m ${endStr} is helaas afgewezen.${rejectionReason ? ` Reden: ${rejectionReason}` : ''}`,
            url: '/dashboard',
            tag: 'vacation-rejected',
          }).catch(() => {})

          // Slack DM
          if (employee.email) {
            sendDirectMessage(employee.email, `❌ Je vakantieaanvraag is afgewezen\n${startStr} – ${endStr} (${request.days} werkdagen)${rejectMsg}`, [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `❌ *Je vakantieaanvraag is afgewezen*\n📅 ${startStr} – ${endStr}\n📊 *${request.days} werkdagen*${rejectionReason ? `\n💬 _${rejectionReason}_` : ''}\nNeem contact op als je vragen hebt.`,
                },
              },
            ]).catch(() => {})
          }
        }
      }

      return NextResponse.json(updatedRequest)
    }

    // Handle date/reason updates
    const updateData: any = {}
    if (startDate) updateData.startDate = parseLocalDate(startDate)
    if (endDate) updateData.endDate = parseLocalDate(endDate)
    if (reason !== undefined) updateData.reason = reason

    // Recalculate days if dates changed
    if (startDate || endDate) {
      const newStart = startDate ? parseLocalDate(startDate) : request.startDate
      const newEnd = endDate ? parseLocalDate(endDate) : request.endDate
      const newDays = Math.ceil((newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

      // If approved, adjust vacation balance
      if (request.status === 'APPROVED') {
        const daysDiff = newDays - request.days
        if (daysDiff !== 0) {
          const currentYear = new Date().getFullYear()
          await prisma.vacationBalance.updateMany({
            where: { userId: request.userId, year: currentYear },
            data: { opgenomenLopendJaar: { increment: daysDiff } }
          })
        }
      }

      updateData.days = newDays
    }

    const updatedRequest = await prisma.vacationRequest.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Error updating vacation request:', error)
    return NextResponse.json(
      { error: 'Kon niet bijwerken request' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel a vacation request
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    // Find the request
    const request = await prisma.vacationRequest.findUnique({
      where: { id: params.id }
    })

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Check permissions:
    // - Admin/Partner can delete anyone's request
    // - Employee can only delete their own pending requests
    if (!isAdmin) {
      if (request.userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Je mag alleen je eigen aanvragen verwijderen' },
          { status: 403 }
        )
      }
      if (request.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Je kunt alleen aanvragen met status "wachtend" verwijderen' },
          { status: 403 }
        )
      }
    }

    // If deleting an approved request, restore the vacation balance
    if (request.status === 'APPROVED') {
      const currentYear = new Date().getFullYear()
      await prisma.vacationBalance.updateMany({
        where: {
          userId: request.userId,
          year: currentYear,
        },
        data: {
          opgenomenLopendJaar: {
            decrement: request.days
          }
        }
      })
    }

    await prisma.vacationRequest.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vacation request:', error)
    return NextResponse.json(
      { error: 'Kon niet verwijderen request' },
      { status: 500 }
    )
  }
}
