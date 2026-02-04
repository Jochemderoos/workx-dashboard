import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processExpiredOffers, processReminders } from '@/lib/zaken-utils'

// GET - Check for pending zaak offers for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Process phase transitions and expired offers (background cleanup)
    // Order matters: first INITIAL→REMINDER, then REMINDER→TIMEOUT
    processReminders().catch(console.error)
    processExpiredOffers().catch(console.error)

    // Find active offer for this user
    const pendingOffer = await prisma.zaakAssignment.findFirst({
      where: {
        userId: session.user.id,
        status: 'OFFERED',
      },
      include: {
        zaak: {
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!pendingOffer) {
      return NextResponse.json({ offer: null })
    }

    return NextResponse.json({
      offer: {
        id: pendingOffer.id,
        zaakId: pendingOffer.zaakId,
        expiresAt: pendingOffer.expiresAt,
        phase: pendingOffer.phase, // INITIAL = no popup, REMINDER = show popup
        zaak: {
          id: pendingOffer.zaak.id,
          shortDescription: pendingOffer.zaak.shortDescription,
          fullDescription: pendingOffer.zaak.fullDescription,
          urgency: pendingOffer.zaak.urgency,
          startMethod: pendingOffer.zaak.startMethod,
          startInstructions: pendingOffer.zaak.startInstructions,
          startsQuickly: pendingOffer.zaak.startsQuickly,
          clientName: pendingOffer.zaak.clientName,
          createdBy: pendingOffer.zaak.createdBy,
        },
      },
    })
  } catch (error) {
    console.error('Error checking pending offers:', error)
    return NextResponse.json({ error: 'Kon aanbiedingen niet controleren' }, { status: 500 })
  }
}
