import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleAcceptZaak, handleDeclineZaak } from '@/lib/zaken-utils'

// POST - Respond to a zaak offer (accept or decline)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { zaakId, response, reason } = body

    if (!zaakId || !response) {
      return NextResponse.json({ error: 'zaakId en response zijn verplicht' }, { status: 400 })
    }

    if (response !== 'ACCEPT' && response !== 'DECLINE') {
      return NextResponse.json({ error: 'Response moet ACCEPT of DECLINE zijn' }, { status: 400 })
    }

    if (response === 'ACCEPT') {
      const result = await handleAcceptZaak(zaakId, session.user.id)
      return NextResponse.json({
        success: true,
        message: 'Bedankt voor je inzet! De zaak is aan jou toegewezen.',
        assigneeName: result.assigneeName,
      })
    } else {
      await handleDeclineZaak(zaakId, session.user.id, reason)
      return NextResponse.json({
        success: true,
        message: 'De zaak is doorgegeven aan de volgende collega.',
      })
    }
  } catch (error) {
    console.error('Error responding to zaak:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to respond' },
      { status: 500 }
    )
  }
}
