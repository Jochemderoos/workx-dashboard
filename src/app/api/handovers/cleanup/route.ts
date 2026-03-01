import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - Verwijder handovers die meer dan 7 dagen verlopen zijn
export async function POST() {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)

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
