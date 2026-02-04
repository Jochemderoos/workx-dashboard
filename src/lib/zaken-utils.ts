// Server-only functions for zaken management
// This file should only be imported in API routes, not client components

import { prisma } from '@/lib/prisma'
import {
  notifyNewZaakAssignment,
  notifyZaakAccepted,
  notifyZaakDeclined,
  notifyZaakReminder,
} from '@/lib/slack'
import { sendZaakReminderPush } from '@/lib/push-notifications'

// Re-export constants for convenience
export { EXPERIENCE_LABELS, URGENCY_CONFIG, START_METHOD_LABELS } from './zaken-constants'

/**
 * Calculate worked hours for a user on their last working day
 * Takes into account part-time schedules
 */
async function calculateRelevantHours(userId: string, userName: string, werkdagen: string | null): Promise<number> {
  const werkdagenArray = (werkdagen || '1,2,3,4,5').split(',').map(Number)

  // Find the last working day for this employee
  const today = new Date()
  let checkDate = new Date(today)
  checkDate.setDate(checkDate.getDate() - 1) // Start with yesterday

  let relevantDate: string | null = null
  let attempts = 0

  while (!relevantDate && attempts < 14) { // Max 2 weeks back
    const dayOfWeek = checkDate.getDay()
    // Convert JS day (0=Sun, 1=Mon) to schema (1=Mon, 7=Sun)
    const schemaDay = dayOfWeek === 0 ? 7 : dayOfWeek

    if (werkdagenArray.includes(schemaDay)) {
      relevantDate = checkDate.toISOString().split('T')[0]
    } else {
      checkDate.setDate(checkDate.getDate() - 1)
    }
    attempts++
  }

  if (!relevantDate) return 0

  // Get workload entry for that date
  const workload = await prisma.workload.findUnique({
    where: {
      personName_date: {
        personName: userName,
        date: relevantDate,
      },
    },
  })

  return workload?.hours || 0
}

/**
 * Generate the assignment queue for a new zaak
 * Orders employees by least hours worked (to balance workload)
 * @param zaakId - The zaak to generate queue for
 * @param minimumExperienceYear - Minimum experience year required
 * @param excludedUserIds - User IDs to exclude from the queue
 */
export async function generateAssignmentQueue(
  zaakId: string,
  minimumExperienceYear: number,
  excludedUserIds: string[] = []
) {
  // Get all active employees with sufficient experience (excluding specified users)
  const eligibleEmployees = await prisma.user.findMany({
    where: {
      isActive: true,
      role: 'EMPLOYEE',
      compensation: {
        experienceYear: { gte: minimumExperienceYear },
      },
      // Exclude specified users
      ...(excludedUserIds.length > 0 && {
        id: { notIn: excludedUserIds },
      }),
    },
    include: { compensation: true },
  })

  if (eligibleEmployees.length === 0) {
    return []
  }

  // Calculate relevant hours for each employee
  const employeesWithHours = await Promise.all(
    eligibleEmployees.map(async (emp) => {
      const hoursWorked = await calculateRelevantHours(emp.id, emp.name, emp.werkdagen)
      return { ...emp, hoursWorked }
    })
  )

  // Sort by LEAST hours first (to balance workload)
  employeesWithHours.sort((a, b) => a.hoursWorked - b.hoursWorked)

  // Create assignment records
  const assignments = employeesWithHours.map((emp, index) => ({
    zaakId,
    userId: emp.id,
    queuePosition: index + 1,
    hoursWorkedBasis: emp.hoursWorked,
    status: 'PENDING',
  }))

  await prisma.zaakAssignment.createMany({ data: assignments })

  return assignments
}

/**
 * Offer the zaak to the next person in queue
 * Returns the assignment data needed for email notification, or null if no one left
 */
export async function offerToNextInQueue(zaakId: string) {
  // Find the first PENDING assignment
  const nextAssignment = await prisma.zaakAssignment.findFirst({
    where: { zaakId, status: 'PENDING' },
    orderBy: { queuePosition: 'asc' },
    include: {
      user: true,
      zaak: {
        include: { createdBy: true }
      }
    },
  })

  if (!nextAssignment) {
    // No one left in queue - all have declined
    await prisma.zaak.update({
      where: { id: zaakId },
      data: { status: 'ALL_DECLINED' },
    })

    // Get all responses for the partners
    const allAssignments = await prisma.zaakAssignment.findMany({
      where: { zaakId },
      include: { user: true },
      orderBy: { queuePosition: 'asc' },
    })

    const zaak = await prisma.zaak.findUnique({
      where: { id: zaakId },
      include: { createdBy: true },
    })

    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER', isActive: true },
    })

    const responses = allAssignments.map(a => ({
      name: a.user.name,
      reason: a.declineReason || (a.status === 'TIMEOUT' ? 'Geen reactie (timeout)' : undefined),
    }))

    // Return data for email notification
    return {
      success: false,
      allDeclined: true,
      emailData: {
        partners,
        zaakDescription: zaak?.shortDescription || 'Onbekende zaak',
        responses,
      }
    }
  }

  // Update assignment status - Phase 1: 1 hour initial offer (Slack only, no popup)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000) // +1 hour for initial phase

  await prisma.zaakAssignment.update({
    where: { id: nextAssignment.id },
    data: {
      status: 'OFFERED',
      phase: 'INITIAL',
      offeredAt: now,
      expiresAt,
    },
  })

  // Update zaak status
  await prisma.zaak.update({
    where: { id: zaakId },
    data: { status: 'OFFERING' },
  })

  // Send Slack notification to the employee
  try {
    await notifyNewZaakAssignment(nextAssignment.user.email, {
      id: zaakId,
      title: nextAssignment.zaak.shortDescription,
      clientName: nextAssignment.zaak.clientName || undefined,
      createdByName: nextAssignment.zaak.createdBy.name,
      expiresAt,
    })
  } catch (error) {
    console.error('Error sending Slack notification:', error)
    // Don't fail the operation if Slack fails
  }

  // Return data for email notification
  return {
    success: true,
    allDeclined: false,
    emailData: {
      to: nextAssignment.user.email,
      userName: nextAssignment.user.name.split(' ')[0],
      zaakDescription: nextAssignment.zaak.shortDescription,
      urgency: nextAssignment.zaak.urgency,
      createdByName: nextAssignment.zaak.createdBy.name,
      clientName: nextAssignment.zaak.clientName || undefined,
      startsQuickly: nextAssignment.zaak.startsQuickly,
    }
  }
}

/**
 * Handle accept response from employee
 */
export async function handleAcceptZaak(zaakId: string, userId: string) {
  const assignment = await prisma.zaakAssignment.findUnique({
    where: {
      zaakId_userId: { zaakId, userId },
    },
    include: {
      user: true,
      zaak: { include: { createdBy: true } },
    },
  })

  if (!assignment || assignment.status !== 'OFFERED') {
    throw new Error('Geen actief aanbod gevonden')
  }

  // Update assignment
  await prisma.zaakAssignment.update({
    where: { id: assignment.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  })

  // Update zaak
  await prisma.zaak.update({
    where: { id: zaakId },
    data: {
      status: 'ASSIGNED',
      assignedToId: userId,
      assignedAt: new Date(),
    },
  })

  // Mark remaining queue items as SKIPPED
  await prisma.zaakAssignment.updateMany({
    where: {
      zaakId,
      status: 'PENDING',
    },
    data: { status: 'SKIPPED' },
  })

  // Send Slack notification to the creator
  try {
    await notifyZaakAccepted(assignment.zaak.createdBy.email, {
      title: assignment.zaak.shortDescription,
      acceptedByName: assignment.user.name,
    })
  } catch (error) {
    console.error('Error sending Slack accept notification:', error)
  }

  // Return data for email notification
  return {
    success: true,
    assigneeName: assignment.user.name,
    emailData: {
      to: assignment.zaak.createdBy.email,
      userName: assignment.zaak.createdBy.name,
      zaakDescription: assignment.zaak.shortDescription,
      assigneeName: assignment.user.name,
    }
  }
}

/**
 * Handle decline response from employee
 */
export async function handleDeclineZaak(zaakId: string, userId: string, reason?: string) {
  const assignment = await prisma.zaakAssignment.findUnique({
    where: {
      zaakId_userId: { zaakId, userId },
    },
    include: {
      user: true,
      zaak: { include: { createdBy: true } },
    },
  })

  if (!assignment || assignment.status !== 'OFFERED') {
    throw new Error('Geen actief aanbod gevonden')
  }

  // Update assignment
  await prisma.zaakAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
      declineReason: reason,
    },
  })

  // Send Slack notification to the creator
  try {
    await notifyZaakDeclined(assignment.zaak.createdBy.email, {
      title: assignment.zaak.shortDescription,
      declinedByName: assignment.user.name,
      reason,
    })
  } catch (error) {
    console.error('Error sending Slack decline notification:', error)
  }

  // Offer to next person and return email data
  return await offerToNextInQueue(zaakId)
}

/**
 * Process reminders for INITIAL phase offers that have expired (1 hour passed)
 * Transitions them to REMINDER phase, sends Slack reminder, and extends deadline by 1 hour
 */
export async function processReminders() {
  const now = new Date()

  // Find all INITIAL phase offers that have expired
  const expiredInitialOffers = await prisma.zaakAssignment.findMany({
    where: {
      status: 'OFFERED',
      phase: 'INITIAL',
      expiresAt: { lt: now },
    },
    include: {
      user: true,
      zaak: {
        include: { createdBy: true }
      }
    },
  })

  const results = []

  for (const offer of expiredInitialOffers) {
    // Extend deadline by 1 more hour and transition to REMINDER phase
    const newExpiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000)

    await prisma.zaakAssignment.update({
      where: { id: offer.id },
      data: {
        phase: 'REMINDER',
        expiresAt: newExpiresAt,
        reminderSentAt: now,
      },
    })

    // Send Slack reminder notification
    try {
      await notifyZaakReminder(offer.user.email, {
        id: offer.zaakId,
        title: offer.zaak.shortDescription,
        clientName: offer.zaak.clientName || undefined,
        createdByName: offer.zaak.createdBy.name,
        expiresAt: newExpiresAt,
      })
    } catch (error) {
      console.error('Error sending Slack reminder:', error)
    }

    // Send browser push notification
    try {
      await sendZaakReminderPush(offer.userId, {
        title: offer.zaak.shortDescription,
        clientName: offer.zaak.clientName || undefined,
        createdByName: offer.zaak.createdBy.name,
      })
      results.push({ id: offer.id, status: 'reminder_sent' })
    } catch (error) {
      console.error('Error sending push notification:', error)
      results.push({ id: offer.id, status: 'reminder_failed', error })
    }
  }

  return { processed: expiredInitialOffers.length, results }
}

/**
 * Process expired offers in REMINDER phase (called by cron job or on page load)
 * Only timeouts assignments in REMINDER phase (2 hours total have passed)
 */
export async function processExpiredOffers() {
  const now = new Date()

  // Find all REMINDER phase offers that have expired (2 hours total)
  const expiredOffers = await prisma.zaakAssignment.findMany({
    where: {
      status: 'OFFERED',
      phase: 'REMINDER',
      expiresAt: { lt: now },
    },
  })

  const results = []

  for (const offer of expiredOffers) {
    // Mark as timeout
    await prisma.zaakAssignment.update({
      where: { id: offer.id },
      data: { status: 'TIMEOUT', respondedAt: now },
    })

    // Offer to next person
    const result = await offerToNextInQueue(offer.zaakId)
    results.push(result)
  }

  return { processed: expiredOffers.length, results }
}
