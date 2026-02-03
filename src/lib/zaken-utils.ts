import { prisma } from '@/lib/prisma'
import { sendZaakOfferEmail, sendAllDeclinedEmail, sendZaakAssignedEmail } from '@/lib/email'

// Experience year labels
export const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'Juridisch medewerker',
  1: '1e jaars',
  2: '2e jaars',
  3: '3e jaars',
  4: '4e jaars',
  5: '5e jaars',
  6: '6e jaars',
  7: '7e jaars',
  8: '8+ jaars',
}

// Urgency config
export const URGENCY_CONFIG = {
  LOW: { label: 'Laag', color: '#22c55e', bgColor: 'bg-green-500/10', textColor: 'text-green-400' },
  NORMAL: { label: 'Normaal', color: '#3b82f6', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400' },
  HIGH: { label: 'Hoog', color: '#f59e0b', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
  URGENT: { label: 'Urgent', color: '#ef4444', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
}

// Start method labels
export const START_METHOD_LABELS = {
  CONTACT_CLIENT: 'Neem contact op met klant',
  INFO_FROM_PARTNER: 'Vraag info bij partner',
}

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
 */
export async function generateAssignmentQueue(zaakId: string, minimumExperienceYear: number) {
  // Get all active employees with sufficient experience
  const eligibleEmployees = await prisma.user.findMany({
    where: {
      isActive: true,
      role: 'EMPLOYEE',
      compensation: {
        experienceYear: { gte: minimumExperienceYear },
      },
    },
    include: { compensation: true },
  })

  if (eligibleEmployees.length === 0) {
    console.log('No eligible employees found for zaak:', zaakId)
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
 */
export async function offerToNextInQueue(zaakId: string): Promise<boolean> {
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

    // Notify partners
    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER', isActive: true },
    })

    const responses = allAssignments.map(a => ({
      name: a.user.name,
      reason: a.declineReason || (a.status === 'TIMEOUT' ? 'Geen reactie (timeout)' : undefined),
    }))

    for (const partner of partners) {
      await sendAllDeclinedEmail({
        to: partner.email,
        zaakDescription: zaak?.shortDescription || 'Onbekende zaak',
        responses,
      })
    }

    return false
  }

  // Update assignment status
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2 hours

  await prisma.zaakAssignment.update({
    where: { id: nextAssignment.id },
    data: {
      status: 'OFFERED',
      offeredAt: now,
      expiresAt,
    },
  })

  // Update zaak status
  await prisma.zaak.update({
    where: { id: zaakId },
    data: { status: 'OFFERING' },
  })

  // Send email notification
  await sendZaakOfferEmail({
    to: nextAssignment.user.email,
    userName: nextAssignment.user.name.split(' ')[0], // First name
    zaakDescription: nextAssignment.zaak.shortDescription,
    urgency: nextAssignment.zaak.urgency,
    createdByName: nextAssignment.zaak.createdBy.name,
    clientName: nextAssignment.zaak.clientName || undefined,
    startsQuickly: nextAssignment.zaak.startsQuickly,
    dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard/werk`,
  })

  return true
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

  // Notify the partner who created the zaak
  await sendZaakAssignedEmail({
    to: assignment.zaak.createdBy.email,
    userName: assignment.zaak.createdBy.name,
    zaakDescription: assignment.zaak.shortDescription,
    assigneeName: assignment.user.name,
  })

  return { success: true, assigneeName: assignment.user.name }
}

/**
 * Handle decline response from employee
 */
export async function handleDeclineZaak(zaakId: string, userId: string, reason?: string) {
  const assignment = await prisma.zaakAssignment.findUnique({
    where: {
      zaakId_userId: { zaakId, userId },
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

  // Offer to next person
  await offerToNextInQueue(zaakId)

  return { success: true }
}

/**
 * Process expired offers (called by cron job)
 */
export async function processExpiredOffers() {
  const now = new Date()

  // Find all expired offers
  const expiredOffers = await prisma.zaakAssignment.findMany({
    where: {
      status: 'OFFERED',
      expiresAt: { lt: now },
    },
  })

  for (const offer of expiredOffers) {
    // Mark as timeout
    await prisma.zaakAssignment.update({
      where: { id: offer.id },
      data: { status: 'TIMEOUT', respondedAt: now },
    })

    // Offer to next person
    await offerToNextInQueue(offer.zaakId)
  }

  return { processed: expiredOffers.length }
}
