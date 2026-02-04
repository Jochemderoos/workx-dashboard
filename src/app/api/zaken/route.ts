import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateAssignmentQueue, offerToNextInQueue } from '@/lib/zaken-utils'

// GET - Fetch zaken (filtered by role)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isPartnerOrAdmin = user?.role === 'PARTNER' || user?.role === 'ADMIN'

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    // Partners/Admins see all zaken, employees only see their assigned zaken
    const whereClause = isPartnerOrAdmin
      ? status ? { status } : {}
      : { assignedToId: session.user.id }

    const zaken = await prisma.zaak.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        assignmentQueue: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { queuePosition: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(zaken)
  } catch (error) {
    console.error('Error fetching zaken:', error)
    return NextResponse.json({ error: 'Kon niet ophalen zaken' }, { status: 500 })
  }
}

// POST - Create new zaak (only Partners)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is Partner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'PARTNER') {
      return NextResponse.json({ error: 'Alleen partners kunnen zaken aanmaken' }, { status: 403 })
    }

    const body = await req.json()
    const {
      shortDescription,
      fullDescription,
      minimumExperienceYear,
      startMethod,
      startInstructions,
      urgency,
      startsQuickly,
      clientName,
      clientContact,
      // New assignment options
      directAssigneeId,
      excludedUserIds,
    } = body

    if (!shortDescription || minimumExperienceYear === undefined || !startMethod) {
      return NextResponse.json(
        { error: 'Beschrijving, ervaringsjaar en startmethode zijn verplicht' },
        { status: 400 }
      )
    }

    // Create the zaak
    const zaak = await prisma.zaak.create({
      data: {
        shortDescription,
        fullDescription,
        minimumExperienceYear: parseInt(minimumExperienceYear),
        startMethod,
        startInstructions,
        urgency: urgency || 'NORMAL',
        startsQuickly: startsQuickly || false,
        clientName,
        clientContact,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Check if direct assignment is requested
    if (directAssigneeId) {
      // Verify the assignee exists and has sufficient experience
      const assignee = await prisma.user.findUnique({
        where: { id: directAssigneeId },
        include: { compensation: true },
      })

      if (!assignee || !assignee.compensation) {
        return NextResponse.json({ error: 'Medewerker niet gevonden' }, { status: 400 })
      }

      if ((assignee.compensation.experienceYear ?? 0) < zaak.minimumExperienceYear) {
        return NextResponse.json({
          error: `Medewerker heeft onvoldoende ervaring (jaar ${assignee.compensation.experienceYear}, min. ${zaak.minimumExperienceYear})`
        }, { status: 400 })
      }

      // Directly assign the zaak
      await prisma.zaak.update({
        where: { id: zaak.id },
        data: {
          status: 'ASSIGNED',
          assignedToId: directAssigneeId,
          assignedAt: new Date(),
        },
      })

      // Create a single assignment record for tracking
      await prisma.zaakAssignment.create({
        data: {
          zaakId: zaak.id,
          userId: directAssigneeId,
          queuePosition: 1,
          hoursWorkedBasis: 0,
          status: 'ACCEPTED',
          offeredAt: new Date(),
          respondedAt: new Date(),
        },
      })

      // Notify the assignee via Slack
      const { notifyNewZaakAssignment } = await import('@/lib/slack')
      try {
        await notifyNewZaakAssignment(assignee.email, {
          id: zaak.id,
          title: zaak.shortDescription,
          clientName: zaak.clientName || undefined,
          createdByName: zaak.createdBy.name,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Not really expiring, just for display
        })
      } catch (error) {
        console.error('Error sending direct assignment notification:', error)
      }

      return NextResponse.json({
        ...zaak,
        message: `Zaak direct toegewezen aan ${assignee.name}`,
      }, { status: 201 })
    }

    // Generate the assignment queue (with exclusions if provided)
    const queue = await generateAssignmentQueue(
      zaak.id,
      zaak.minimumExperienceYear,
      excludedUserIds || []
    )

    if (queue.length === 0) {
      // No eligible employees found
      await prisma.zaak.update({
        where: { id: zaak.id },
        data: { status: 'ALL_DECLINED' },
      })

      return NextResponse.json({
        ...zaak,
        warning: 'Geen medewerkers gevonden met voldoende ervaring',
      }, { status: 201 })
    }

    // Start offering to the first person in queue
    await offerToNextInQueue(zaak.id)

    return NextResponse.json(zaak, { status: 201 })
  } catch (error) {
    console.error('Error creating zaak:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken zaak' }, { status: 500 })
  }
}
