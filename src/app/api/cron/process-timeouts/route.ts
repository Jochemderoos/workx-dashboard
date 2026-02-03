import { NextRequest, NextResponse } from 'next/server'
import { processExpiredOffers } from '@/lib/zaken-utils'

// This endpoint is called by Vercel Cron or external scheduler
// to process expired zaak offers

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processExpiredOffers()

    return NextResponse.json({
      success: true,
      processed: result.processed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error processing timeouts:', error)
    return NextResponse.json({ error: 'Failed to process timeouts' }, { status: 500 })
  }
}

// Also allow POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req)
}
