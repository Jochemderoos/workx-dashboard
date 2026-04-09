import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Verwijder handovers die meer dan 7 dagen verlopen zijn
// Beveiligd met CRON_SECRET of PARTNER/ADMIN sessie
export async function POST(req: NextRequest) {
  try {
    // Auth check: CRON_SECRET of ingelogde PARTNER/ADMIN
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronRequest) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
      }
      if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
      }
    }

    // Bewaar overdrachten 90 dagen na afloop (was 7 dagen)
    // Zodat medewerkers oude overdrachten als referentie kunnen gebruiken
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    const result = await prisma.handover.deleteMany({
      where: {
        periodEnd: { lt: cutoff },
      },
    })

    return NextResponse.json({
      success: true,
      deleted: result.count,
    })
  } catch (error) {
    console.error('Error cleaning up handovers:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
