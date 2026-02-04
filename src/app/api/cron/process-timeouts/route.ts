import { NextRequest, NextResponse } from 'next/server'
import { processExpiredOffers, processReminders } from '@/lib/zaken-utils'

// This endpoint is called by Vercel Cron or external scheduler
// to process expired zaak offers and send reminders
//
// Two-phase flow:
// 1. INITIAL phase (first hour): Only Slack notification, no popup
// 2. REMINDER phase (second hour): Slack reminder + in-app popup shown
//
// This cron processes:
// 1. INITIAL → REMINDER transitions (after 1 hour)
// 2. REMINDER → TIMEOUT transitions (after 2 hours total)

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // First: Process INITIAL → REMINDER transitions (send reminders after 1 hour)
    const reminderResult = await processReminders()

    // Second: Process REMINDER → TIMEOUT transitions (timeout after 2 hours total)
    const timeoutResult = await processExpiredOffers()

    return NextResponse.json({
      success: true,
      reminders: {
        processed: reminderResult.processed,
        results: reminderResult.results,
      },
      timeouts: {
        processed: timeoutResult.processed,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error processing timeouts:', error)
    return NextResponse.json({ error: 'Kon niet verwerken timeouts' }, { status: 500 })
  }
}

// Also allow POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req)
}
