import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - alle openstaande facturen, optioneel gefilterd op userId
// ?mine=1 → alleen die van ingelogde gebruiker
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === '1'
    const userId = searchParams.get('userId')
    const where: { primaryUserId?: string | null } = {}
    if (mine) where.primaryUserId = session.user.id
    else if (userId === 'null') where.primaryUserId = null
    else if (userId) where.primaryUserId = userId

    const invoices = await prisma.openInvoice.findMany({
      where,
      orderBy: [{ bookYear: 'asc' }, { bookPeriod: 'asc' }, { invoiceNumber: 'asc' }],
      include: {
        primaryUser: { select: { id: true, name: true, avatarUrl: true } },
        lines: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { hours: 'desc' },
        },
      },
    })
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Error fetching open invoices:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
